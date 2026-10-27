/* طلبُ التغيير كما يُقرأ في طابوره (٢٦ أكتوبر ٢٠٢٦، المرحلة الثامنة).

   كان البندُ «دورة · C-MKT-104» وعددَ قراراته، والحمولةُ لا تُعرض: المراجعُ يعتمد ما لا يراه. وكان زرُّه الثاني
   «طلب تعديل» بملاحظةٍ ثابتة («راجع التفاصيل») لا يُعدَّل الطلبُ بعدها، فيبقى معلّقا. فصار لكلّ طلبٍ ما يطلبه
   بكلمات، وما يقع إن اعتُمد — وبجانبه «اعتمد» و«ارفض» (قرارُ صاحب المنصّة، ٢ أكتوبر: الخياراتُ وأثرُ كلٍّ).

   والأصنافُ ما تكتبه المنصّةُ اليوم: اسمُ دورة (`course_rename` — من «أسماء الدورات» ومن «اسمها» في قائمة
   الدورات)، ومهارةٌ تُطلب (`skill_request` — من محرّر المهارات)، ومسارٌ جديد (`action: 'create'` — من معالج
   المسار). وما قبلها يُقرأ ولا يُكتب بعد: صندوقُ JSON (`{ titleAr }` وغيرُه)، واقتراحاتُ المدرّبين القديمة.

   وما يقع إن اعتُمد يقوله الخادمُ لا هذا الملفّ (`decide` و`promoteEntity` في `catalog-admin.service.ts`):
   الاسمُ يُكتب ويُنشر، والمسودّةُ وحدَها تُجهَّز للنشر، وما سواها يبقى كما هو. وهنا قراءتُه بكلمات. */

import { carriesExampleTitle } from './change-request-example'

export type ChangeRequestLike = {
  entityType: string
  entityId: string
  payload?: Record<string, unknown> | null
  /** اسمُ ما يُطلب كما هو الآن — من الخادم؛ ولا اسمَ لما لم يولد */
  entityLabelAr?: string | null
  /** حالتُه الآن — والمسودّةُ وحدَها يرفعها الاعتماد */
  entityStatus?: string | null
}

export type ChangeRequestView = {
  /** ما يُطلب، بكلمتين */
  kindAr: string
  /** على أيّ شيء — اسمُه لا معرّفُه */
  subjectAr: string
  /** تفاصيلُه سطرا سطرا */
  lines: string[]
  /** ما يقع إن اعتُمد */
  approveAr: string
  /** لماذا لا يُعتمد — والردُّ متاح */
  blockedAr: string | null
  /** الاسمُ الذي يُكتب إن اعتُمد — لرسالة ما بعده */
  renameTo: string | null
}

/** ما يقع إن رُدّ — في كلّ صنف */
export const REJECT_AR = 'لا يتغير شيء.'

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const count = (v: unknown): number => (Array.isArray(v) ? v.length : 0)

/** والمسودّةُ تُجهَّز للنشر — وغيرُها لا يمسّه الاعتماد */
const readyAr = (status: string | null | undefined): string | null =>
  status === 'draft' ? 'تجهز المسودة للنشر وتظهر مع النشر التالي.' : null

export function changeRequestView(cr: ChangeRequestLike): ChangeRequestView {
  const p = cr.payload ?? {}
  const kind = text(p.kind)
  const label = cr.entityLabelAr ?? cr.entityId
  const blockedAr = carriesExampleTitle(p) ? '«الاسم الجديد» مثال وليس اسما. ارفضه.' : null
  const base = { blockedAr, renameTo: null }

  /* اسمُ دورة — والطلبُ العامُّ `{ titleAr }` يكتب الاسمَ مثله (`renameTitleOf`)، ويرفع المسودّةَ معه */
  const titleAr = text(p.titleAr)
  if (cr.entityType === 'course' && titleAr && (kind === null || kind === 'course_rename')) {
    const ready = kind === null ? readyAr(cr.entityStatus) : null
    return {
      ...base,
      kindAr: 'اسم دورة',
      subjectAr: label,
      lines: [`الاسم الجديد: «${titleAr}»`],
      /* ودورةٌ لا صفَّ لها لا اسمَ يُكتب لها — فلا يُوعد بما لا يقع */
      approveAr: cr.entityStatus == null
        ? 'لا دورة بهذا الرمز. الاعتماد قرار فقط.'
        : ['يتغير اسمها في الموقع الآن.', ready].filter(Boolean).join(' '),
      renameTo: cr.entityStatus == null ? null : titleAr,
    }
  }

  /* مهارةٌ طُلب ميلادُها — والاعتمادُ قرارٌ لا ينشئها: تولد من «مهارة جديدة» حيث تُكتب عائلتُها */
  if (kind === 'skill_request') {
    const slug = text(p.slug) ?? cr.entityId
    const reason = text(p.reasonAr)
    return {
      ...base,
      kindAr: 'مهارة جديدة',
      subjectAr: text(p.nameAr) ?? slug,
      lines: [`رمزها: ${slug}`, ...(reason ? [`السبب: ${reason}`] : [])],
      approveAr: cr.entityStatus == null
        ? 'لا ينشئها. تنشأ بعده من «مهارة جديدة» في هذه الصفحة.'
        : readyAr(cr.entityStatus) ?? 'هي موجودة الآن، ولا تتغير حالتها.',
    }
  }

  /* مسارٌ من معالجه — وُلد مسودّةً، والاعتمادُ يجهّزه للنشر */
  if (cr.entityType === 'pathway' && text(p.action) === 'create') {
    return {
      ...base,
      kindAr: 'مسار جديد',
      subjectAr: label,
      lines: [`دوراته: ${count(p.courseIds)} · أهدافه: ${count(p.goals)} · شخصياته: ${count(p.personas)}`],
      approveAr: readyAr(cr.entityStatus) ?? 'لا تتغير حالته.',
    }
  }

  /* اقتراحاتُ المدرّبين القديمة — لا يكتبها شيءٌ اليوم، وقد يبقى منها في الطابور */
  if (kind === 'trainer_new_course' || kind === 'trainer_course_variant') {
    const from = (p.fromApplication ?? {}) as { fullName?: unknown; reference?: unknown }
    const who = text(from.fullName)
    const ref = text(from.reference)
    const words = text(p.trainerWordsAr)
    const note = text(p.noteAr)
    const skills = Array.isArray(p.skillIds) ? p.skillIds.filter((s): s is string => typeof s === 'string') : []
    return {
      ...base,
      kindAr: kind === 'trainer_new_course' ? 'دورة مقترحة' : 'نسخة مقترحة من دورة',
      subjectAr: kind === 'trainer_new_course' ? titleAr ?? cr.entityId : label,
      lines: [
        ...(who ? [`اقترحها ${who}${ref ? ` (${ref})` : ''}`] : []),
        ...(skills.length > 0 ? [`مهاراتها: ${skills.join(' · ')}`] : []),
        ...(words ? [`بقلمه: ${words}`] : []),
        ...(note ? [`ملاحظة المراجع: ${note}`] : []),
      ],
      approveAr: readyAr(cr.entityStatus) ?? 'قرار فقط. لا ينشئ دورة.',
    }
  }

  /* وما سواها طلبٌ من صندوق JSON: لا يطبّق الاعتمادُ شيئا من حقوله — ويُقال ذلك قبل أن يُضغط */
  const fields = Object.keys(p).filter((k) => k !== 'kind')
  return {
    ...base,
    kindAr: 'طلب قديم',
    subjectAr: label,
    lines: fields.length > 0 ? [`حقوله: ${fields.join('، ')}`] : [],
    approveAr: [readyAr(cr.entityStatus), 'لا يطبق شيئا من حقوله.'].filter(Boolean).join(' '),
  }
}
