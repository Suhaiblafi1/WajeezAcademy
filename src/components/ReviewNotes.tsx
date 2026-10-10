/* ملاحظاتُ المعتمِد — يكتبها لكلّ خطوةٍ تحت اسمها، ويقرؤها مجموعةً في بطاقته (٣ب).

   كان «اطلب تعديلات» صندوقَ `window.prompt` بسطرٍ واحد: «ما الذي يُعدَّل؟».
   والمنهجُ الذي قُرئ قبله خمسُ خطوات — فيُكتب فيه كلُّ شيءٍ سطرا واحدا بلا
   فواصل، ولا يُرى منه عند الكتابة إلّا آخرُه، ويصل المدرّبَ فقرةً لا يدري
   أيُّ خطوةٍ تعنيها كلُّ جملة. فصار نموذجا في موضعه: حقلٌ لكلّ خطوةٍ باسمها
   في شريط المدرّب، وحقلٌ عامٌّ لما لا خطوةَ له. وما تُرك فارغا لا يُرسَل.

   والقاعدةُ (الأسماءُ والتشذيبُ و«ملاحظةٌ واحدةٌ على الأقلّ») من
   `application/trainer/review-notes.ts` — التي يحتجّ بها الخادم. */

import { useState } from 'react'
import { Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import { StaffField, staffAreaCls } from '@/components/FormKit'
import {
  REVIEW_NOTE_MAX, REVIEW_SECTIONS, STAGE_LABELS, hasReviewNotes, normalizeReviewNotes, notedSections,
  type ReviewNotes, type ReviewSection,
} from '@/application/trainer/review-notes'

export function ReviewNotesForm({ busy, onSend, onCancel, initial, editsPending = 0 }: {
  busy: boolean
  onSend: (notes: ReviewNotes) => void
  onCancel: () => void
  /** ما يُبدأ به — ما سقط من بطاقة المعايير (`scorecardNotes`)، يُعدَّل قبل الإرسال */
  initial?: ReviewNotes
  /** تعديلاتٌ مقترحةٌ رُفعت تنتظره — تكفي سببا للردّ بلا ملاحظة (٨ أكتوبر ٢٠٢٦) */
  editsPending?: number
}) {
  const [draft, setDraft] = useState<ReviewNotes>(initial ?? {})
  const clean = normalizeReviewNotes(draft)
  const ready = hasReviewNotes(clean) || editsPending > 0
  const area = (key: keyof ReviewNotes, rows: number, placeholder: string) => (
    <textarea
      rows={rows}
      maxLength={REVIEW_NOTE_MAX}
      value={draft[key] ?? ''}
      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      placeholder={placeholder}
      className={staffAreaCls}
    />
  )
  return (
    <Inset tone="warn" className="mt-3" role="group" aria-label="ملاحظاتُ الردّ لكلّ خطوة">
      <p className="text-read font-black text-gold-ink">ما الذي يُعدَّل؟</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        اكتب كلَّ ملاحظةٍ في الخطوة التي تُعدَّل فيها — يقرؤها المدرّبُ في رأس تلك الخطوة حين يفتحها، ويرى
        في شريطه أيَّ الخطوات عليها ملاحظة. وما لا خطوةَ له فهو للعامّة. واترك الباقي فارغا.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <StaffField wide label="ملاحظةٌ عامّة" hint="تُقرأ في رأس شاشته أيًّا كانت الخطوة.">
          {area('general', 2, 'مثلا: المنهجُ متماسك — بقي ما في الخطوات أدناه.')}
        </StaffField>
        {REVIEW_SECTIONS.map((s) => (
          <StaffField key={s.key} label={s.label}>
            {area(s.key, 2, 'فارغةٌ إن لم يكن عليها شيء')}
          </StaffField>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="danger" size="sm" disabled={busy || !ready} onClick={() => onSend(clean)}>
          أرسِلها إليه
        </Button>
        <Button tone="ghost" size="sm" disabled={busy} onClick={onCancel}>
          تراجَع
        </Button>
        {!ready && <span className="text-read text-muted-foreground">اكتب ملاحظةً واحدةً على الأقلّ.</span>}
        {ready && !hasReviewNotes(clean) && (
          <span className="text-read text-muted-foreground">بلا ملاحظة: تكفي التعديلاتُ المقترحة ({editsPending}) سببا، ويقرأ سطرَها في رأس شاشته.</span>
        )}
      </div>
    </Inset>
  )
}

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

/* ═══ وعند المدرّب — اللاصقةُ في شريطه، والملاحظةُ في رأس خطوتها ═══

   العامّةُ بنصّها في الشريط اللاصق، يقرؤها وهو ينزل ويصعد. وملاحظاتُ الخطوات
   أسماءُ خطواتها هناك — كلٌّ زرٌّ يفتح خطوتَه — ونصُّها في رأس الخطوة نفسِها،
   حيث يُعدَّل ما قيل فيها. */
export function ReviewNotesBanner({ notes, current, onOpen }: {
  notes: ReviewNotes
  /** الخطوةُ المفتوحةُ الآن — يُعلَّم زرُّها */
  current?: string | null
  onOpen: (stage: ReviewSection) => void
}) {
  const noted = notedSections(notes)
  if (!notes.general && noted.length === 0) return null
  return (
    <Inset tone="warn" className="mt-2">
      <p className="text-read font-black text-gold-ink">ملاحظةُ الإدارة</p>
      {notes.general && (
        <p className="mt-1 whitespace-pre-line text-read leading-7 text-foreground">{notes.general}</p>
      )}
      {noted.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-read text-muted-foreground">{notes.general ? 'وعلى خطوات:' : 'على خطوات:'}</span>
          {noted.map((k) => (
            <Button key={k} tone="ghost" size="sm" onClick={() => onOpen(k)} aria-current={current === k ? 'true' : undefined}>
              {STAGE_LABELS[k]}
            </Button>
          ))}
        </div>
      )}
    </Inset>
  )
}

export function StageReviewNote({ stage, text }: { stage: ReviewSection; text: string | undefined }) {
  if (!text) return null
  return (
    <Inset tone="warn" className="mb-4" role="note" aria-label={`ملاحظةُ الإدارة على «${STAGE_LABELS[stage]}»`}>
      <p className="text-read font-black text-gold-ink">ملاحظةُ الإدارة على هذه الخطوة</p>
      <p className="mt-1 whitespace-pre-line text-read leading-7 text-foreground">{text}</p>
    </Inset>
  )
}
