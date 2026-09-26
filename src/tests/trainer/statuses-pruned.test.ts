/* حالاتٌ حُذفت — فلا تعود من بابٍ نُسي.
 *
 * طلبُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «أرى أنّ الحالاتِ كثيرةٌ الآنَ أصبحت
 * لطلب المدرّب… لخّصْ لي إيّاها كلَّها وشرحا عن كلّ حالة، واقترحْ حذفَ جزءٍ
 * منها وأنا أعطيك رأيي قبل التنفيذ». فحُذفت ثلاث.
 *
 * ── ولمَ حارسٌ للحذف أصلا ──
 *
 * الحالةُ نصٌّ في عمود، لا نوعٌ في القاعدة (`TrainerApplication.status` بلا
 * قيد CHECK — والسببُ مكتوبٌ في المخطّط). فالحارسُ الوحيدُ نوعُ
 * `TrainerStatus` في TypeScript — وهو يمسك `'shortlisted'` مكتوبةً حرفا،
 * **ولا يمسك قائمةً تُبنى من نصوصٍ حرّة** ولا لفظا يبقى في معجمٍ يُقرأ
 * بالمفتاح. فهذا يفحص المواضعَ التي يعمى عنها المصرِّف.
 *
 * والفحصُ على البنية لا على ورودِ حرفٍ في ملفّ: تُستورَد القوائمُ نفسُها
 * ويُسأل عن عضويّتها، فلا يخضرّ لمسافةٍ ولا يسقط لتعليق.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRAINER_STATUSES, ALLOWED_TRANSITIONS } from '../../../server/services/trainer-application.service'
import { REVIEW_OPEN_STATUSES, ONE_CLICK_APPROVABLE_STATUSES } from '@/application/trainer/approval'
import { STATUS_LABELS } from '@/application/trainer/application-status'
import {
  APPLICANT_STATUS, BOOKABLE_STATUSES, EDITABLE_STATUSES, WITHDRAWABLE_STATUSES,
} from '@/application/trainer/application-options'
import { PURGEABLE_STATUSES } from '@/application/trainer/purgeable'
import { AWAITING_US, AWAITING_APPLICANT } from '@/application/trainer/queue-age'
import { DECISIONS, BULK_ACTIONS } from '@/application/trainer/decisions'
import { OUTREACH, OUTREACH_ACTIONS } from '@/application/trainer/outreach'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/** الحالاتُ الثلاثُ المحذوفة — تُكتب مرّةً ويُقاس عليها كلُّ ما يلي */
const GONE = ['email_verification_pending', 'shortlisted', 'demo_requested'] as const

describe('① لا تُقبل حالةٌ محذوفةٌ في أيّ قائمةِ حالات', () => {
  /* والقوائمُ تُعدّ هنا بأسمائها لا بمسحٍ على المجلَّد: قائمةٌ تُضاف ولا
     تُذكَر هنا لا يمسكها شيء — وهو حدُّ هذا الحارس، يُقال ولا يُدَّعى غيرُه. */
  const LISTS: Record<string, readonly string[]> = {
    TRAINER_STATUSES,
    REVIEW_OPEN_STATUSES,
    ONE_CLICK_APPROVABLE_STATUSES,
    BOOKABLE_STATUSES,
    EDITABLE_STATUSES,
    WITHDRAWABLE_STATUSES,
    PURGEABLE_STATUSES,
    AWAITING_US,
    AWAITING_APPLICANT,
  }

  it.each(Object.keys(LISTS))('«%s» خاليةٌ من المحذوفات', (name) => {
    for (const gone of GONE) {
      expect(LISTS[name], `«${gone}» عادت إلى ${name}`).not.toContain(gone)
    }
  })

  it('ولا لفظَ لها في معجمَي الشاشة — فلا شارةٌ لحالةٍ لا يُنقَل إليها أحد', () => {
    for (const gone of GONE) {
      expect(Object.keys(STATUS_LABELS), `«${gone}» لها لفظٌ في معجم الإدارة`).not.toContain(gone)
      expect(Object.keys(APPLICANT_STATUS), `«${gone}» لها بطاقةٌ في صفحة المتقدّم`).not.toContain(gone)
    }
  })

  it('ولا مصدرَ ولا وجهةَ في خريطة الانتقالات — لا بابَ إليها ولا منها', () => {
    for (const gone of GONE) {
      expect(Object.keys(ALLOWED_TRANSITIONS), `«${gone}» مصدرٌ في الخريطة`).not.toContain(gone)
      for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
        expect(targets, `«${from}» ما زال ينقل إلى «${gone}»`).not.toContain(gone)
      }
    }
  })

  it('ولا قرارَ يقود إليها — لا في القائمة ولا في الحشد', () => {
    for (const act of ['shortlist', 'request_demo'] as const) {
      expect(DECISIONS.map((d) => d.action), `القرارُ «${act}» عاد`).not.toContain(act)
      expect(BULK_ACTIONS, `القرارُ «${act}» عاد إلى الحشد`).not.toContain(act)
    }
  })
})

describe('② والافتراضُ في المخطّط ما تكتبه اليدُ أصلا', () => {
  const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
  /* سطرُ الحقل بعينه داخل النموذج — لا أوّلُ `status` في المخطّط كلِّه */
  const line = (() => {
    const model = /model TrainerApplication \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? ''
    return /^\s*status\s+String\s.*$/m.exec(model)?.[0] ?? ''
  })()

  it('يقول `draft` لا حالةً محذوفة', () => {
    expect(line, 'لم يُوجد سطرُ الحالة في نموذج الطلب').toMatch(/@default\(/)
    expect(line).toContain('@default("draft")')
    for (const gone of GONE) expect(line, `الافتراضُ «${gone}»`).not.toContain(gone)
  })

  it('والترحيلُ ينقل الصفوفَ ولا يترك حالةً محذوفةً في العمود', () => {
    const sql = readFileSync(
      join(root, 'prisma/migrations/20260926230000_trainer_statuses_prune/migration.sql'), 'utf8',
    )
    /* لكلِّ محذوفةٍ جملةُ تحديثٍ تُخرج صفوفَها — وبلا ذلك يبقى صفٌّ بحالةٍ
       لا لفظَ لها في معجم، فيُعرض فارغا لمن ينظر. */
    for (const gone of GONE) {
      expect(sql, `«${gone}» بلا جملةِ نقلٍ في الترحيل`)
        .toMatch(new RegExp(`UPDATE "TrainerApplication"[\\s\\S]*?'${gone}'`))
    }
    /* والانتظارُ ينتقل إلى «رأيٌ ثانٍ» بنصّ أمره — لا إلى غيرها */
    expect(sql).toMatch(/SET "status" = 'academic_review' WHERE "status" = 'waitlisted'/)
    /* ولا يُمَسُّ سجلُّ ما وقع */
    expect(sql, 'الترحيلُ يكتب في سجلّ الحالات — وهو خبرٌ عمّا كان')
      .not.toMatch(/UPDATE "TrainerStatusHistory"/)
  })
})

describe('③ وقائمةُ الانتظار بقيت — ولها من يحتاجها', () => {
  it('حالةٌ حيّةٌ وقرارٌ يُتَّخذ', () => {
    expect(TRAINER_STATUSES).toContain('waitlisted')
    expect(REVIEW_OPEN_STATUSES).toContain('waitlisted')
    expect(DECISIONS.map((d) => d.action)).toContain('waitlist')
  })

  /* ولمَ تُحرَس بقاءً لا حذفا: عُرضت للحذف على أنّها وسمٌ لا يفعل شيئا،
     وهي وجهةُ «اطمئنانٌ وشكرٌ ولا دعوة» — وتلك وجهةٌ اختارها صاحبُ المنصّة.
     فلو حُذفت يوما بقي `movesTo` يشير إلى حالةٍ لا وجودَ لها، ولا يُحمِّر
     ذلك شيئا إلّا هنا. */
  it('ووجهةُ متابعةِ الغياب حالةٌ قائمةٌ لا اسمٌ معلَّق', async () => {
    const { NO_SHOW_FOLLOWUPS } = await import('@/application/trainer/no-show-followup')
    const moves = NO_SHOW_FOLLOWUPS.map((f) => f.movesTo).filter((m) => m != null)
    expect(moves, 'لا متابعةَ تنقل الحالةَ — فقد سقط ما اختاره صاحبُ المنصّة').not.toHaveLength(0)
    for (const m of moves) {
      expect(TRAINER_STATUSES, `«${m}» وجهةٌ لا وجودَ لها`).toContain(m)
      /* والوجهةُ تُخرجه من طابور الحجز — وإلّا قرأ «احجزْ موعدا» فوق رسالةٍ
         تقول «نتطلّع إلى فرصٍ أخرى»، وهو التناقضُ الذي وُضعت له. */
      expect(BOOKABLE_STATUSES, `«${m}» يُحجَز فيها — فالتناقضُ باقٍ`).not.toContain(m)
    }
  })
})

describe('④ وطلبُ الدرس التجريبيّ بقي — مراسَلةً لا حالة', () => {
  it('فعلُه في معجم المراسَلات', () => {
    expect(OUTREACH_ACTIONS).toContain('trainer.demo.request')
  })

  it('وله مِحَكُّ تعليقٍ يسقط بعد القرار — كأخواته', () => {
    const kind = OUTREACH.find((o) => o.action === 'trainer.demo.request')!
    expect(kind, 'المراسَلةُ بلا مِحَكّ').toBeDefined()
    /* لم يُقيَّم بعد وحالتُه حيّة: الطلبُ قائم */
    expect(kind.pending({ status: 'academic_review', interviewsCount: 0, demosCount: 0 })).toBe(true)
    /* قُيّم: سقطت — لأنّ ما انتُظر وقع، لا لأنّ الرسالةَ نُسيت */
    expect(kind.pending({ status: 'academic_review', interviewsCount: 0, demosCount: 1 })).toBe(false)
    /* وصار مدرّبا: سقطت — «طُلب منه درسٌ» خبرٌ مضى ما بعدَه */
    expect(kind.pending({ status: 'active', interviewsCount: 0, demosCount: 0 })).toBe(false)
  })

  it('ورسالتُه باقيةٌ بنصّها — وهي التي شكا غيابَها', async () => {
    const { demoRequestMail } = await import('../../../server/services/trainer-decision-mail')
    const mail = demoRequestMail({ fullName: 'سعادُ المدرّبة', reference: 'WJ-TR-2026-00009' })
    expect(mail.subject.length, 'رسالةٌ بلا عنوان').toBeGreaterThan(5)
  })
})
