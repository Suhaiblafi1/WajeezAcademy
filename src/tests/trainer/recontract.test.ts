/* عقدٌ جديدٌ لمن أُغلق عقدُه — البابُ عند الصفّ نفسِه، والمنعُ بمخرجه.

   ═══ ما سُئل عنه (٣٠ سبتمبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عند العقود المفسوخة: «ألا يمكن إعادةُ إنشاء عقدٍ آخرَ
   لهم؟». وكان يمكن لمن رحل ولم يُوقَف — من «من ينتظر عقدا» في رأس الشاشة،
   بعيدا عن الصفّ الذي سأل عنده. ومن أُوقف كانت تُركَّب له مسودّةٌ ثمّ يُردّ
   إرسالُها برموز حالتَين لا يقرؤهما أحد.

   ═══ وما يُحرَس ═══

   ① **الحكمُ يطابق خريطةَ الانتقالات** — ما يقول إنّه يُرسَل يُرسَل فعلا في
      الخادم، وما يمنعه ممنوعٌ هناك. فالقائمةُ لا تُحفَظ باليد مرّتين.
   ② **والمنعُ يسمّي مخرجَه** — لا «لا يمكن» مجرّدة.
   ③ **والرأسُ المغلَقُ وحدَه يُعرض عليه ما بعده**، بقول الخادم في
      `candidates` لا بحكمٍ ثانٍ في الشاشة.
   ④ **والشاشتان تقرآن الحكمَ ولا تعيدانه.** */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONTRACT_CLOSED_STATUSES, contractBlockedAr, recontractFor } from '@/application/trainer/contract-endings'
import { TRAINER_STATUSES, transitionProblemAr } from '../../../server/services/trainer-application.service'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const code = (p: string) => readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')

/** رأسُ سلسلةٍ لصاحب طلبٍ بعينه — بالحقول التي تقرؤها `recontractFor` وحدَها */
const head = (status: string, appStatus: string, suspendedAt: string | null = null) => ({
  status, profile: { suspendedAt, application: { id: 'app-1', status: appStatus } },
})
const candidate = { id: 'app-1', fullName: 'مدرّبٌ رحل' }

describe('① الحكمُ يطابق خريطةَ الانتقالات', () => {
  it('ما يُرسَل منه العقدُ في الخادم لا يمنعه الحكم، وما لا يُرسَل يمنعه — حالةً حالة', () => {
    for (const st of TRAINER_STATUSES) {
      /* `sendContract` لا تنقل «نشطا» ولا «عقدا قيد التوقيع»، وتنقل ما سواهما
         إلى `contract_pending` — فيُرسَل حيث تسمح الخريطةُ بالنقل */
      const serverSends = st === 'active' || st === 'contract_pending' || !transitionProblemAr(st, 'contract_pending')
      expect(contractBlockedAr(st, false) === null, `«${st}»: الحكمُ يخالف الخادم`).toBe(serverSends)
    }
  })

  it('والإيقافُ يمنع في كلّ حال — ولو كان الطلبُ نشطا', () => {
    for (const st of TRAINER_STATUSES) {
      expect(contractBlockedAr(st, true), `«${st}»: رُكّب لموقوف`).toMatch(/ارفعِ الإيقافَ/)
    }
  })
})

describe('② والمنعُ يسمّي مخرجَه', () => {
  it('الموقوفُ يُرفع إيقافُه، والمردودُ يُتراجَع عن ردّه، والمسحوبُ عن سحبه', () => {
    expect(contractBlockedAr('suspended', false)).toContain('«ارفع الإيقاف»')
    expect(contractBlockedAr('rejected', false)).toContain('«تراجَعْ عن الرفض»')
    expect(contractBlockedAr('withdrawn', false)).toContain('«تراجَعْ عن السحب»')
  })

  it('ولا رمزَ حالةٍ بالإنجليزيّة في نصّ المنع — وهو ما كان يُقرأ', () => {
    for (const st of TRAINER_STATUSES) {
      const said = contractBlockedAr(st, false) ?? ''
      expect(said, `«${st}»: رمزٌ لا يقرؤه أحد`).not.toMatch(/[a-z]{3,}/)
    }
  })
})

describe('③ والرأسُ المغلَقُ وحدَه يُعرض عليه ما بعده', () => {
  it('المفسوخُ لمن ينتظر عقدا — زرُّ التركيب لصاحبه بعينه', () => {
    expect(recontractFor(head('terminated', 'active'), [candidate])).toEqual({ compose: candidate })
  })

  it('وكلُّ نهايةٍ مغلَقةٍ كذلك — لا المفسوخُ وحدَه', () => {
    /* إلّا المُزاحَ: أدناه */
    for (const st of CONTRACT_CLOSED_STATUSES.filter((x) => x !== 'superseded')) {
      expect(recontractFor(head(st, 'active'), [candidate]), `«${st}»: رأسٌ مغلَقٌ بلا ما بعده`)
        .toEqual({ compose: candidate })
    }
  })

  /* ═══ والمُزاحُ لا يُعرض عليه شيء (١ أكتوبر ٢٠٢٦) ═══
     أزاحه عقدٌ أحدثُ نافذٌ للمدرّب نفسِه، فأزرارُه على ذاك. وكان يُقال تحته
     «لم يُقبَل داخليّا بعد» لمدرّبٍ نشطٍ بعقدٍ نافذ — ولو انتهى الأحدثُ لَظهر
     زرُّ التركيب على رأسه هو، فزرٌّ ثانٍ هنا تكرار. */
  it('والمُزاحُ لا زرَّ عليه ولا سببَ منعٍ — ولو كان صاحبُه ينتظر عقدا', () => {
    expect(recontractFor(head('superseded', 'active'), []), 'قيل لمدرّبٍ نافذٍ إنّه لم يُقبَل').toBeNull()
    expect(recontractFor(head('superseded', 'active'), [candidate]), 'زرُّ تركيبٍ ثانٍ').toBeNull()
  })

  it('والنافذُ والمفتوحُ لا — لهما أزرارُهما', () => {
    for (const st of ['draft', 'sent', 'amendment_requested', 'signed', 'countersigned']) {
      expect(recontractFor(head(st, 'active'), [candidate]), `«${st}»: عُرض عقدٌ جديدٌ فوق قائم`).toBeNull()
    }
  })

  it('ومن لا يُركَّب له بعدُ يُقال له المخرجُ مكانَ الزرّ', () => {
    const suspended = recontractFor(head('terminated', 'suspended'), [])
    expect(suspended && 'blockedAr' in suspended ? suspended.blockedAr : '').toContain('«ارفع الإيقاف»')

    /* والموقوفُ ملفُّه وطلبُه في طورٍ حيّ — الإيقافُ على الملفّ يكفي */
    const profileOnly = recontractFor(head('terminated', 'onboarding', '2026-09-30T00:00:00Z'), [])
    expect(profileOnly && 'blockedAr' in profileOnly ? profileOnly.blockedAr : '').toContain('«ارفع الإيقاف»')

    /* وحيٌّ لم يُقبَل داخليّا بعد: القبولُ يسبق العقد */
    const early = recontractFor(head('revoked', 'under_review'), [])
    expect(early && 'blockedAr' in early ? early.blockedAr : '').toContain('«اقبَلْه داخليّا»')
  })

  it('ورأسٌ بلا صاحبٍ معروفٍ لا يُعرض عليه شيء', () => {
    expect(recontractFor({ status: 'terminated', profile: null }, [candidate])).toBeNull()
    expect(recontractFor({ status: 'terminated', profile: { application: null } }, [candidate])).toBeNull()
  })
})

describe('④ والشاشتان تقرآن الحكمَ ولا تعيدانه', () => {
  it('شاشةُ العقود تسأل الرأسَ لا كلَّ صفّ، وتفتح المركِّبَ نفسَه', () => {
    const screen = code('src/pages/admin/TrainerContracts.tsx')
    expect(screen, 'الحكمُ لا يُسأل على رأس السلسلة').toMatch(/const c = g\.head;\s*const next = recontractFor\(c, candidates\);/)
    expect(screen, 'زرُّ الصفّ لا يفتح المركِّبَ نفسَه').toContain('openComposer(next.compose)')
    expect(screen, 'المركِّبُ يُضغط وفيه ما يمنعه').toContain('Boolean(prefill.blockedAr)')
  })

  it('وخطواتُ التجهيز تقول المنعَ وتُطفئ الزرّ', () => {
    const prep = code('src/pages/admin/PreparationSteps.tsx')
    expect(prep, 'المنعُ لا يُعرض قبل الضغط').toContain('{prefill.blockedAr}')
    expect(prep, 'زرُّ «ركِّبْ وأرسِلْ» يُضغط وفيه ما يمنعه').toContain('Boolean(prefill.blockedAr)')
  })
})
