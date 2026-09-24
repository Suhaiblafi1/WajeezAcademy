/* وثيقةُ العقد كما تُقرأ — لا كتلةَ نصٍّ في صندوقٍ يُمرَّر.

   ═══ العطبُ الذي وُلدت منه ═══

   كان المتنُ كلُّه في `<pre>` واحد: عشرون بندا وأربعةُ ملاحقَ نصّا متّصلا
   بلا رأسٍ يُرى ولا رقمٍ يُميَّز. ومن يُلزَم بمالٍ يقرأ ما يوقّع عليه، وهذا
   شكلٌ يُقرأ فيه سطرٌ ويُفقَد موضعُه.

   وقال صاحبُ المنصّة على عيّنة التصميم (٢٣ سبتمبر ٢٠٢٦): تُعتمَد. وهذه هي
   منقولةً إلى المنصّة.

   ═══ وقيدٌ واحدٌ يحكمها ═══

   **المعروضُ هو الموقَّعُ عليه.** البنيةُ تُشتقّ من المتن نفسِه
   (`contract-sections.ts`) لا تُكتب إلى جانبه، ولا يسقط سطر — يحرسه
   `src/tests/trainer/contract-document.test.ts` بمقابلة ما تعرضه الوثيقةُ
   بأسطر المتن غيرِ الفارغة.

   ═══ ولمَ ورقةٌ فاتحةٌ في منصّةٍ داكنة ═══

   العقدُ وثيقةٌ تُطبَع وتُحفَظ ويُرجَع إليها، ويقرؤها الموقِّعُ قراءةً
   طويلة. فله لوحُه هو — ورقٌ فاتحٌ وحبرٌ داكن — لا نبرةُ الشاشة حولَه.
   والألوانُ مقصورةٌ على `.contract-doc` فلا تسيل إلى ما حولها. */

import type { ContractDoc, ContractSection } from '@/application/trainer/contract-sections'
import { sectionHeadingAr } from '@/application/trainer/contract-sections'

/* ═══ ولا تُبدّل أرقامٌ ولا حرف ═══

   كان هنا تحويلٌ لأرقام البنود إلى الهنديّة (٤-١ مكان 4-1)، فرُدّ: المعروضُ
   هو الموقَّعُ عليه، ومتنُ العقد نفسُه يكتب «45 USD» و«8 مقعدا» بالغربيّة.
   فتحويلُ رقمِ البند وحدَه يجمع عيبَين: يخالف ما وُقّع، ويفترق عنّ ما حولَه
   في السطر نفسِه. وحارسُ التصيير يقابل المُخرَج بالمتن حرفا بحرف. */

function Blocks({ section }: { section: ContractSection }) {
  return (
    <>
      {section.blocks.map((b, i) => {
        if (b.kind === 'clause') {
          return (
            <p key={i} className="cd-clause">
              {/* الرقمُ يُبرَز ولا يُطرَح — وهو جزءٌ من السطر الموقَّع عليه */}
              <b className="cd-no">{b.numAr}</b>{' '}{b.textAr}
            </p>
          )
        }
        if (b.kind === 'bullet') {
          /* والنقطةُ نصٌّ لا `::before`: ما يرسمه CSS لا يُنسَخ ولا يُقرأ
             بقارئ الشاشة، وهو من السطر الموقَّع عليه. */
          return <p key={i} className="cd-bullet"><span className="cd-dot">·</span>{' '}{b.textAr}</p>
        }
        return <p key={i}>{b.textAr}</p>
      })}
    </>
  )
}

export default function ContractDocument({ doc }: { doc: ContractDoc }) {
  const summary = doc.sections.find((s) => s.kind === 'summary')
  const rest = doc.sections.filter((s) => s !== summary)

  return (
    <article className="contract-doc contract-prose" dir="rtl">
      <header className="cd-head">
        <p className="cd-kicker">أكاديميّة وجيز</p>
        <h2 className="cd-title">{doc.titleAr}</h2>
        {doc.meta.length > 0 && (
          <div className="cd-meta">
            {doc.meta.map((m) => (
              <span key={m.labelAr}>{m.labelAr}: <b>{m.valueAr}</b></span>
            ))}
          </div>
        )}
      </header>

      {/* الخلاصةُ أوّلا وبلوحٍ يميّزها — قراءةٌ ثانيةٌ من المصدر نفسِه */}
      {summary && (
        <section className="cd-summary">
          <h3>{summary.titleAr}</h3>
          <Blocks section={summary} />
        </section>
      )}

      {rest.map((s, i) => (
        <section key={i} className="cd-section">
          {s.titleAr && (
            <div className="cd-part">
              {s.numAr && (
                <span className={s.kind === 'annex' ? 'cd-num cd-num-annex' : 'cd-num'}>
                  {s.numAr}
                </span>
              )}
              <h3>{sectionHeadingAr(s)}</h3>
            </div>
          )}
          <div className="cd-card"><Blocks section={s} /></div>
        </section>
      ))}
    </article>
  )
}
