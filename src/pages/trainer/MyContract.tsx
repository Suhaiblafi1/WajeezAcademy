/* «عقدي» — نسختي الموقَّعةُ أقرؤها وأطبعها.

   ═══ البلاغُ الذي وُلدت منه ═══

   صاحبُ المنصّة (٢٥ سبتمبر ٢٠٢٦): «عندما يصل العقد الموقع للمدرب يصله نصا
   طويلا غير موقع!! اين نضع توقيعنا؟ ويجب أن يكون ملف بي دي اف يقوم بطباعته
   هو من جهته، وأيضا الملف يكون في منصته ضمن قسم المستحقات والعقد».

   وثلاثةُ أشياءَ في البلاغ، وهذه الصفحةُ جوابُ ثلاثتها:

   ① **«غير موقَّع»** — الدليلُ كان محفوظا ولا يُعرَض. فتحت الوثيقةِ سجلُّ
      التنفيذ (`ContractExecution`): من وقّع ومتى وبأيّ إقرار، ومن اعتمده
      عنّا، وبصمةُ النصّ.
   ② **«ملف بي دي اف يطبعه»** — ولا مولِّدَ PDF في الخادم، ولا يلزم: كلُّ
      متصفّحٍ يطبع إلى PDF، وورقةُ الطباعة معرَّفةٌ في `index.css` بهوامش A4
      وبمنعِ قطعِ البند بين صفحتين. فما يُحفَظ هو ما يُرى.
   ③ **«في منصته ضمن قسم المستحقات والعقد»** — تبويبٌ بجانب «مستحقاتي»،
      ووصلةٌ من «مستحقاتي» إليه.

   ═══ وقيدٌ يحكم الصفحة ═══

   **المعروضُ هو الموقَّعُ عليه.** المتنُ يُعاد مجمَّدا من `bodyAr` ويُصيَّر
   بـ`ContractDocument` — وهي الوحيدةُ التي يُثبَت أنّها لا تُسقط سطرا. وسجلُّ
   التنفيذ **بجانبها** لا فيها: المتنُ مهشَّشٌ، ومن ألحق به سجلَّ التوقيع نقض
   بصمتَه. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FileSignature, Loader2, Printer, Wallet } from 'lucide-react'
import TrainerLayout from './TrainerLayout'
import { apiGet, ApiError } from '@/services/api'
import { Card, Inset, Panel } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import ContractDocument from '@/components/ContractDocument'
import ContractExecution from '@/components/ContractExecution'
import { parseContractDoc } from '@/application/trainer/contract-sections'
import { contractHasBodyAr } from '@/application/trainer/contract-body'
import { executionStage } from '@/application/trainer/contract-execution'
import { fmtDateLong } from '@/application/text/format-ar'

interface MyContract {
  id: string
  title: string
  status: string
  kind: string
  revision: number
  bodyAr: string | null
  bodyVersion: string | null
  bodyHash: string | null
  signedAt: string | null
  signerLegalName: string | null
  signerAddressAr: string | null
  signerPhone: string | null
  consentTextAr: string | null
  consentAcksAr: unknown
  signedBodyHash: string | null
  countersignedAt: string | null
  academySignatoryName: string | null
  academySignatoryTitle: string | null
  conditionMetAt: string | null
  terminatedAt: string | null
  academyLegalNameAr: string
}

/* ولا نوعُ العقد يُخفى: ملحقٌ على نافذٍ ليس عقدا ثانيا، وبديلٌ يحلّ محلَّه */
const KIND_AR: Record<string, string> = {
  original: 'العقدُ الأصليّ',
  annex: 'ملحقٌ على عقدٍ نافذ',
  replacement: 'عقدٌ بديلٌ يحلّ محلَّ ما قبله',
}

export default function MyContract() {
  const [data, setData] = useState<MyContract | null>(null)
  const [err, setErr] = useState('')
  /* ═══ و«لم يوقّع بعد» ليس عطبا ═══

     المسارُ يردّ 404 لمن لا عقدَ موقَّعا في ملفه، وهو جوابٌ صحيح. لكنّ
     عرضَه لوحةً حمراءَ يقول لمن هو في التهيئة إنّ شيئا انكسر — ولا شيءَ
     انكسر: لم يُوقَّع بعد. فيُفرَّق بالرمز لا بالحالة وحدَها، إذ 404 تخرج
     كذلك لمن لا ملفَّ مدرّبٍ له (`no_profile`) وذاك حالٌ آخر. */
  const [unsigned, setUnsigned] = useState(false)

  useEffect(() => {
    apiGet<MyContract>('/api/trainer/me/contract')
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiError && e.code === 'no_contract') { setUnsigned(true); return }
        setErr(e instanceof ApiError ? e.message : 'تعذّر جلبُ عقدك')
      })
  }, [])

  if (unsigned) {
    return (
      <TrainerLayout title="عقدي">
        <Panel>
          <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
            <FileSignature className="h-5 w-5 shrink-0 text-teal-light-ink" aria-hidden="true" />
            لا عقدَ موقَّعا في ملفك بعد
          </h2>
          <p className="mt-2 text-read leading-7 text-muted-foreground">
            العقدُ يصلك رابطا في بريدك تقرؤه وتوقّعه من هناك — لا من هذه الصفحة. وحين توقّعه
            تجده هنا كاملا، وتحته سجلُّ التوقيعَين، ومنه تطبعه أو تحفظه ملفَّ PDF.
          </p>
          <Inset as={Link} interactive to="/trainer/earnings"
            className="mt-5 flex items-center gap-3 px-4 py-3 text-read text-muted-foreground">
            <Wallet className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
            <span>وكشفُ مستحقّاتك في <b>«مستحقاتي»</b>.</span>
          </Inset>
        </Panel>
      </TrainerLayout>
    )
  }
  if (err) {
    return (
      <TrainerLayout title="عقدي">
        <Card as="p" tone="danger" className="text-center text-sm font-bold text-red-300" role="alert">{err}</Card>
        <Inset as={Link} interactive to="/trainer/earnings"
          className="mt-4 flex items-center gap-3 px-4 py-3 text-read text-muted-foreground">
          <Wallet className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
          <span>العودةُ إلى «مستحقاتي»</span>
        </Inset>
      </TrainerLayout>
    )
  }
  if (!data) {
    return (
      <TrainerLayout title="عقدي">
        <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" /></div>
      </TrainerLayout>
    )
  }

  const stage = executionStage(data)
  const hasBody = contractHasBodyAr(data.bodyAr)

  return (
    <TrainerLayout title="عقدي — نسختي الموقَّعة">
      {/* ═══ الرأسُ لا يُطبع: الورقةُ للوثيقة وحدَها ═══

          وما يُقال هنا شرحٌ للشاشة (أين أنت، وما حالُ عقدك، وكيف تحفظه) —
          ولو طُبع لَتصدَّر ورقةً قانونيّةً كلامٌ ليس منها. */}
      <Panel className="print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
              <FileSignature className="h-5 w-5 shrink-0 text-teal-light-ink" aria-hidden="true" />
              {data.title}
            </h2>
            {/* ═══ ولا يُقال «نافذةٌ» عن عقدٍ فُسِخ ═══

                كان السطرُ يقرأ الختمَ وحدَه، فيقول لمن فُسِخ عقدُه إنّها
                «نافذةٌ بين الطرفين» وسطرُ البيان تحته يقول «فُسِخ في …».
                وشاشةٌ تناقض نفسَها في وثيقةٍ قانونيّةٍ أسوأُ من شاشةٍ تسكت.
                فالفسخُ يُسأل أوّلا: هو آخرُ ما وقع، وهو ما يعنيه اليوم. */}
            <p className="mt-2 text-read leading-7 text-muted-foreground">
              {data.terminatedAt
                ? `وقّعتَ هذه الوثيقةَ في ${fmtDateLong(data.signedAt ?? '')}، وفُسِخت في ${fmtDateLong(data.terminatedAt)} — وتبقى نسختُك منها محفوظةً لك.`
                : stage === 'countersigned'
                  ? `وقّعتَ هذه الوثيقةَ في ${fmtDateLong(data.signedAt ?? '')}، واعتمدتها الأكاديميّةُ في ${fmtDateLong(data.countersignedAt ?? '')} — فهي نافذةٌ بين الطرفين.`
                  : `وقّعتَ هذه الوثيقةَ في ${fmtDateLong(data.signedAt ?? '')}، وهي عند الأكاديميّةِ لاعتماد توقيعك.`}
            </p>
            {/* وأرضيّةُ المتن أربعةَ عشر لا اثنا عشر (`staff-surface.test.ts`):
                هذا سطرُ بيانٍ لا شارةَ زينة — «ملحقٌ على عقدٍ نافذ» يغيّر
                معنى ما يقرؤه، فلا يُصغَّر إلى حجم لصيقة. */}
            <p className="mt-1 text-read text-muted-foreground/75">
              {KIND_AR[data.kind] ?? data.kind}
              {data.revision > 1 ? ` · النسخةُ ${data.revision}` : ''}
            </p>
          </div>
          {/* والطباعةُ تحفظ PDF: حوارُ المتصفّح نفسُه فيه «حفظٌ كـPDF»،
              فلا يُبنى مولِّدٌ في الخادم لما يفعله كلُّ متصفّحٍ أصلا. */}
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            احفظ PDF / اطبع
          </Button>
        </div>
        <Inset as={Link} interactive to="/trainer/earnings"
          className="mt-5 flex items-center gap-3 px-4 py-3 text-read text-muted-foreground">
          <Wallet className="h-4 w-4 shrink-0 text-teal-light-ink" aria-hidden="true" />
          <span>وكشفُ ما تستحقّه على أساس هذا العقد في <b>«مستحقاتي»</b>.</span>
        </Inset>
      </Panel>

      {/* والوثيقةُ ثمّ سجلُّ تنفيذها — أختان في الصفحة لا أمٌّ وابنة */}
      <div className="mt-5">
        {hasBody
          ? <ContractDocument doc={parseContractDoc(data.bodyAr!)} />
          : (
            <Card as="p" tone="danger" className="text-sm font-bold text-red-300" role="alert">
              لا متنَ محفوظا لهذا العقد — راسلِ الأكاديميّةَ لتُرسَل إليك نسختُك.
            </Card>
          )}
        <ContractExecution seal={data} academyLegalNameAr={data.academyLegalNameAr} />
      </div>
    </TrainerLayout>
  )
}
