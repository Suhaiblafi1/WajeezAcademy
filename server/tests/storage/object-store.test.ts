/* مخزنُ الكائنات — ثلاثةُ أشياءَ تُحرَس، ولكلٍّ سببُه.

   ١) **المفتاحُ يأتي من عنوانِ URL.** فمفتاحٌ فيه `..` أو `/` يخرج من الجذر
      ويقرأ ما ليس له أو يكتب فوقه. وهذا ليس احتمالا نظريّا: المسارُ عامٌّ
      بلا جلسة، يحرسه توقيعٌ وحدَه.

   ٢) **ستّةُ نماذجَ تحمل `storageKey`** ومساران يخدمانها. وكان المساران
      يعرفان واحدا منها، فخمسةٌ تَعِد برابطٍ يقود إلى ٤٠٤. فمن أضاف نموذجا
      سابعا يحمل مفتاحا يجب أن يحمرّ عنده شيءٌ ويقول له أين يضيفه.

   ٣) **وحجمُ التخزين يدخل النسخةَ الاحتياطيّة.** صارت الوثائقُ نصفَين: صفٌّ
      في القاعدة وبايتاتٌ على الحجم. ونسخةٌ تأخذ أحدَهما تُنتج بعد الاسترجاع
      منصّةً تعرض وثائقَ لا محتوى لها — وهو أسوأُ من فقدها معا لأنّه يبدو
      سليما. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { getObject, getObjectMeta, objectRoot, putObject, assertSafeKey } from '../../services/object-store'
import { newStorageKey, resolveStorageOwner } from '../../services/storage.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

let prisma: PrismaClient
let sandbox = ''
const savedRoot = process.env.STORAGE_ROOT

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  sandbox = await mkdtemp(join(tmpdir(), 'wajeez-store-'))
  process.env.STORAGE_ROOT = sandbox
}, 240_000)

afterAll(async () => {
  if (savedRoot === undefined) delete process.env.STORAGE_ROOT
  else process.env.STORAGE_ROOT = savedRoot
  if (sandbox) await rm(sandbox, { recursive: true, force: true })
})

describe('الكائنُ يُكتب ويُقرأ كما كُتب', () => {
  it('البايتاتُ ومجاورُها — نوعٌ واسمٌ وحجم', async () => {
    const key = newStorageKey()
    /* بايتاتٌ غيرُ نصّيّةٍ عمدا: ملفٌّ حقيقيٌّ ليس UTF-8، ورحلةُ الكتابة
       والقراءة يجب ألّا تمسّه بترميز. */
    const body = Buffer.concat([
      Buffer.from('%PDF-1.4 كرّاسةُ الحصّة'),
      Buffer.from([0x00, 0xff, 0xfe, 0x80, 0x0a]),
    ])
    const size = await putObject(key, body, { mime: 'application/pdf', originalName: 'كرّاسة.pdf' })
    expect(size).toBe(body.length)

    const back = await getObject(key)
    expect(back, 'لم يُقرأ ما كُتب').not.toBeNull()
    expect(back!.equals(body), 'البايتاتُ تغيّرت بين الكتابة والقراءة').toBe(true)

    const meta = await getObjectMeta(key)
    expect(meta?.mime).toBe('application/pdf')
    expect(meta?.originalName).toBe('كرّاسة.pdf')
    expect(meta?.sizeBytes).toBe(body.length)
  })

  it('وما لم يُرفع بعد يُقرأ `null` لا يُرمى خطأ', async () => {
    await expect(getObject(newStorageKey())).resolves.toBeNull()
  })
})

describe('الخروجُ من الجذر مرفوض', () => {
  /* والفحصُ على المفتاح **قبل** أن يمسّ مسارا — لا على الناتج بعد بنائه */
  const escapes = [
    '../../../../etc/passwd',
    '..',
    'a/../../b',
    'sub/dir/key',
    'key with space',
    'key.meta.json',
    '',
    'short',
  ]
  it.each(escapes)('«%s» يُرفض', (bad) => {
    expect(() => assertSafeKey(bad)).toThrow()
  })

  it('والمفتاحُ الذي يولّده المخزنُ نفسُه يُقبل', () => {
    for (let i = 0; i < 20; i++) expect(() => assertSafeKey(newStorageKey())).not.toThrow()
  })

  it('ولا يُكتب كائنٌ بمفتاحٍ خارجٍ — الرفضُ قبل لمسِ القرص', async () => {
    await expect(putObject('../escape', Buffer.from('x'), { mime: 'text/plain', originalName: 'x' }))
      .rejects.toThrow()
  })

  it('والجذرُ يُقرأ من البيئة — فلا يُفترض مسارٌ في الإنتاج', () => {
    expect(objectRoot()).toBe(sandbox)
  })
})

/* ═══ النماذجُ الستّة — ومن أضاف سابعا يحمرّ عنده هذا ═══

   يُقرأ المخطَّطُ نفسُه لا قائمةٌ مكتوبةٌ باليد: قائمةٌ باليد تشيخ عند أوّل
   نموذجٍ جديد، وهي بعينها الطريقةُ التي جعلت خمسةً منها تُنسى. */
describe('كلُّ نموذجٍ يحمل مفتاحَ تخزينٍ يعرفه المخزن', () => {
  const MODELS_IN_SCHEMA = (() => {
    const schema = read('prisma/schema.prisma')
    const found: string[] = []
    for (const block of schema.split(/\nmodel /).slice(1)) {
      const name = block.slice(0, block.indexOf(' ')).trim()
      const body = block.slice(0, block.indexOf('\n}'))
      if (/^\s*storageKey\s/m.test(body)) found.push(name)
    }
    return found.sort()
  })()

  /** ما يعرفه `resolveStorageOwner` فعلا — يُصرَّح هنا ويُقارن بالمخطَّط */
  const RESOLVED = [
    'AssessmentResponse', 'AssignmentSubmission', 'CvSubmission',
    'LearningMaterial', 'Recording', 'TrainerApplicationDocument',
  ].sort()

  it('المسحُ يقرأ المخطَّطَ فعلا', () => {
    expect(MODELS_IN_SCHEMA.length, 'لم يُقرأ نموذجٌ واحد — تعطّل المسح').toBeGreaterThan(3)
  })

  it('ولا نموذجَ يحمل مفتاحا ولا يعرفه المخزن', () => {
    expect(
      MODELS_IN_SCHEMA,
      'نموذجٌ يحمل `storageKey` ولا يعرفه `resolveStorageOwner` — فرابطُ رفعِه '
      + 'يقود إلى ٤٠٤ «الوثيقة غير مسجلة». أضِفه هناك وإلى القائمة هنا.',
    ).toEqual(RESOLVED)
  })

  it('ومفتاحٌ لا يملكه سجلٌّ لا يُقبل — فلا يبقى على القرص ما لا يعرفه أحد', async () => {
    await expect(resolveStorageOwner(prisma, newStorageKey())).resolves.toBeNull()
  })
})

describe('وحجمُ التخزين يدخل النسخةَ الاحتياطيّة', () => {
  const backup = read('deploy/backup.sh')

  it('يُؤخَذ من داخل الحاوية حيث هو مركوب', () => {
    /* على الأمر لا على ورودِ كلمة: `tar` يقرأ `/app/storage` عبر `compose exec` */
    expect(backup).toMatch(/\$COMPOSE exec -T app tar -czf - -C \/app\/storage/)
  })

  it('ويُرفع إلى الوجهة الخارجيّة — لا يبقى على القرص نفسِه', () => {
    expect(backup).toMatch(/rclone copy "\$WORK\/\$STORE_FILE" "\$BACKUP_REMOTE"/)
  })

  it('ويُثبَت بالفكّ لا بوجود الملفّ — نسخةٌ لا تُفتح ليست نسخة', () => {
    expect(backup).toMatch(/tar -xzf "\$WORK\/store\.tar\.gz"/)
  })

  it('ويُقلَّم كما تُقلَّم نسخُ القاعدة — وإلّا امتلأت الوجهة', () => {
    expect(backup).toMatch(/rclone delete "\$BACKUP_REMOTE" --include 'wajeez-nightly-\*-storage\.tar\.gz'/)
  })

  it('والحجمُ مركوبٌ على الحاوية أصلا — وإلّا أرشَف الأمرُ فراغا', () => {
    expect(read('deploy/compose.prod.yml')).toMatch(/storage:\/app\/storage/)
  })
})
