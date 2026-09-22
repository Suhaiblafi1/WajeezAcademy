/* أدلّةُ المتقدّم — أربعةُ حقولٍ يُقرأ حكمُها في موضعٍ واحدٍ يُشغَّل.

   ═══ لماذا خرج الحكمُ من النموذج ═══

   كان `JoinTrainer` يحمل حكما ثانيا في نفسه — `^https?:\/\/…` — يعدُّ به
   الأدلّةَ الصالحة، بينما الخادمُ يقرأ `normalizeApplicantLink` ويُطبّع.
   فحكمان على شيءٍ واحد: من لصق `www.linkedin.com/in/x` ولم يغادر الحقلَ
   مؤشّرُه — واستعادةُ المسوّدة والملءُ الآليُّ من المتصفّح لا يُطلقان
   `onBlur` — قيل له «رابطٌ في أدلتك بلا https:// — أكمله أو احذفه»، وهو
   رابطٌ تامٌّ يقبله الخادمُ ويُطبّعه.

   فصار الحكمُ هنا وحدَه: يُستدعى من النموذج ليَعُدّ، ويُستدعى منه عند
   الإرسال ليُطبّع — فلا يبقى للتطبيع تعلّقٌ بمغادرةِ مؤشّر. ويُختبر من
   غير شاشة. */

import { normalizeApplicantLink } from './applicant-link'

/** الأربعةُ بأسمائها كما يعرفها الخادمُ في `trainer-applications.routes.ts` */
export const EVIDENCE_FIELDS = ['linkedinUrl', 'youtubeUrl', 'instagramUrl', 'facebookUrl'] as const

export type EvidenceField = (typeof EVIDENCE_FIELDS)[number]
export type EvidenceForm = Record<EvidenceField, string>

export type EvidenceCheck = {
  /** ما يُرسَل إلى الخادم — مطبَّعا، والمردودُ يبقى كما كُتب ليُصلحه صاحبُه */
  normalized: EvidenceForm
  /** كم دليلا صالحا — و«رابطٌ واحدٌ على الأقلّ» يُقاس به */
  count: number
  /** أسماءُ الحقول التي لا تصحّ — ليُقال أين الخطأ لا أنّ ثمّة خطأ */
  rejected: EvidenceField[]
}

export function checkEvidenceLinks(form: Partial<EvidenceForm>): EvidenceCheck {
  const normalized = {} as EvidenceForm
  const rejected: EvidenceField[] = []
  let count = 0

  for (const field of EVIDENCE_FIELDS) {
    const written = form[field] ?? ''
    const r = normalizeApplicantLink(written)
    if (r.ok) {
      normalized[field] = r.url
      if (r.url) count += 1
    } else {
      normalized[field] = written.trim()
      rejected.push(field)
    }
  }

  return { normalized, count, rejected }
}
