/* تخزين خاص لوثائق المتقدمين — ملفات على القرص خارج أي تقديم عام،
   ولا تُقرأ إلا برابط موقّع HMAC قصير العمر.
   - المفتاح السري يُولَّد مرة ويُحفظ في storage/private/.secret (مهمل من Git)
     أو يؤخذ من STORAGE_SECRET في الإنتاج.
   - الرابط الموقع: /api/v1/documents/:key?exp=..&sig=.. — بلا جلسة، لكنه ينتهي.
   - الرفع عبر PUT برابط موقّع مماثل يُنشأ بعد تسجيل الوثيقة في القاعدة. */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { AuthError } from './auth.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const STORAGE_DIR = join(root, 'storage', 'private')

let cachedSecret: Buffer | null = null

function secret(): Buffer {
  if (cachedSecret) return cachedSecret
  if (process.env.STORAGE_SECRET) {
    cachedSecret = Buffer.from(process.env.STORAGE_SECRET, 'utf8')
    return cachedSecret
  }
  mkdirSync(STORAGE_DIR, { recursive: true })
  const secretPath = join(STORAGE_DIR, '.secret')
  if (existsSync(secretPath)) {
    cachedSecret = readFileSync(secretPath)
    return cachedSecret
  }
  const generated = randomBytes(32)
  writeFileSync(secretPath, generated, { mode: 0o600 })
  cachedSecret = generated
  return generated
}

export function signKey(storageKey: string, exp: number, purpose: 'read' | 'write'): string {
  return createHmac('sha256', secret()).update(`${purpose}:${storageKey}:${exp}`).digest('base64url')
}

export function verifySignature(storageKey: string, exp: number, sig: string, purpose: 'read' | 'write'): boolean {
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const expected = Buffer.from(signKey(storageKey, exp, purpose))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export const MAX_UPLOAD_BYTES: Record<string, number> = {
  training_video: 300 * 1024 * 1024, // فيديو تدريبي — 300MB
  cv: 25 * 1024 * 1024,
  certificate: 25 * 1024 * 1024,
  evidence: 25 * 1024 * 1024,
  reference_letter: 25 * 1024 * 1024,
  other: 25 * 1024 * 1024,
}

export const SIGNED_URL_TTL_MS = 10 * 60 * 1000 // عشر دقائق

export function newStorageKey(): string {
  return randomBytes(24).toString('base64url')
}

export function filePathFor(storageKey: string): string {
  /* منع الخروج عن الجذر الخاص */
  if (!/^[A-Za-z0-9_-]+$/.test(storageKey)) throw new AuthError('bad_key', 'مفتاح تخزين غير صالح')
  mkdirSync(STORAGE_DIR, { recursive: true })
  return join(STORAGE_DIR, storageKey)
}

export async function writeStreamToKey(storageKey: string, stream: Readable, maxBytes: number): Promise<number> {
  const path = filePathFor(storageKey)
  let bytes = 0
  stream.on('data', (chunk: Buffer) => {
    bytes += chunk.length
    if (bytes > maxBytes) {
      stream.destroy(new AuthError('too_large', 'حجم الملف يتجاوز الحد المسموح', 413))
    }
  })
  await pipeline(stream, createWriteStream(path))
  return bytes
}
