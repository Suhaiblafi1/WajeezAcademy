/* وثيقةُ العقد كما تُقرأ — لا كتلةَ نصٍّ في صندوقٍ يُمرَّر.

   ═══ العطبُ الذي وُلدت منه ═══

   كان المتنُ كلُّه في `<pre>` واحد: عشرون بندا وأربعةُ ملاحقَ نصّا متّصلا
   بلا رأسٍ يُرى ولا رقمٍ يُميَّز. ومن يُلزَم بمالٍ يقرأ ما يوقّع عليه، وهذا
   شكلٌ يُقرأ فيه سطرٌ ويُفقَد موضعُه. وعيّنةُ التصميم أقرّها صاحبُ المنصّة
   في ٢٣ سبتمبر ٢٠٢٦، وهذه هي منقولةً.

   ═══ وقيدان يحكمانها ═══

   ① **المعروضُ هو الموقَّعُ عليه.** البنيةُ تُشتقّ من المتن نفسِه
      (`contract-sections.ts`) لا تُكتب إلى جانبه، ولا يسقط سطر. يحرسه
      `contract-document.test.ts` بمقابلة المُصيَّر بالمتن حرفا بحرف.

   ② **ولا رقمَ مكتوبٌ باليد.** عيّنةُ التصميم بنت جدولَ الأتعاب وشبكةَ
      الخلاصة نصّا فيه ٤٥ و٣٠ و٨ — ولو نُقل كما هو لَطبع العقدُ أرقاما
      ثابتةً مهما كان ما وُقّع عليه. فكلُّ قيمةٍ هنا مقروءةٌ من السطر، وما
      لم يطابق شكلَه يرتدّ فقرةً عاديّةً بلا نقص.

   ═══ والفواصلُ تبقى في النصّ ═══

   «:» و«—» والنقطةُ يحلّ محلَّها في العين نَسَقُ اللوح، وتبقى في النصّ
   بـ`sr-only`: يقرؤها قارئُ الشاشة، وتُنسَخ مع النصّ. فلا يفترق المطبوعُ
   عن الموقَّع عليه، ولا تُخفى بـ`display:none`.

   ═══ ولمَ ورقةٌ فاتحةٌ في منصّةٍ داكنة ═══

   العقدُ وثيقةٌ تُطبَع وتُحفَظ ويُرجَع إليها، ويقرؤها الموقِّعُ قراءةً
   طويلة. فله لوحُه هو، والألوانُ مقصورةٌ على `.contract-doc`. */

import type { ContractDoc, ContractSection, ContractBlock } from '@/application/trainer/contract-sections'
import {
  sectionHeadingAr, summaryItem, exampleRow, exampleTotal,
  isExampleHeading, isAdvisoryNote, feeRuleRows, feeRuleCells,
  glossaryItem, GLOSSARY_HEAD,
} from '@/application/trainer/contract-sections'

/** فاصلٌ يُقرأ ولا يُرى — فالنصُّ يبقى تامّا والعينُ تقرأ اللوح */
const Sep = ({ t }: { t: string }) => <span className="sr-only">{t}</span>

function Para({ b }: { b: ContractBlock }) {
  if (b.kind === 'clause') {
    return (
      <p className="cd-clause">
        {/* الرقمُ يُبرَز ولا يُطرَح — وهو جزءٌ من السطر الموقَّع عليه،
            والفراغُ بعده نصٌّ لا هامشٌ في CSS. */}
        <b className="cd-no">{b.numAr}</b>{' '}{b.textAr}
      </p>
    )
  }
  if (b.kind === 'bullet') {
    /* والنقطةُ نصٌّ لا `::before`: ما ترسمه CSS لا يُنسَخ ولا يقرؤه قارئُ
       الشاشة، وهو من السطر الموقَّع عليه. */
    return <p className="cd-bullet"><span className="cd-dot">·</span>{' '}{b.textAr}</p>
  }
  if (isExampleHeading(b)) return <h4 className="cd-h4">{b.textAr}</h4>
  if (isAdvisoryNote(b)) return <p className="cd-note">{b.textAr}</p>
  return <p>{b.textAr}</p>
}

/* ═══ الخلاصةُ شبكةُ بطاقات — وكلُّ بطاقةٍ سطرٌ من المتن ═══

   وما لم يطابق شكلَ «· مفتاح: قيمة — تفصيل (البند ن)» يُعرَض فقرةً كما هو. */
function Summary({ section }: { section: ContractSection }) {
  const items = section.blocks.map((b) => ({ b, it: summaryItem(b) }))
  const carded = items.filter((x) => x.it)
  const loose = items.filter((x) => !x.it)
  return (
    <>
      {/* ═══ صفوفٌ لا مربّعات — قرارُ صاحب المنصّة (٢٤ سبتمبر) ═══

          كانت خمسَ بطاقاتٍ في شبكةٍ متساويةِ العرض، ونصُّ بنودِ الخلاصة جملٌ
          طويلةٌ لا كلمات: فبطاقةُ «الصفة» سطران، و«الأتعاب» عشرةٌ محشورةٌ في
          عمودٍ ضيّق. فتخرج صناديقُ متفاوتةُ الطول تثقُل العينَ ولا تُبسِّط.

          والصفُّ بعرضٍ كاملٍ يحلّ الأمرين معا: لا تفاوتَ طولٍ يُرى، والجملةُ
          الطويلةُ تأخذ سطرَها. ولا يسقط حرفٌ — التبديلُ في النَّسق وحدَه. */}
      {carded.length > 0 && (
        <dl className="cd-slist">
          {carded.map(({ it }, i) => (
            <div key={i} className="cd-srow">
              <Sep t="· " />
              <dt className="cd-k">{it!.keyAr}<Sep t=": " /></dt>
              <dd className="cd-v">
                {it!.valueAr}
                {it!.noteAr && <><Sep t=" — " /><span className="cd-n">{it!.noteAr}</span></>}
                {it!.refAr && <><Sep t=" " /><span className="cd-ref">{it!.refAr}</span></>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {loose.map(({ b }, i) => <Para key={i} b={b} />)}
    </>
  )
}

/* ═══ المعجمُ صفوفُ مصطلحٍ وتعريف — نَسَقُ الخلاصة بعينه ═══

   طلبُ صاحب المنصّة (٢٦ سبتمبر ٢٠٢٦): «ما تعنيه الكلمات مرتّبه كما في الملخّص
   أعلاه لتوضيح الكلمة الرئيسيّة بدلا من أنّها ضمن النصّ».

   وكان المصطلحُ يُقرأ داخل الجملة، فمن يبحث عن «الإسناد» يمسح ثمانيَ فقراتٍ
   متشابهةٍ بعينه. والخلاصةُ فوقَه تفصل المفتاحَ عن قيمته، فيُعطى نَسَقَها.

   ولا يتغيّر حرفٌ من المتن: النقطةُ والنقطتان تبقيان في النصّ بـ`sr-only`
   كما في الخلاصة — فالمنسوخُ والمطبوعُ والمهشَّشُ سواء. والبندُ الذي لا
   يطابق شكلَ «مصطلح: تعريف» يرتدّ فقرةً كما هو. */
function Glossary({ section }: { section: ContractSection }) {
  const items = section.blocks.map((b) => ({ b, it: glossaryItem(b) }))
  const rows = items.filter((x) => x.it)
  const loose = items.filter((x) => !x.it)
  return (
    <>
      {rows.length > 0 && (
        <dl className="cd-glist">
          {rows.map(({ it }, i) => (
            <div key={i} className="cd-grow">
              <Sep t="· " />
              <dt className="cd-term">{it!.termAr}<Sep t=": " /></dt>
              <dd className="cd-def">{it!.defAr}</dd>
            </div>
          ))}
        </dl>
      )}
      {loose.map(({ b }, i) => <Para key={i} b={b} />)}
    </>
  )
}

/* ═══ المثالُ الحسابيُّ جدولٌ — وأرقامُه من أسطره ═══

   الأسطرُ في المتن مرقّمةٌ بشكلٍ جدوليٍّ أصلا («1. الشعبة الأولى — 20
   مسجلا…: 600 USD»)، فيُقرأ منها الجدولُ ولا يُكتب رقمٌ هنا.

   وقاعدةُ الأتعاب فوقه صفوفٌ لا جدولُ خانات: خاناتُ العيّنة عنوانٌ وشرحٌ
   ليسا في العقد، وترتيبُها ينقل المبلغَ من موضعه فتنكسر الجملة. فالصفُّ
   جملةُ القاعدة بحروفها، والمبلغُ مُبرَزٌ حيث كُتب. */
function Blocks({ section }: { section: ContractSection }) {
  const out: React.ReactNode[] = []
  let rows: { b: ContractBlock; r: NonNullable<ReturnType<typeof exampleRow>> }[] = []

  const flush = (key: string) => {
    if (rows.length === 0) return
    const mine = rows; rows = []
    out.push(
      <table key={key}>
        <thead>
          <tr><th>مصدر المسجّلين</th><th>الحساب</th><th>أتعابك</th></tr>
        </thead>
        <tbody>
          {mine.map(({ r }, i) => (
            <tr key={i}>
              <td><Sep t={`${r.numAr}. `} />{r.labelAr}<Sep t=" — " /></td>
              <td>{r.byAr}<Sep t=": " /></td>
              <td className="cd-amt">{r.amountAr}</td>
            </tr>
          ))}
        </tbody>
      </table>,
    )
  }

  /* ═══ قاعدةُ الأتعاب — قارئتان لإصدارَين ═══

     `v7` يكتبها صفوفا معنونةً في المتن، فتُقرأ ثلاثةَ أعمدةٍ كما أُقرّت
     العيّنة. و`v6` وما قبله جملةٌ واحدة، ومتونُها مجمَّدةٌ في عقودٍ وُقّعت
     — فتبقى قارئتُها بعمودها الواحد.

     والأولى تُقدَّم: متنُ `v7` جملُه صفوفٌ، فلو سُئلت القارئةُ القديمةُ
     أوّلا لَقرأت أوّلَ صفٍّ جملةً وحجبت الجدول. */
  const isAnnex = section.kind === 'annex'
  const cells = isAnnex
    ? section.blocks.map((b) => ({ b, c: feeRuleCells(b) })).filter((x) => x.c)
    : []
  /* والقديمةُ لمن لا صفوفَ له وحدَه */
  const rule = isAnnex && cells.length === 0 ? feeRuleRows(section, 0) : null

  section.blocks.forEach((b, i) => {
    /* صفوفُ `v7` تُجمَع في جدولٍ واحدٍ عند أوّلها، وتُتخطّى بعده */
    const c = isAnnex ? feeRuleCells(b) : null
    if (c) {
      if (b !== cells[0].b) return
      out.push(
        <table key={`rule${i}`}>
          <thead>
            <tr><th>البند</th><th>القيمة</th><th>متى يُحتسب</th></tr>
          </thead>
          <tbody>
            {cells.map(({ c: r }, n) => (
              <tr key={n}>
                <td>{r!.labelAr}<Sep t=" — " /></td>
                <td className="cd-amt">{r!.amountAr}<Sep t=": " /></td>
                <td>{r!.whenAr}</td>
              </tr>
            ))}
          </tbody>
        </table>,
      )
      return
    }
    /* ═══ قاعدةُ الأتعاب صفوفا — وهي وحدَها المُلزِمة ═══

       الجملةُ بحروفها في الصفّ، والمبلغُ مُبرَزٌ في موضعه لا منقولا إلى
       خانةٍ أولى. وإن لم تُقرأ القاعدةُ صفوفا مرّت فقرةً كما هي. */
    if (i === 0 && rule) {
      out.push(
        <div key="rule" className="cd-rule">
          {rule.map((r, n) => (
            <p key={n} className="cd-rrow">
              {r.beforeAr}
              <b className="cd-ramt">{r.amountAr}</b>
              {r.afterAr}
            </p>
          ))}
        </div>,
      )
      return
    }
    const r = exampleRow(b)
    if (r) { rows.push({ b, r }); return }
    flush(`t${i}`)
    const total = exampleTotal(b)
    /* والمجموعُ ذيلُ الجدول إن سبقه جدول، وإلّا فقرةٌ كما هو */
    if (total && out.length > 0 && typeof out[out.length - 1] !== 'string') {
      const prev = out[out.length - 1] as React.ReactElement
      if (prev.type === 'table') {
        out[out.length - 1] = (
          <table key={`f${i}`}>
            {(prev.props as { children: React.ReactNode }).children}
            <tfoot>
              <tr>
                <td colSpan={2}>{total.labelAr}<Sep t=": " /></td>
                <td className="cd-amt">{total.amountAr}</td>
              </tr>
            </tfoot>
          </table>
        )
        return
      }
    }
    out.push(<Para key={i} b={b} />)
  })
  flush('tend')
  return <>{out}</>
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
          <Summary section={summary} />
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
          <div className="cd-card">
            {s.titleAr === GLOSSARY_HEAD ? <Glossary section={s} /> : <Blocks section={s} />}
          </div>
        </section>
      ))}
    </article>
  )
}
