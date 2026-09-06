/* «أين أنت الآن؟» — بابٌ لمن لا يعرف ما يريد (البند ٣١).

   ─────────── لماذا شبكةٌ لا شريطُ رقاقات ───────────

   الرقاقاتُ الأفقيّةُ في الرئيسيّة تسأل الزائرَ **بلغةِ الكتالوج**: «تسويق»
   و«قيادة» و«أساسيات». وهي تفترض أنّه يعرف بأيّ اسمٍ يُسمّى ما يريده — ومن
   يعرف ذلك يعرف ما يريد أصلا، وله صندوقُ البحث.

   وأكثرُ زوّار أكاديميّةٍ **لا يعرفون**. وهذه رسالةُ المنصّة نفسِها: «نبدأ
   بالفهم قبل التعليم». فالسؤالُ الأوّلُ يجب أن يكون عمّا يعرفه الزائرُ عن
   نفسه يقينا — **أين هو الآن** — لا عن تصنيفٍ لم يضعه هو.

   ─────────── ولماذا هذه العشر بالذات ───────────

   ليست قائمةً اختُرعت لهذه الشاشة: هي **خياراتُ السؤال الأوّل في التشخيص
   نفسِه** (`QC-S1-001`)، تُقرأ من بنك الأسئلة لا تُكتب هنا — فلو تغيّرت هناك
   تغيّرت هنا، ولا جدولان يفترقان.

   ─────────── واتّصالُه بالتشخيص ليس زخرفا ───────────

   من نقر خيارَه هنا **يدخل التشخيصَ وقد أجاب سؤالَه الأوّل**: يُمرَّر اختيارُه
   في العنوان، ويُسلَّم للمحرّك قبل أوّل سؤالٍ يُعرض. فليستا تجربتين منفصلتين
   يُسأل فيهما السؤالُ نفسُه مرّتين. */

import { Link } from 'react-router'
import { ArrowLeft, Compass } from 'lucide-react'
import { STAGE_OPTIONS_AR, STAGE_PARAM } from '@/application/diagnostic/entry-stage'
import SectionLabel from './SectionLabel'

export function WhoAreYou() {
  return (
    <section id="who" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-14 md:py-16">
      <div className="reveal text-center">
        <SectionLabel icon={Compass}>ابدأ من نفسك</SectionLabel>
        <h2 className="mt-4 text-2xl font-black md:text-3xl">أين أنت الآن؟</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-muted-foreground">
          اختر ما يقترب من وضعك — وهو أوّلُ سؤالٍ يسأله مؤشّر وجيز.
          <span className="block text-teal-light-ink">فتدخله وقد أجبتَ عنه، ولا يُسألك مرّتين.</span>
        </p>
      </div>

      <ul className="reveal mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAGE_OPTIONS_AR.map((stage) => (
          <li key={stage}>
            <Link
              to={`/diagnostic?${STAGE_PARAM}=${encodeURIComponent(stage)}`}
              className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-bold text-foreground transition hover:border-teal/50 hover:bg-teal/[0.06]"
            >
              <span className="min-w-0">{stage}</span>
              <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-teal-light-ink" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="reveal mt-5 text-center text-fine leading-6 text-muted-foreground">
        تعرف ما تريد بالضبط؟{' '}
        <Link to="/courses" className="font-bold text-teal-light-ink hover:underline">تصفّح الكتالوج كاملا</Link>
        {' '}أو ابحث فيه بـ<kbd className="rounded border border-white/15 px-1.5 py-0.5 text-fine">Ctrl</kbd>
        {' + '}
        <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-fine">K</kbd>.
      </p>
    </section>
  )
}
