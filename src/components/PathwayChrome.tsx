/* إطارُ صفحة المسار — شريطُها العلويّ وصندوقُ «منظومة كاملة» (٨ نوفمبر ٢٠٢٦).

   كانا داخل `pages/Pathway.tsx` وحدَها. ثمّ طلب صاحبُ المنصّة أن تُعرض صفحةُ المسار الخاصّ `/go/<رمز>` «بالقالب نفسه
   الذي تستخدمه صفحات المسار المعتادة، بكل تفاصيله» — فخرجا إلى هنا لتقرأهما الصفحتان من موضعٍ واحد، فلا يفترق القالبان
   حين يُعدَّل أحدهما. والشكلُ كما كان حرفا بحرف. */

import { Link } from "react-router";
import { ArrowRight, BadgeCheck, Briefcase, ClipboardCheck, FolderKanban, MonitorPlay, Route as RouteIcon, Sparkles, User } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Inset, Panel } from "@/components/ui/Surface";

/** الشريطُ العلويّ: الرئيسية، وعلامةُ الأكاديميّة، واسمُ الداخل أو «دخول» */
export function PathwayTopBar({ user }: { user: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/85 backdrop-blur">
      {/* وعلى الهاتف سطرٌ واحد (٨ نوفمبر ٢٠٢٦): «التصميمُ على التلفون غيرُ عمليّ» — كان اسمُ الأكاديميّة واسمُ الحساب
          يلتفّان سطرين. فـ«الرئيسية» سهمٌ وحدَه، واسمُ الحساب أيقونتُه، والاسمُ لا يلتفّ */}
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4 sm:px-5">
        <Link to="/" aria-label="الرئيسية" className="flex items-center gap-2 text-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
          <span className="hidden text-sm font-medium sm:inline">الرئيسية</span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <img src="/logo-mark.png" alt="علامة أكاديمية وجيز" className="h-9 w-9 shrink-0 object-contain" />
          <span className="whitespace-nowrap font-black">أكاديمية وجيز</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={user}>
              <User className="h-4 w-4" aria-label={user} /> <span className="hidden sm:inline">{user}</span>
            </span>
          ) : (
            <Inset as={Link} tone="accent" interactive to="/auth" className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-teal/50 hover:text-teal-light-ink">
              <User className="h-3.5 w-3.5" />
              دخول
            </Inset>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

const ECOSYSTEM = [
  { icon: MonitorPlay, t: "دورات مسجلة + جلسات مباشرة", d: "وحدات فيديو وجلسة حية مع المدرب ومهمة تطبيقية لكل دورة" },
  { icon: ClipboardCheck, t: "واجبات تراجع بشريا", d: "مدربك يقرأ واجبك ويعطيك ملاحظات عملية — لا تصحيحا آليا" },
  { icon: FolderKanban, t: "مشروع تخرج حقيقي", d: "تبني مخرجا على واقعك وتقدمه للمراجعة قبل الاعتماد" },
  { icon: BadgeCheck, t: "شهادة موثقة بشروط إنجاز", d: "مرتبطة بالحضور والاختبار والمشروع — لا شهادة مشاهدة" },
  { icon: RouteIcon, t: "خطة تقدم شخصية", d: "خطوة تالية واضحة بعد المسار — ماذا تتعلم بعده ولماذا" },
  { icon: Briefcase, t: "منظومة ما بعد الإتمام", d: "لوحة وظائف وتوصيات مهنية وبرنامج سفراء وجيز" },
] as const;

/** ما يأخذه مع المسار — من عروض أكاديمية وجيز (نسخةٌ مضغوطة: خاناتٌ أصغر ومتقاربة) */
export function PathwayEcosystemPanel() {
  return (
    <Panel className="story-fade mt-8 md:p-6">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <Sparkles className="h-5 w-5 text-[#FABC05]" />
        مع المسار لا تأخذ دورات فقط — تأخذ منظومة كاملة
      </h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ECOSYSTEM.map((b) => (
          <Inset key={b.t} className="flex items-start gap-2.5 p-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#38A7B4]/15">
              <b.icon className="h-3.5 w-3.5 text-[#6EC7D1]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black leading-snug">{b.t}</p>
              <p className="mt-0.5 text-read leading-relaxed text-muted-foreground">{b.d}</p>
            </div>
          </Inset>
        ))}
      </div>
    </Panel>
  );
}
