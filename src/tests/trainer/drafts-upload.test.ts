/* مسوّداتُ ما نقترحه على بطاقة المدرّب — تُرفع من الشاشة لا تُكتب في الشيفرة (٢٦ أكتوبر ٢٠٢٦).

   والخادمُ يحرسه `server/tests/trainer/drafts-upload.test.ts`؛ وهنا الشاشةُ والمصدرُ الواحد:
   ① «ارفع المسوّدات» بجانب تنزيل ملفّات المدرّبين، لمن يرسلها وحدَه (`trainer.publish`) — في الخادم والشاشة؛
   ② ويرفع الملفَّ إلى مساره، ويقول ما وقع أو سببَ ردّه في سطرٍ تحت الأزرار — لا إشعارٍ يُقطع؛
   ③ والقرّاءُ الثلاثة (الإرسالُ وبطاقتُه وملفُّ المدرّبين) من مصدرٍ واحد (`TrainerDraftsService`) — لا من الشيفرة مباشرةً؛
   ④ وسطرُه بصيغ العدد وبلا تشكيل. */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { draftsUploadedAr } from '@/application/trainer/text-drafts'

/* بلا التعليقات: ذِكرُ ما كان في شرحٍ ليس عودةً له */
const code = (p: string) =>
  readFileSync(join(process.cwd(), p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
const ops = code('src/pages/admin/TrainerRunOps.tsx')
const routes = code('server/http/routes/admin-trainer.routes.ts')

describe('① لمن يرسلها وحده — بجانب تنزيل ملفّاتهم', () => {
  it('⚠️ المسار خلف صلاحيّة الإرسال', () => {
    const at = routes.indexOf("app.post('/api/admin/trainers/suggestions/drafts'")
    expect(at, 'لا مسار').toBeGreaterThan(-1)
    expect(routes.slice(at, at + 200)).toContain("requirePermission('trainer.publish')")
  })

  it('⚠️ والزرّ لمن يملكها وحده — بعد أزرار التنزيل', () => {
    expect(ops).toContain('const canSendDrafts = sessionUser?.permissions.includes("trainer.publish") ?? false;')
    const gate = ops.indexOf('{canSendDrafts && (')
    expect(gate, 'الزرّ بلا حارس').toBeGreaterThan(-1)
    expect(ops.slice(gate, gate + 900)).toMatch(/<input\s+ref=\{draftsInput\}\s+type="file"[\s\S]*?ارفع المسوّدات/)
    expect(gate, 'ليس بجانب التنزيل').toBeGreaterThan(ops.indexOf('void downloadDraftingFiles(part)'))
  })
})

describe('② ويقول ما وقع في سطر', () => {
  it('⚠️ يرفع الملفّ كما هو إلى مساره، ويقول ما وقع من عدّ الخادم', () => {
    expect(ops).toMatch(/const r = await apiPost<DraftsUploaded>\("\/api\/admin\/trainers\/suggestions\/drafts", body\);\s*setDraftsMsg\(\{ ok: true, text: draftsUploadedAr\(r\) \}\);\s*await load\(\);/)
  })

  it('⚠️ وسببُ الردّ بسطوره — في سطر تحت الأزرار لا في إشعار', () => {
    expect(ops).toMatch(/\{draftsMsg && \(\s*<p role="status" className=\{`[^`]*whitespace-pre-wrap/)
    const fn = ops.slice(ops.indexOf('const uploadDrafts = async'), ops.indexOf('const uploadDrafts = async') + 900)
    expect(fn, 'الردّ في إشعار').not.toMatch(/toastError\(/)
  })
})

describe('③ والقرّاء الثلاثة من مصدر واحد', () => {
  const READERS = [
    'server/services/trainer-suggestion.service.ts',
    'server/services/trainer-review.service.ts',
    'server/services/trainer-drafting-bundle.service.ts',
  ]

  it.each(READERS)('⚠️ %s يقرأ المسوّدات من المصدر الواحد — لا من الشيفرة مباشرة', (file) => {
    const src = code(file)
    expect(src).toContain('new TrainerDraftsService(this.prisma).drafts()')
    expect(src, 'يقرأ الشيفرة مباشرة').not.toMatch(/PITCH_DRAFTS|BIO_DRAFTS|trainer-suggestion-drafts/)
  })

  it('⚠️ ولا يقرأ مسوّدات الشيفرة في الخادم غير المصدر الواحد', () => {
    const dir = join(process.cwd(), 'server/services')
    const readers = readdirSync(dir).filter((f) => f.endsWith('.ts') && /from '\.\/trainer-suggestion-drafts'/.test(code(`server/services/${f}`)))
    expect(readers).toEqual(['trainer-drafts.service.ts'])
  })
})

describe('④ وسطره', () => {
  it('بصيغ العدد، ويقول أين تُرسَل', () => {
    expect(draftsUploadedAr({ pitch: 12, bio: 10, repeated: 1 })).toBe(
      'رفع «لماذا نفتخر به» لـ12 مدربا · والنبذة لـ10 مدربين · ومرفوع من قبل لم يتغير: 1. تجدها في بطاقة كل مدرب، وترسلها من «أرسل للنشطين ومن نشرت دوراتهم».',
    )
  })

  it('⚠️ والملفّ المرفوع كلّه من قبل يقال كذلك — لا «رفع» بلا شيء', () => {
    expect(draftsUploadedAr({ pitch: 0, bio: 0, repeated: 7 })).toBe('كل ما في الملف مرفوع من قبل، فلم يتغير شيء.')
  })

  it('بلا تشكيل إعرابيّ', () => {
    expect(draftsUploadedAr({ pitch: 1, bio: 2, repeated: 3 })).not.toMatch(/[ً-ِْ]/)
  })
})
