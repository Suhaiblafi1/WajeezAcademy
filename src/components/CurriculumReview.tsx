/* المنهجُ كاملا — صفحةٌ واحدةٌ يقرؤها المدرّبُ قبل الإرسال والمعتمِدُ قبل القرار.

   «صفحةٌ توضح كلَّ ما كتبه بالترتيب… وكأنّها منهجٌ متكاملٌ لدورته من الألف إلى
   الياء، يقرؤه فتلهمه أيَّ تعديلات فيعود للتعديل بالمراحل السابقة — وهو ما سنقرؤه
   عند الموافقة» (صاحب المنصّة، ٢٧ سبتمبر ٢٠٢٦).

   فالترتيبُ ترتيبُ المنهج: الأساسيّاتُ، ثمّ لكلّ موعدٍ محاورُه ومتونُها وكرّاستُه
   ولقاءاتُه وتسجيلاتُه ومهامُّه ومصادرُه، ثمّ ما للشعبة كلِّها. والبناءُ محضٌ في
   `application/trainer/curriculum-view.ts`، وهنا عرضُه وحدَه. و`onEdit` للمدرّب:
   زرٌّ في كلّ قسمٍ يعيده إلى خطوته. والمعتمِدُ يقرأ ولا يعدّل. */

import type { ReactNode } from 'react'
import { BookMarked, CalendarDays, FileText, Library, Pencil, PlayCircle, Send } from 'lucide-react'
import { Card, Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { RESOURCE_META } from '@/components/resource-kind-meta'
import { dayLabelAr } from '@/application/trainer/axis-timeline'
import { whenAr } from '@/application/learning/cohort-gate'
import { resourceKind } from '@/application/trainer/plan-overlay'
import type {
  CurriculumMeeting, CurriculumResource, CurriculumTask, CurriculumView,
} from '@/application/trainer/curriculum-view'
import type { ReviewSection } from '@/application/trainer/review-notes'

/** الخطوةُ التي يعود إليها المدرّبُ ليعدّل ما قرأه — وهي أقسامُ ملاحظات المعتمِد نفسُها */
export type CurriculumEditStage = ReviewSection

const TASK_TYPE: Record<string, string> = { assignment: 'واجب', quiz: 'اختبار', project: 'مشروع' }
/* ومهامُّ ما بعد الاعتماد بما ينتظر فيها (٣ج-٣) — والمعدَّلةُ مقروءةٌ بقيمها المقترَحة */
const TASK_REVIEW: Record<NonNullable<CurriculumTask['review']>, string> = {
  new: 'جديدةٌ — تنتظر الاعتماد',
  edit: 'معدَّلةٌ — تنتظر الاعتماد',
  remove: 'تُحذف باعتمادها',
}
const MEETING_STATE: Record<CurriculumMeeting['state'], { label: string; tone: 'positive' | 'warn' | 'neutral' }> = {
  approved: { label: 'معتمَد', tone: 'positive' },
  pending: { label: 'بانتظار الاعتماد', tone: 'warn' },
  held: { label: 'انعقد', tone: 'neutral' },
}

const fileHref = (key: string) => `/api/v1/cohort-files/${encodeURIComponent(key)}`

function EditLink({ stage, onEdit, label }: { stage: CurriculumEditStage; onEdit?: (s: CurriculumEditStage) => void; label: string }) {
  if (!onEdit) return null
  return (
    <Button tone="ghost" size="sm" icon={Pencil} onClick={() => onEdit(stage)} aria-label={`عدّل ${label}`}>
      عدّل
    </Button>
  )
}

function Meetings({ list }: { list: CurriculumMeeting[] }) {
  return (
    <ul className="space-y-1.5">
      {list.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-read leading-6">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
          <span className="font-bold text-foreground">{m.title}</span>
          <span className="text-muted-foreground">· {whenAr(m.startsAt)}</span>
          {m.axes.length > 1 && <span className="text-muted-foreground">· للمحور {m.axes.join(' و')}</span>}
          <Chip tone={MEETING_STATE[m.state].tone}>{MEETING_STATE[m.state].label}</Chip>
        </li>
      ))}
    </ul>
  )
}

function Tasks({ list }: { list: CurriculumTask[] }) {
  return (
    <ul className="space-y-2">
      {list.map((t) => (
        <li key={t.id} className="text-read leading-6">
          <p className="flex flex-wrap items-center gap-x-2">
            <Send className="h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
            <span className={`font-bold text-foreground${t.review === 'remove' ? ' line-through' : ''}`}>{t.title}</span>
            {t.review && <Chip tone="warn">{TASK_REVIEW[t.review]}</Chip>}
            <span className="text-muted-foreground">
              · {TASK_TYPE[t.type] ?? t.type}
              {t.dueAt ? ` · آخرُ موعدها ${whenAr(t.dueAt)}` : ' · بلا آخرِ موعد'}
              {t.attachments > 0 ? ` · ${t.attachments} مرفق` : ''}
            </span>
          </p>
          {t.briefAr
            ? <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{t.briefAr}</p>
            : <p className="mt-0.5 text-gold-ink">بلا تعليمات — ما المطلوبُ من المتعلّم؟</p>}
        </li>
      ))}
    </ul>
  )
}

function Resources({ list }: { list: CurriculumResource[] }) {
  return (
    <ul className="space-y-1.5">
      {list.map((r, i) => {
        const meta = RESOURCE_META[resourceKind(r.kind)]
        const href = r.fileKey ? fileHref(r.fileKey) : r.url
        return (
          <li key={`${r.title}-${i}`} className="flex flex-wrap items-center gap-x-2 text-read leading-6">
            <meta.icon className="h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
            {href
              ? <a href={href} target="_blank" rel="noreferrer" className="font-bold text-foreground underline-offset-2 hover:underline">{r.title}</a>
              : <span className="font-bold text-foreground">{r.title}</span>}
            <span className="text-muted-foreground">· {meta.label}{r.preReading ? ' · قراءةٌ مسبقةٌ مع الكرّاسة' : ''}</span>
            {r.noteAr && <span className="basis-full text-muted-foreground">{r.noteAr}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 text-read font-bold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export default function CurriculumReview({
  view,
  onEdit,
}: {
  view: CurriculumView
  /** للمدرّب وحدَه — يعيده إلى الخطوة التي فيها ما يقرؤه */
  onEdit?: (stage: CurriculumEditStage) => void
}) {
  const { counts } = view
  return (
    <div className="space-y-3">
      {/* ── الأساسيّات ── */}
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-black leading-snug">{view.title}</h3>
            <p className="mt-0.5 text-read text-muted-foreground">
              {view.period ? `من ${dayLabelAr(view.period.startsOn)} إلى ${dayLabelAr(view.period.endsOn)}` : 'بلا مدّةٍ محدّدة بعد'}
              {` · ${counts.axes} محاور · ${counts.meetings} لقاءات · ${counts.tasks} مهامّ · ${counts.resources + counts.recordings} مصادر`}
            </p>
          </div>
          <EditLink stage="identity" onEdit={onEdit} label="المعلومات الأساسيّة" />
        </div>
        {view.summaryAr
          ? <p className="mt-2 whitespace-pre-line text-read leading-7 text-foreground">{view.summaryAr}</p>
          : <p className="mt-2 text-read text-gold-ink">بلا نبذة — هي أوّلُ ما يقرؤه المتعلّمُ عن الشعبة.</p>}
        {/* مستوى الشعبة (٦ أكتوبر ٢٠٢٦) — يقرؤه المدرّبُ والمعتمِدُ هنا، ولا يصل المتعلّمَ بعد */}
        <p className="mt-2 text-read leading-6 text-muted-foreground">
          المستوى: {view.levelAr ? <b className="text-foreground">{view.levelAr}</b> : 'لم يُحدَّد'}
        </p>
        {/* كرّاسةُ الدورة الواحدة (٣٠ سبتمبر ٢٠٢٦) — تُقرأ مرّةً هنا، وموضعُ كلّ محورٍ فيها في موعده */}
        {view.bySlot && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
            <p className="flex items-center gap-1.5 text-read">
              <BookMarked className="h-3.5 w-3.5 text-teal-light-ink" aria-hidden="true" />
              <span className="font-bold">كرّاسةُ الدورة:</span>{' '}
              {view.workbook ? (
                <a
                  href={view.workbook.fileKey ? fileHref(view.workbook.fileKey) : view.workbook.url ?? '#'}
                  target="_blank" rel="noreferrer"
                  className="font-bold text-foreground hover:underline"
                >
                  {view.workbook.title ?? view.workbook.fileName ?? 'كرّاسةُ الدورة'}
                </a>
              ) : (
                <span className="text-gold-ink">لم تُوضع بعد.</span>
              )}
            </p>
            <EditLink stage="workbooks" onEdit={onEdit} label="كرّاسة الدورة" />
          </div>
        )}
      </Card>

      {/* ── المواعيدُ بالترتيب ── */}
      {view.groups.map((g, gi) => (
        <Card key={g.key} as="section" className="p-4" aria-label={g.label}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-read font-black text-foreground">
              {view.bySlot && g.startsOn ? `الموعد ${gi + 1} · ` : ''}{g.label}
              {g.startsOn && g.endsOn && (
                <span className="font-bold text-muted-foreground"> · {dayLabelAr(g.startsOn)} – {dayLabelAr(g.endsOn)}</span>
              )}
            </h4>
            <EditLink stage="modules" onEdit={onEdit} label={`محاور ${g.label}`} />
          </div>

          {g.axes.map((a) => (
            <Inset key={a.moduleId} className="mt-2 p-3">
              <p className="text-read font-bold text-foreground">المحور {a.n}: {a.title}</p>
              {a.outcome && <p className="mt-0.5 text-read text-muted-foreground"><b className="text-foreground">ما يخرج به: </b>{a.outcome}</p>}
              {a.activity && <p className="mt-0.5 text-read text-muted-foreground"><b className="text-foreground">التطبيقُ العمليّ: </b>{a.activity}</p>}
              {a.artifact && <p className="mt-0.5 text-read text-muted-foreground"><b className="text-foreground">الناتج: </b>{a.artifact}</p>}
              {a.body ? (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-read font-bold text-teal-light-ink">المتنُ النظريّ · {a.bodyWords} كلمة</summary>
                  <p className="mt-1 whitespace-pre-line text-read leading-7 text-foreground">{a.body}</p>
                </details>
              ) : a.bodyFile ? (
                <p className="mt-1.5 text-read">
                  <a href={fileHref(a.bodyFile.key)} target="_blank" rel="noreferrer" className="font-bold text-teal-light-ink hover:underline">
                    المتنُ النظريُّ ملفّا: {a.bodyFile.name ?? 'ملفّ المحور'}
                  </a>
                </p>
              ) : (
                <p className="mt-1.5 text-read text-gold-ink">بلا متنٍ نظريّ بعد.</p>
              )}
            </Inset>
          ))}

          {view.bySlot && g.startsOn && view.workbook && (
            <Section title="في كرّاسة الدورة" icon={BookMarked}>
              <p className="text-read leading-6">
                {g.axes.map((a) => (
                  <span key={a.moduleId} className="me-3 inline-block">
                    <b>المحور {a.n}</b>{' '}
                    {a.workbookWhere ?? <span className="text-gold-ink">بلا موضع</span>}
                  </span>
                ))}
              </p>
            </Section>
          )}
          {/* وكرّاسةُ الموعد — لما اعتُمد قبل الكرّاسة الواحدة */}
          {view.bySlot && g.startsOn && !view.workbook && g.workbook && (
            <Section title="الكرّاسة" icon={BookMarked}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {g.workbook ? (
                  <a
                    href={g.workbook.fileKey ? fileHref(g.workbook.fileKey) : g.workbook.url ?? '#'}
                    target="_blank" rel="noreferrer"
                    className="text-read font-bold text-foreground hover:underline"
                  >
                    {g.workbook.title ?? g.workbook.fileName ?? 'كرّاسةُ الموعد'}
                  </a>
                ) : (
                  <span className="text-read text-gold-ink">بلا كرّاسة.</span>
                )}
                <EditLink stage="workbooks" onEdit={onEdit} label={`كرّاسة ${g.label}`} />
              </div>
            </Section>
          )}

          <Section title="اللقاءاتُ المباشرة" icon={CalendarDays}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              {g.meetings.length > 0 ? <Meetings list={g.meetings} /> : <span className="text-read text-gold-ink">بلا لقاءٍ مباشر.</span>}
              <EditLink stage="sessions" onEdit={onEdit} label={`لقاءات ${g.label}`} />
            </div>
          </Section>

          {g.recordings.length > 0 && (
            <Section title="الجلساتُ المسجّلة" icon={PlayCircle}>
              <ul className="space-y-1.5">
                {g.recordings.map((r, i) => (
                  <li key={`${r.title}-${i}`} className="text-read leading-6">
                    <span className="font-bold text-foreground">{r.title}</span>
                    <span className="text-muted-foreground">{r.opensAt ? ` · تُفتح ${whenAr(r.opensAt)}` : ' · بلا موعدِ فتح'}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="المهامُّ التطبيقيّة" icon={Send}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              {g.tasks.length > 0 ? <Tasks list={g.tasks} /> : <span className="text-read text-muted-foreground">بلا مهمّةٍ على هذا الموعد.</span>}
              <EditLink stage="assignments" onEdit={onEdit} label={`مهامّ ${g.label}`} />
            </div>
          </Section>

          {g.resources.length > 0 && (
            <Section title="المصادر" icon={Library}>
              <Resources list={g.resources} />
            </Section>
          )}
        </Card>
      ))}

      {/* ── وما للشعبة كلِّها ── */}
      {(view.general.meetings.length > 0 || view.general.tasks.length > 0 || view.general.resources.length > 0) && (
        <Card as="section" className="p-4" aria-label="للشعبة كلِّها">
          <h4 className="text-read font-black text-foreground">للشعبة كلِّها — بلا محور</h4>
          {view.general.meetings.length > 0 && (
            <Section title="لقاءاتٌ غيرُ مربوطةٍ بمحور" icon={CalendarDays}><Meetings list={view.general.meetings} /></Section>
          )}
          {view.general.tasks.length > 0 && (
            <Section title="مهامُّ غيرُ مربوطةٍ بمحور" icon={Send}><Tasks list={view.general.tasks} /></Section>
          )}
          {view.general.resources.length > 0 && (
            <Section title="مصادرُ للشعبة كلِّها" icon={Library}><Resources list={view.general.resources} /></Section>
          )}
        </Card>
      )}
    </div>
  )
}
