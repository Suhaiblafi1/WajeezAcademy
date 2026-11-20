/* صورةُ الحوالة في المتصفّح — تُقرأ وتُصغَّر قبل أن تُرسل (١٩ نوفمبر ٢٠٢٦).

   لقطةُ هاتفٍ حديثٍ أربعةُ ميغابايتات، ورفعُها على شبكةٍ ضعيفةٍ يُبقي صاحبَها أمام زرٍّ يدور. فما زاد عن ١٨٠٠ نقطةٍ
   أو ميغابايتٍ ونصف يُعاد رسمُه JPEG — والحوالةُ تُقرأ كما هي. والـPDF يُرسل كما هو. والخادمُ يسأل البايتاتِ عن نوعها
   في الحالتين (`registration.service.ts`). ويقرؤها النموذجُ وصفحةُ رابط الدفع معا. */

import { PROOF_MAX_BYTES } from '@/application/private-course/ai-jobs'

export interface Proof {
  name: string
  base64: string
  /** معاينةٌ للصورة — `data:` لا `blob:`: سياسةُ المحتوى تسمح بالأولى وحدَها */
  preview: string | null
  pdf: boolean
}

const MAX_SIDE = 1800
const SHRINK_ABOVE = 1.5 * 1024 * 1024

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = src
  })
}

export function base64Bytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((b64.length * 3) / 4)
}

export async function prepareProof(file: File): Promise<Proof> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (isPdf) {
    if (file.size > PROOF_MAX_BYTES) throw new Error('ملف PDF أكبر من 8MB')
    const url = await readDataUrl(file)
    return { name: file.name, base64: url, preview: null, pdf: true }
  }
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new Error('ارفع صورة الحوالة أو ملف PDF')
  }
  const original = await readDataUrl(file)
  let img: HTMLImageElement
  try {
    img = await loadImage(original)
  } catch {
    throw new Error('تعذر فتح الصورة — التقط لقطة شاشة للحوالة وارفعها')
  }
  const big = Math.max(img.naturalWidth, img.naturalHeight)
  const plain = /^image\/(jpeg|png|webp)$/.test(file.type)
  if (plain && big <= MAX_SIDE && file.size <= SHRINK_ABOVE) {
    return { name: file.name, base64: original, preview: original, pdf: false }
  }
  const scale = Math.min(1, MAX_SIDE / big)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { name: file.name, base64: original, preview: original, pdf: false }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const jpeg = canvas.toDataURL('image/jpeg', 0.86)
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return { name, base64: jpeg, preview: jpeg, pdf: false }
}

/** يقرأ الملفَّ ويجهّزه، أو يرمي برسالةٍ تُعرض كما هي */
export async function readProof(file: File): Promise<Proof> {
  const p = await prepareProof(file)
  if (base64Bytes(p.base64) > PROOF_MAX_BYTES) throw new Error('الملف أكبر من 8MB — التقط لقطة شاشة للحوالة')
  return p
}
