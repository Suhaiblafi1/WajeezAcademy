/* «أما زلتَ مهتمّا؟» — صفحةُ جواب المؤجَّل إلى الفصول القادمة (٦ أكتوبر ٢٠٢٦).

   يصل هنا من زرٍّ في بريد المتابعة (`deferralFollowUpMail`) حين يحلّ الموعدُ الذي
   وُعد به في بريد التأجيل. والقرارُ وعلّتُه في `src/application/trainer/deferral.ts`.

   · **فتحُ الصفحة لا يُجيب**: برامجُ البريد تفتح الروابطَ لتفحصها قبل أصحابها.
     فالجوابُ ضغطةٌ هنا.
   · **وتحت كلّ خيارٍ ما يقع به** — من `INTEREST_CHOICES` نفسِها التي في البريد:
     «لا إجبارَ على فعل: الفروقُ والخياراتُ وأثرُ كلٍّ، والقرارُ لصاحبه».
   · **و«لم أعد مهتمّا» تُسأل مرّةً ثانية**: تسحب الطلب، والسحبُ يُعاد بيد الإدارة
     لا بيده — فلا يقع بلمسةٍ خاطئةٍ على الهاتف. */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { apiGet, apiPost, ApiError } from '@/services/api'
import { Panel, Inset } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import SeoHead from '@/components/SeoHead'
import { INTEREST_PAGE_PATH, type InterestAnswer } from '@/application/trainer/deferral'

interface InterestView {
  firstName: string
  reference: string
  choices: { answer: InterestAnswer; labelAr: string; whatAr: string }[]
}

/** ما يُقال بعد الجواب — بما وقع فعلا لا بما ضُغط */
const DONE_AR: Record<InterestAnswer, string> = {
  interested: 'شكرا لك. عاد طلبُك إلى المراجعة بملفّه كما هو، ونتواصل معك قريبا لنرى أنسبَ فصلٍ لدوراتك.',
  not_interested: 'شكرا لك على وقتك معنا. سحبنا طلبَك كما طلبت، ولك أن تتقدّم من جديد متى شئت.',
}

export default function DeferralInterest() {
  const { token = '' } = useParams()
  const [view, setView] = useState<InterestView | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmingNo, setConfirmingNo] = useState(false)
  const [done, setDone] = useState<InterestAnswer | null>(null)

  useEffect(() => {
    apiGet<InterestView>(`/api/trainer-interest/${encodeURIComponent(token)}`)
      .then(setView)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'تعذّر فتحُ الصفحة'))
  }, [token])

  const answer = async (a: InterestAnswer) => {
    setBusy(true)
    try {
      await apiPost(`/api/trainer-interest/${encodeURIComponent(token)}`, { answer: a })
      setDone(a)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'تعذّر حفظُ جوابك — أعِد المحاولة، أو ردَّ على رسالتنا')
    } finally { setBusy(false) }
  }

  const yes = view?.choices.find((c) => c.answer === 'interested')
  const no = view?.choices.find((c) => c.answer === 'not_interested')

  return (
    <main dir="rtl" className="mx-auto w-full max-w-2xl px-4 py-12">
      <SeoHead title="أما زلتَ مهتمّا بالتدريب معنا؟" description="سؤالُ المتابعة لطلبٍ أُجّل إلى الفصول القادمة" path={INTEREST_PAGE_PATH} noindex />
      <Panel className="p-6 md:p-8">
        <h1 className="text-xl font-black">أما زلتَ مهتمّا بالتدريب معنا؟</h1>
        {done ? (
          <p role="status" className="mt-4 text-read leading-8">{DONE_AR[done]}</p>
        ) : err ? (
          <p role="alert" className="mt-4 text-read leading-8">{err}</p>
        ) : !view ? (
          <p className="mt-4 text-read text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <>
            <p className="mt-4 text-read leading-8">
              أهلا {view.firstName}. قبل شهرين أجّلنا طلبَك (<span dir="ltr">{view.reference}</span>) إلى الفصول
              القادمة، ووعدناك أن نسألك عن اهتمامك. اختر ما يناسبك — وتحت كلّ خيارٍ ما يقع به:
            </p>
            <div className="mt-5 grid gap-3">
              {yes && (
                <Inset className="grid gap-2 p-4">
                  <Button tone="confirm" loading={busy && !confirmingNo} disabled={busy} onClick={() => void answer('interested')}>
                    {yes.labelAr}
                  </Button>
                  <p className="text-read leading-7 text-muted-foreground">{yes.whatAr}</p>
                </Inset>
              )}
              {no && (
                <Inset className="grid gap-2 p-4">
                  {!confirmingNo ? (
                    <Button tone="secondary" disabled={busy} onClick={() => setConfirmingNo(true)}>{no.labelAr}</Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button tone="danger" loading={busy} onClick={() => void answer('not_interested')}>نعم، اسحبوا طلبي</Button>
                      <Button tone="ghost" disabled={busy} onClick={() => setConfirmingNo(false)}>تراجعْ</Button>
                    </div>
                  )}
                  <p className="text-read leading-7 text-muted-foreground">{no.whatAr}</p>
                </Inset>
              )}
            </div>
            <p className="mt-5 text-read leading-7 text-muted-foreground">
              ولك أن تردّ على رسالتنا بما شئت بدلَ الضغط — يقرؤها فريقُنا.
            </p>
          </>
        )}
      </Panel>
    </main>
  )
}
