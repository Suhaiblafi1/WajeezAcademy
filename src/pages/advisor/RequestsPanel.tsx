/* ما لا يملكه المستشار وحده — يُطلب هنا لا في واتساب.

   كان المستشار إذا احتاج خصما ليُغلق بيعا، أو أراد إضافة دورةٍ إلى خطّة
   طالبٍ أو إلغاءها، خرج بالطلب من المنصّة: رسالةٌ إلى الإدارة تُنسى ولا
   تُتتبَّع ولا تُدقَّق. ولا يعرف أحدٌ بعد شهرٍ كم خصما أُعطي ولا لماذا.

   فصار الطلبُ هنا: سببٌ إلزاميّ يُقرأ، وحالةٌ تُرى، وقرارٌ يعود بسببه.
   والاعتمادُ يُنتج كوبونا مقصورا على هذا العميل — يُنسخ ويُرسل إليه. */

import { useCallback, useEffect, useState } from 'react'
import { BadgePercent, Check, Copy, Loader2, Plus, X } from 'lucide-react'
import { apiGet, apiPost, ApiError } from '@/services/api'
import { courseById, courses } from '@/data/courses'
import { controlCls, areaCls, Field, FieldRow } from '@/components/FormKit'
import { LEDGER_CURRENCY } from "@/application/commerce/presentment"
import { toast, toastError } from '@/components/Toast'

/** أعلى نسبةٍ يطلبها مستشار — مطابقةٌ لما يفرضه الخادم */
const MAX_PERCENT = 50

interface Row {
  id: string
  kind: string
  status: string
  percentOff: number | null
  amountOff: string | null
  currency: string | null
  courseId: string | null
  reasonAr: string
  decisionNoteAr: string | null
  createdAt: string
  decidedBy: { displayName: string } | null
  coupon: { code: string } | null
}

const KIND_AR: Record<string, string> = {
  discount: 'خصم',
  plan_add: 'إضافة دورة للخطّة',
  plan_remove: 'إلغاء دورة من الخطّة',
}
const STATUS_AR: Record<string, string> = {
  pending: 'بانتظار قرار الإدارة',
  approved: 'اعتُمد',
  rejected: 'رُفض',
  cancelled: 'سحبتَه',
}

export default function RequestsPanel({ caseId }: { caseId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [kind, setKind] = useState<'discount' | 'plan_add' | 'plan_remove'>('discount')
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')
  const [percent, setPercent] = useState('10')
  const [amount, setAmount] = useState('')
  /* عملةُ الدفتر ثابتة — تُقرأ ولا تُختار */
  const currency = LEDGER_CURRENCY
  const [courseId, setCourseId] = useState('')
  const [reason, setReason] = useState('')
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    try {
      setRows(await apiGet<Row[]>(`/api/advisor/cases/${caseId}/requests`))
    } catch {
      setRows([])
    }
  }, [caseId])

  useEffect(() => { void load() }, [load])

  const submit = async () => {
    setBusy(true); toast('')
    try {
      await apiPost(`/api/advisor/cases/${caseId}/requests`, {
        kind,
        percentOff: kind === 'discount' && mode === 'percent' ? Number(percent) : undefined,
        amountOff: kind === 'discount' && mode === 'amount' ? Number(amount) : undefined,
        currency: kind === 'discount' && mode === 'amount' ? currency : undefined,
        courseId: kind === 'discount' ? undefined : courseId,
        reasonAr: reason.trim(),
      })
      toast('رُفع الطلب — تراه الإدارة في طابورها')
      setOpen(false); setReason(''); setCourseId('')
      await load()
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذّر رفع الطلب')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id: string) => {
    setBusy(true)
    try {
      await apiPost(`/api/advisor/requests/${id}/cancel`)
      await load()
    } catch (e) {
      toastError(e instanceof ApiError ? e.message : 'تعذّر سحب الطلب')
    } finally {
      setBusy(false)
    }
  }

  const ready = reason.trim().length >= 12 && (kind === 'discount' || !!courseId)

  return (
    <div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-teal/40 bg-teal/[0.06] px-4 py-2.5 text-xs font-black text-teal-light-ink transition hover:bg-teal/10"
        >
          <Plus className="h-3.5 w-3.5" /> اطلب خصما أو تعديلا على الخطّة
        </button>
      ) : (
        <Card className="bg-paper/25">
          <FieldRow>
            <Field label="نوع الطلب" htmlFor="req-kind" required>
              <select
                id="req-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}
                className={`${controlCls} [&>option]:bg-surface`}
              >
                <option value="discount">خصم على فاتورته</option>
                <option value="plan_add">إضافة دورة إلى خطّته</option>
                <option value="plan_remove">إلغاء دورة من خطّته</option>
              </select>
            </Field>

            {kind === 'discount' ? (
              <>
                <Field label="الخصم" htmlFor="req-mode" required hint={`النسبة بين ١ و${MAX_PERCENT} — ما فوقها قرارُ إدارةٍ لا طلبُ مستشار`}>
                  <div className="flex gap-2">
                    <select
                      id="req-mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}
                      className={`${controlCls} w-28 shrink-0 px-2 [&>option]:bg-surface`}
                    >
                      <option value="percent">نسبة ٪</option>
                      <option value="amount">مبلغ</option>
                    </select>
                    {mode === 'percent' ? (
                      <input
                        type="number" min={1} max={MAX_PERCENT} dir="ltr" value={percent}
                        onChange={(e) => setPercent(e.target.value)}
                        aria-label="نسبة الخصم"
                        className={`${controlCls} min-w-0 flex-1 text-left`}
                      />
                    ) : (
                      <>
                        <input
                          type="number" min={1} dir="ltr" value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          aria-label="مبلغ الخصم"
                          className={`${controlCls} min-w-0 flex-1 text-left`}
                        />
                        {/* لا منتقيَ عملةٍ هنا: الدفترُ كلُّه بالدولار — الكتالوج
                            والشعبة والطلب والفاتورة. وكان المستشار يستطيع أن
                            يرفع خصما بالدينار على شعبةٍ مسعَّرة بالدولار، فيصل
                            إلى الماليّة رقمٌ بعملةٍ لا يقبلها الطلب. والعملةُ
                            تُختار عند الدفع وحدَه (`presentment.ts`). */}
                        <span
                          className={`${controlCls} grid w-24 shrink-0 place-items-center px-2 text-xs font-black text-muted-foreground`}
                          aria-label="العملة"
                        >
                          {LEDGER_CURRENCY}
                        </span>
                      </>
                    )}
                  </div>
                </Field>
              </>
            ) : (
              <Field label="الدورة" htmlFor="req-course" required>
                <select
                  id="req-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}
                  className={`${controlCls} [&>option]:bg-surface`}
                >
                  <option value="">اختر الدورة</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}

            <Field
              label="سبب الطلب"
              htmlFor="req-reason"
              required
              wide
              hint="يقرؤه من يقرّر — فاكتب ما يجعل القرار ممكنا بلا سؤالك."
            >
              <textarea
                id="req-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: العميلة موظفة حكومية وميزانيتها محدودة، وحضرت جلسة تعريفية وأبدت جدّية."
                className={areaCls}
              />
            </Field>
          </FieldRow>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button tone="confirm" type="button" onClick={() => void submit()} disabled={!ready || busy} className="disabled:cursor-not-allowed">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} ارفع الطلب
            </Button>
            <Button tone="secondary" type="button" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            {!ready && reason.trim().length < 12 && (
              <span className="text-micro text-gold-ink">اكتب سببا لا يقلّ عن ١٢ حرفا</span>
            )}
          </div>
        </Card>
      )}

      {/* الطلبات السابقة */}
      {rows === null ? (
        <div className="grid place-items-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" /></div>
      ) : rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-xl border p-3 ${
              r.status === 'approved' ? 'border-teal/40 bg-teal/[0.05]'
                : r.status === 'rejected' ? 'border-gold/35 bg-gold/[0.05]'
                : 'border-white/10 bg-paper/20'
            }`}>
              <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-black">
                <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                {KIND_AR[r.kind] ?? r.kind}
                {r.percentOff && <span className="text-teal-light-ink">{r.percentOff}٪</span>}
                {r.amountOff && <span className="text-teal-light-ink">{r.amountOff} {r.currency}</span>}
                {r.courseId && <span className="font-normal text-muted-foreground">— {courseById(r.courseId)?.name ?? r.courseId}</span>}
                <span className="ms-auto text-micro font-bold text-muted-foreground">{STATUS_AR[r.status] ?? r.status}</span>
              </p>
              <p className="mt-1.5 text-[11px] leading-6 text-muted-foreground">{r.reasonAr}</p>
              {r.decisionNoteAr && (
                <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[11px] leading-6 text-foreground">
                  <span className="font-bold text-muted-foreground">ردّ الإدارة{r.decidedBy ? ` (${r.decidedBy.displayName})` : ''}: </span>
                  {r.decisionNoteAr}
                </p>
              )}
              {r.coupon && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-teal/30 bg-paper/30 px-2.5 py-1.5">
                  <code dir="ltr" className="flex-1 font-mono text-[11px] text-teal-light-ink">{r.coupon.code}</code>
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard?.writeText(r.coupon!.code); setCopied(r.id) }}
                    aria-label="انسخ رمز الخصم"
                    className="shrink-0 cursor-pointer text-muted-foreground transition hover:text-foreground"
                  >
                    {copied === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
              {r.status === 'pending' && (
                <button
                  type="button" onClick={() => void cancel(r.id)} disabled={busy}
                  className="mt-2 flex cursor-pointer items-center gap-1 text-micro font-bold text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-3 w-3" /> اسحب الطلب
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
