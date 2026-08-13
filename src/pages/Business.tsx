import { Link } from 'react-router'
import { ArrowLeft, Building2, CheckCircle2, Landmark, Quote } from 'lucide-react'
import { stories } from '@/data/stories'
import SiteShell from '@/components/SiteShell'
import SeoHead from '@/components/SeoHead'

/* ───────────────── صفحتا الحلول المؤسسية: للشركات وللجهات الحكومية ───────────────── */

const CONTENT = {
  business: {
    icon: Building2,
    kicker: 'حلول الشركات',
    title: 'فريقك لا يحتاج دورات أكثر — يحتاج فجوات أقل',
    intro:
      'نبدأ بتشخيص فجوات فريقك كاملا، ثم نرسم لكل مجموعة مسارا واحدا مفسّرا بمدربين حقيقيين ومخرجات يمكنك قياسها في العمل — لا ساعات مشاهدة في تقرير.',
    points: [
      'تشخيص جماعي للفريق يكشف الفجوات المشتركة والفردية قبل أي التحاق.',
      'شُعب خاصة بشركتك بمدربين متخصصين، ومسارات تُخصَّص لهويتك وأهدافك.',
      'مخرج عملي لكل متدرب يُراجَع ويُقيَّم بشريا — تراه في عمله لا في شهادة فقط.',
      'تقرير إنجاز للإدارة: من أكمل، وماذا أنجز، وأين تبقى الفجوات.',
    ],
    storyId: 'team',
    cta: 'اطلب عرضا مؤسسيا',
  },
  government: {
    icon: Landmark,
    kicker: 'حلول الجهات الحكومية',
    title: 'التدريب الحكومي الذي يظهر أثره على واجهة الخدمة',
    intro:
      'برامج ترشيح حكومية تبدأ بتشخيص الموظف المرشَّح، وتنتهي بمخرج عملي يطبقه على نافذته أو مكتبه — مع تقارير إنجاز رسمية للجهة.',
    points: [
      'مسارات مصممة لواقع العمل الحكومي: خدمة الجمهور، المراسلات، المشتريات، القيادة الوسطى.',
      'شُعب حكومية مباشرة بمدربين يعرفون الإطار التنظيمي للقطاع.',
      'مخرجات عملية موثقة لكل موظف: أدلة تعامل، نماذج خطابات، خطط تحسين.',
      'تقارير إنجاز دورية للجهة الراعية — بلا أرقام إنشائية.',
    ],
    storyId: 'khaled',
    cta: 'اطلب عرضا لجهتك',
  },
} as const

export default function Business({ kind }: { kind: 'business' | 'government' }) {
  const c = CONTENT[kind]
  const story = stories.find((s) => s.id === c.storyId)!
  const path = kind === 'business' ? '/for-business' : '/for-government'

  return (
    <SiteShell>
      <SeoHead
        title={c.kicker}
        description={c.intro}
        path={path}
      />

      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#38A7B4]/30 bg-[#38A7B4]/10 px-4 py-1.5 text-sm text-[#6EC7D1]">
          <c.icon className="h-3.5 w-3.5" />
          {c.kicker}
        </div>
        <h1 className="mt-5 text-3xl font-black leading-snug md:text-4xl">{c.title}</h1>
        <p className="mt-4 text-lg leading-9 text-white/65">{c.intro}</p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {c.points.map((p) => (
          <div key={p} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#38A7B4]" />
            <p className="text-sm leading-7 text-white/75">{p}</p>
          </div>
        ))}
      </div>

      {/* قصة مرتبطة من الواقع */}
      <figure className="mt-12 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/5 p-7 md:p-9">
          <Quote className="h-7 w-7 text-[#38A7B4]/50" />
          <blockquote className="mt-4 text-lg leading-9 text-white/90">
            {story.before} {story.turn}
          </blockquote>
        </div>
        <figcaption className="p-7 md:px-9">
          <p className="text-sm leading-8 text-white/75">
            <span className="font-bold text-[#FABC05]">النتيجة: </span>
            {story.result}
          </p>
          <div className="mt-4 text-xs text-white/50">
            {story.name} — {story.role} · المسار: {story.pathway} · المدرب: {story.trainer}
          </div>
          <Link to="/stories" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#6EC7D1] underline-offset-4 hover:underline">
            اقرأ القصة كاملة في صفحة القصص
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </figcaption>
      </figure>

      <div className="mt-12 rounded-3xl border border-[#38A7B4]/25 bg-[#38A7B4]/5 p-8 text-center md:p-10">
        <p className="text-xl font-black">أخبرنا عن فريقك — نرد بعرض مخصص خلال يوم عمل</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/55">
          اذكر جهتك، وعدد المتدربين المتوقع، والمجالات التي تهمك — وسيتواصل معك فريق الحلول المؤسسية.
        </p>
        <Link to="/contact" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#247B84] px-8 py-4 font-bold text-white transition hover:bg-[#1E666E]">
          {c.cta}
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </SiteShell>
  )
}
