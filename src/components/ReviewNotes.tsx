/* ملاحظاتُ المعتمِد القديمة — تُقرأ مجموعةً في بطاقته، وكلٌّ في رأس خطوتها عند المدرّب (٣ب).

   وكان هنا نموذجُ كتابتها (حقلٌ لكلّ خطوة) ولاصقتُها في شريط المدرّب. ثمّ صار الردُّ بطاقاتِ «قبل/بعد» وحدَها
   (قرارُ صاحب المنصّة، ١٣ أكتوبر ٢٠٢٦: «No text notes»)، فلم يبقَ للنموذج ولا للّاصقة موضعٌ يعرضهما — وذهبا
   (٢٧ أكتوبر ٢٠٢٦، المرحلة الثامنة). وما كُتب قبل ذلك يُقرأ هنا كما كُتب.

   والقاعدةُ (الأسماءُ والتشذيبُ) من `application/trainer/review-notes.ts` — التي يحتجّ بها الخادم. */

import { Inset } from '@/components/ui/Surface'
import { REVIEW_SECTIONS, STAGE_LABELS, type ReviewNotes, type ReviewSection } from '@/application/trainer/review-notes'
import { NoteBody } from './LongText'

/** الملاحظاتُ مقروءةً — العامّةُ أوّلا ثمّ كلُّ خطوةٍ باسمها بترتيب الشريط */
export function ReviewNotesList({ notes }: { notes: ReviewNotes }) {
  return (
    <dl className="mt-1 space-y-2 text-read leading-7">
      {notes.general && (
        <div>
          <dt className="font-bold text-foreground">عامّة</dt>
          <dd className="whitespace-pre-line text-foreground">{notes.general}</dd>
        </div>
      )}
      {REVIEW_SECTIONS.filter((s) => notes[s.key]).map((s) => (
        <div key={s.key}>
          <dt className="font-bold text-foreground">{s.label}</dt>
          <dd className="whitespace-pre-line text-foreground">{notes[s.key]}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ═══ وعند المدرّب — الملاحظةُ في رأس خطوتها ═══

   ونصُّها في رأس الخطوة نفسِها، حيث يُعدَّل ما قيل فيها. */
export function StageReviewNote({ stage, text }: { stage: ReviewSection; text: string | undefined }) {
  if (!text) return null
  return (
    <Inset tone="warn" className="mb-4" role="note" aria-label={`ملاحظة الإدارة على «${STAGE_LABELS[stage]}»`}>
      <p className="text-read font-black text-gold-ink">ملاحظة الإدارة على هذه الخطوة</p>
      {/* نقطةً نقطة، والنواقصُ محورا محورا — لا سطرا واحدا مكتظّا (١١ أكتوبر ٢٠٢٦، `LongText.tsx`) */}
      <div className="mt-2"><NoteBody text={text} /></div>
    </Inset>
  )
}
