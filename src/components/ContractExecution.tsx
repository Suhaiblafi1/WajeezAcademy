/* ملحقُ التوقيع المنفَّذ — الجوابُ المعروضُ عن «أين نضع توقيعنا؟».

   ═══ ولمَ مكوّنٌ بجانب الوثيقة لا فصلٌ فيها ═══

   المتنُ مهشَّشٌ (`bodyHash`) ويُقابَل هاشُه لحظةَ التوقيع. فمن ألحق سجلَّ
   التوقيع بـ`bodyAr` نقض بصمتَه — ولا تُقارَن بصمةٌ بعدها، ولا يمرّ توقيعٌ
   لاحقٌ على ملحقٍ ولا بديل. **فسجلُّ التنفيذ يُصيَّر بجانبه**، موسوما في
   رأسه بأنّه سجلُّ تنفيذٍ لا نصُّ عقد، كي لا يُقرأ بندا لم يُوقَّع عليه.

   ═══ والتوقيعُ إلكترونيٌّ يُقال إنّه إلكترونيّ ═══

   ولا يُرسَم خطُّ يدٍ مصطنعٌ باسمه: صورةُ توقيعٍ لم يخطّها هو **تزييفٌ في
   وثيقة**، وقوّةُ ما وقع ليست في شكله بل في أنّه كتب اسمَه القانونيَّ بيده
   وأقرّ بجملٍ محفوظةٍ نصُّها، وأنّ بصمةَ ما عُرض عليه تطابق المحفوظ. فيُطبَع
   الاسمُ فوق خطٍّ، وتُقال صفتُه تحته بلا مواربة.

   ═══ ويُعرَض الطرفان معا وإن غاب أحدهما ═══

   توقيعُ المدرّبِ وحدَه إقرارُ طرفٍ واحد، والعقدُ ينفُذ بالاعتماد. فخانةُ
   الأكاديميّةِ تبقى ظاهرةً تقول «ينتظر اعتمادَنا» — فيعرف الموقِّعُ أين وقف
   عقدُه، بدل صفحةٍ تُرِيه توقيعَه وتسكت عن الباقي. */

import type { ContractSeal } from '@/application/trainer/contract-execution'
import { bodyIntact, executionStage, readConsentAcks } from '@/application/trainer/contract-execution'
import { fmtDateLong } from '@/application/text/format-ar'

/** التاريخُ كما يُقرأ في وثيقة — ولا تُطبَع علامةُ استفهامٍ محلَّ فراغ */
const onAr = (v: string | Date | null | undefined) => (v ? fmtDateLong(v) : null)

function Row({ labelAr, valueAr }: { labelAr: string; valueAr: string | null }) {
  if (!valueAr) return null
  return (
    <div className="ce-row">
      <dt>{labelAr}</dt>
      <dd>{valueAr}</dd>
    </div>
  )
}

export default function ContractExecution({
  seal, academyLegalNameAr,
}: { seal: ContractSeal; academyLegalNameAr: string }) {
  const stage = executionStage(seal)
  /* ولا سجلَّ لعقدٍ لم يُوقَّع: خانتان فارغتان تُوهمان بتنفيذٍ لم يقع */
  if (stage === 'unsigned') return null

  const acks = readConsentAcks(seal.consentAcksAr)
  const intact = bodyIntact(seal)
  const sealedOnAr = onAr(seal.countersignedAt)

  return (
    <section className="contract-exec contract-prose" dir="rtl" aria-labelledby="ce-h">
      <header className="ce-head">
        <p className="ce-kicker">سجلُّ تنفيذٍ — لا نصُّ عقد</p>
        <h2 className="ce-title" id="ce-h">التوقيعان</h2>
        <p className="ce-lede">
          {stage === 'countersigned'
            ? 'وقّع الطرفان هذه الوثيقةَ إلكترونيّا، فصارت نافذةً بينهما. وهذا سجلُّ التوقيعَين كما حُفظ.'
            : 'وقّعتَ هذه الوثيقةَ إلكترونيّا، وهذا سجلُّ توقيعك كما حُفظ. ولا تنفُذ حتّى تعتمدها الأكاديميّةُ بتوقيعها.'}
        </p>
      </header>

      <div className="ce-parties">
        {/* والأكاديميّةُ أوّلا كما في الديباجة — الطرفُ الأوّلُ هو الأوّل */}
        <div className={sealedOnAr ? 'ce-party' : 'ce-party ce-party-wait'}>
          <p className="ce-role">الطرفُ الأوّل — الأكاديميّة</p>
          {sealedOnAr ? (
            <>
              <p className="ce-name">{seal.academySignatoryName ?? academyLegalNameAr}</p>
              <p className="ce-rule" aria-hidden="true" />
              <p className="ce-how">
                {seal.academySignatoryTitle
                  ? `${seal.academySignatoryTitle} — اعتمد التوقيعَ عن ${academyLegalNameAr}`
                  : `اعتمد التوقيعَ عن ${academyLegalNameAr}`}
              </p>
              <dl className="ce-rows">
                <Row labelAr="تاريخُ الاعتماد" valueAr={sealedOnAr} />
              </dl>
            </>
          ) : (
            <>
              <p className="ce-name ce-pending">ينتظر اعتمادَنا</p>
              <p className="ce-rule" aria-hidden="true" />
              <p className="ce-how">
                تُطابق الأكاديميّةُ اسمَك القانونيَّ بوثيقة هويّتك ثمّ تعتمد توقيعَك، وتصلك رسالةٌ عندها.
              </p>
            </>
          )}
        </div>

        <div className="ce-party">
          <p className="ce-role">الطرفُ الثاني — المدرّب</p>
          <p className="ce-name">{seal.signerLegalName ?? '—'}</p>
          <p className="ce-rule" aria-hidden="true" />
          <p className="ce-how">وقّع إلكترونيّا بكتابة اسمه القانونيّ بنفسه في صفحة التوقيع</p>
          <dl className="ce-rows">
            <Row labelAr="تاريخُ التوقيع" valueAr={onAr(seal.signedAt)} />
            <Row labelAr="العنوان" valueAr={seal.signerAddressAr ?? null} />
            <Row labelAr="الهاتف" valueAr={seal.signerPhone ?? null} />
          </dl>
        </div>
      </div>

      {/* ═══ وما أقرّ به يُعرَض بنصّه لا بعددِه ═══

          الجملُ محفوظةٌ نصّا في `consentAcksAr` بقصد (لا مفاتيحُها ولا رقمُ
          إصدارها): فمن سُئل بعد سنةٍ «بأيّ الجمل أقرّ؟» يُجاب من الصفّ لا
          بالنبش في تاريخ Git. وما حُفظ لأجل السؤال يُعرَض لصاحبه. */}
      {acks.length > 0 && (
        <div className="ce-acks">
          <h3>وأقرَّ المدرّبُ بهذه الجمل واحدةً واحدةً قبل التوقيع</h3>
          <ol>
            {acks.map((a) => <li key={a.key}>{a.textAr}</li>)}
          </ol>
        </div>
      )}

      {seal.consentTextAr && (
        <p className="ce-consent">
          <b>ونصُّ الإقرار الذي ضغطه:</b> {seal.consentTextAr}
        </p>
      )}

      {/* ═══ والبصمةُ تُعرَض لصاحبها لا تُحفَظ عنه ═══

          قوّةُ التوقيع الإلكترونيِّ كلُّها في أنّ النصَّ لم يتبدّل بعده. فمن
          وقّع يملك أن يتحقّق بنفسِه — لا أن يُصدّقنا في أنّنا لم نبدّل. */}
      <div className={intact ? 'ce-hash' : 'ce-hash ce-hash-off'}>
        <h3>بصمةُ النصّ</h3>
        <p>
          {intact
            ? 'النصُّ المعروضُ أعلاه هو النصُّ الذي وُقّع عليه حرفا بحرف — بصمتاهما متطابقتان.'
            : 'لم تُحفَظ بصمةُ التوقيع لهذا العقد (وُقّع قبل أن يُخزَّن هذا الحقل)، فلا تُقابَل ببصمة النصّ آليّا. راجعِ الأكاديميّةَ إن أردتَ تحقّقا.'}
        </p>
        {seal.signedBodyHash && (
          <p className="ce-digest">
            <span>sha256 لما وُقّع عليه</span>
            <code dir="ltr">{seal.signedBodyHash}</code>
          </p>
        )}
      </div>
    </section>
  )
}
