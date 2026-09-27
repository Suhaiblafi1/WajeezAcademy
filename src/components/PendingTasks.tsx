/* ═══ مهامُّ تنتظر قرارك — بعد اعتماد خطّة المدرّب (٣ج-٣) ═══

   «وبعد الاعتماد كلُّ تغييرٍ باعتماد». فما يضيفه المدرّبُ أو يعدّله أو يحذفه من
   مهامّه بعد الاعتماد لا يصل المتعلّمين حتّى يُقرَّر هنا. والمعدَّلةُ تُقرأ بما
   تغيّر فيها سطرا سطرا («العنوان: قديم ← جديد») — لا بنسختين تُقارَنان بالعين،
   فيفوت المعتمِدَ موعدٌ تقدّم يومين في آخر السطر.

   والقاعدةُ — ما ينتظر، وما تغيّر، وكيف يُقال — في
   `application/trainer/task-approval.ts`، التي يحكم بها الخادم. */

import { useState } from 'react'
import { Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import { staffAreaCls } from '@/components/FormKit'
import { fmtDateTimeAr } from '@/utils/format'
import {
  TASK_REVIEW_ADMIN_AR, changeLines, formatTaskValue, readTaskChange, taskReview, taskValues,
  type TaskReview, type TaskValueFormat,
} from '@/application/trainer/task-approval'

export interface PendingTaskRow {
  id: string
  title: string
  type: string
  status?: string | null
  maxScore?: number | null
  dueAt?: string | Date | null
  moduleId?: string | null
  briefAr?: string | null
  attachments?: unknown
  pendingChange?: unknown
  reviewerNote?: string | null
}

const TYPE_AR: Record<string, string> = { assignment: 'واجب', quiz: 'اختبار', project: 'مشروع' }

/* ما يُعرض هنا ينتظر قرارا (`awaitingTasks`) — فيُقرأ بعد الاعتماد */
const reviewOf = (r: PendingTaskRow): TaskReview =>
  taskReview({ status: r.status ?? 'published', pendingChange: r.pendingChange, reviewerNote: r.reviewerNote }, true)

const APPROVE_LABEL: Partial<Record<TaskReview, string>> = {
  new: 'اعتمِدها', edit: 'اعتمِد التعديل', remove: 'اعتمِد الحذف',
}

export function PendingTasks({ tasks, axisNo, busy, onDecide }: {
  tasks: PendingTaskRow[]
  /** رقمُ كلّ محورٍ في ترتيب الخطّة — «المحور ٣» */
  axisNo: ReadonlyMap<string, number>
  busy: boolean
  onDecide: (id: string, approve: boolean, note?: string) => Promise<boolean>
}) {
  const [declining, setDeclining] = useState<{ id: string; note: string } | null>(null)
  if (tasks.length === 0) return null
  const fmt: TaskValueFormat = {
    type: (t) => TYPE_AR[t] ?? t,
    date: (v) => fmtDateTimeAr(v),
    axis: (id) => (axisNo.has(id) ? `المحور ${axisNo.get(id)}` : 'محورٌ خارجَ الخطّة'),
  }
  return (
    <div className="mt-4 border-t border-white/10 pt-4" role="region" aria-label="مهامُّ تنتظر قرارك">
      <p className="text-read font-black text-foreground">مهامُّ تنتظر قرارك ({tasks.length})</p>
      <p className="mt-1 text-read leading-6 text-muted-foreground">
        أضافها المدرّبُ أو طلب تعديلَها أو حذفَها بعد اعتماد خطّته — ولا يرى المتعلّمون شيئا منها حتّى تعتمده،
        ويبقون على المعتمَد. واعتمادُ مراجعةٍ للخطّة يعتمدها معها.
      </p>
      <ul className="mt-3 space-y-2">
        {tasks.map((t) => {
          const review = reviewOf(t)
          const live = taskValues({ ...t, maxScore: t.maxScore ?? 0 })
          const lines = changeLines(live, readTaskChange(t.pendingChange), fmt)
          return (
            <Inset as="li" key={t.id}>
              <p className="flex flex-wrap items-center gap-2">
                <Chip tone="warn">{TASK_REVIEW_ADMIN_AR[review]}</Chip>
                <span className={`text-read font-bold text-foreground${review === 'remove' ? ' line-through' : ''}`}>{t.title}</span>
              </p>
              <p className="mt-1 text-read text-muted-foreground">
                {formatTaskValue('type', live.type, fmt)}
                {live.moduleId && <> · {formatTaskValue('moduleId', live.moduleId, fmt)}</>}
                {' · '}{live.dueAt ? `آخرُ موعدها ${fmt.date(live.dueAt)}` : 'بلا آخرِ موعد'}
              </p>
              {review === 'new' && (
                <p className="mt-1 whitespace-pre-line text-read leading-6 text-muted-foreground">{formatTaskValue('briefAr', live.briefAr, fmt)}</p>
              )}
              {lines.length > 0 && (
                <dl className="mt-2 space-y-1 text-read leading-6" aria-label="ما يتغيّر باعتمادك">
                  {lines.map((l) => (
                    <div key={l.field} className="flex flex-wrap gap-x-1.5">
                      <dt className="font-bold text-foreground">{l.label}:</dt>
                      <dd className="text-muted-foreground"><s>{l.before}</s> ← <span className="text-foreground">{l.after}</span></dd>
                    </div>
                  ))}
                </dl>
              )}
              {review === 'remove' && (
                <p className="mt-1 text-read leading-6 text-muted-foreground">يطلب حذفَها — وتبقى عند المتعلّمين حتّى تعتمد حذفَها.</p>
              )}
              {declining?.id === t.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={declining.note}
                    aria-label={`سببُ ردّ «${t.title}»`}
                    onChange={(e) => setDeclining({ id: t.id, note: e.target.value })}
                    placeholder="لماذا تردّه؟ يصل المدرّبَ بنصّه."
                    className={staffAreaCls}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      tone="danger" size="sm" disabled={busy || !declining.note.trim()}
                      onClick={() => void onDecide(t.id, false, declining.note.trim()).then((ok) => { if (ok) setDeclining(null) })}
                    >
                      أرسِل الردّ
                    </Button>
                    <Button tone="ghost" size="sm" disabled={busy} onClick={() => setDeclining(null)}>تراجَع</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button tone="confirm" size="sm" disabled={busy} onClick={() => void onDecide(t.id, true)}>
                    {APPROVE_LABEL[review] ?? 'اعتمِدها'}
                  </Button>
                  <Button tone="danger" size="sm" disabled={busy} onClick={() => setDeclining({ id: t.id, note: '' })}>
                    ردَّه
                  </Button>
                </div>
              )}
            </Inset>
          )
        })}
      </ul>
    </div>
  )
}
