/* خيارُ المعتذِر عن عقده في بياناته — زرّان، والحذفُ في الحال (٣ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «نعطيه خيارَ حذف بياناته أو إبقائها للفصول القادمة،
   وهو يقرّر بكبسة زرّ، ونحن نحذف مباشرة». ويصل هنا من زرٍّ في رسالة شكرنا
   (`src/application/trainer/decline-reply.ts`).

   وفتحُ الصفحة لا يفعل شيئا: ماسحاتُ البريد تفتح الروابطَ قبل أصحابها. فالحذفُ
   زرٌّ ثمّ تأكيد — لأنّه لا رجعةَ فيه. */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { apiGet, apiPost, ApiError } from '@/services/api'
import { Panel, Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import { DATA_CHOICE_AR, type DataChoice as Choice } from '@/application/trainer/decline-reply'

interface ChoiceState { fullName: string; choice: Choice | null; expired: boolean }

export default function DataChoice() {
  const { token = '' } = useParams()
  const [state, setState] = useState<ChoiceState | null>(null)
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    apiGet<ChoiceState>(`/api/data-choice/${encodeURIComponent(token)}`)
      .then(setState)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'تعذّر فتحُ الصفحة'))
  }, [token])

  const choose = async (choice: Choice) => {
    setBusy(true)
    try {
      const r = await apiPost<{ noteAr: string }>(`/api/data-choice/${encodeURIComponent(token)}`, { choice })
      setDone(r.noteAr)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'تعذّر تنفيذُ اختيارك')
    } finally { setBusy(false) }
  }

  return (
    <main dir="rtl" className="mx-auto w-full max-w-2xl px-4 py-12">
      <Panel className="p-6 md:p-8">
        <h1 className="text-xl font-black">بياناتُك عندنا — والقرارُ لك</h1>
        {done ? (
          <p role="status" className="mt-4 text-read leading-8">{done}</p>
        ) : err ? (
          <p role="alert" className="mt-4 text-read leading-8">{err}</p>
        ) : !state ? (
          <p className="mt-4 text-read text-muted-foreground">جارٍ التحميل…</p>
        ) : state.choice === 'keep' ? (
          <p className="mt-4 text-read leading-8">
            اخترتَ أن نُبقي بياناتك للمواسم القادمة. وإن غيّرتَ رأيك فاختر الحذفَ أدناه.
          </p>
        ) : null}

        {state && !done && !err && !state.expired && (
          <>
            {state.choice !== 'keep' && (
              <p className="mt-4 text-read leading-8">
                أهلا {state.fullName.split(/\s+/)[0]}. شكرا لك على وقتك معنا. اختر ما نفعله ببياناتك — ملفُّ
                طلبك ووثائقُه وعقودُه:
              </p>
            )}
            <div className="mt-5 grid gap-3">
              {state.choice !== 'keep' && (
                <Button tone="confirm" loading={busy && !confirming} disabled={busy} onClick={() => void choose('keep')}>
                  {DATA_CHOICE_AR.keep}
                </Button>
              )}
              {!confirming ? (
                <Button tone="secondary" disabled={busy} onClick={() => setConfirming(true)}>
                  {DATA_CHOICE_AR.delete}
                </Button>
              ) : (
                <Inset tone="warn" className="grid gap-3 p-4">
                  <p className="text-read leading-7">
                    يُحذف ملفُّ طلبك ووثائقُه وعقودُه الآن، ولا رجعةَ فيه. وإن أردت العودةَ يوما تقدّمتَ من جديد.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button tone="danger" loading={busy} onClick={() => void choose('delete')}>نعم، احذفها الآن</Button>
                    <Button tone="ghost" disabled={busy} onClick={() => setConfirming(false)}>تراجعْ</Button>
                  </div>
                </Inset>
              )}
            </div>
          </>
        )}
        {state?.expired && !done && (
          <p className="mt-4 text-read leading-8">
            انتهت صلاحيةُ هذا الرابط، وبياناتُك باقيةٌ كما هي. وإن أردت حذفَها فردَّ على رسالتنا وننفّذ طلبَك.
          </p>
        )}
      </Panel>
    </main>
  )
}
