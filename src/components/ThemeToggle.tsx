import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, toggleTheme } from "@/services/theme";

/** زر تبديل المظهر — شمس في الداكن، قمر في الفاتح؛ يُحفظ الاختيار ويعمل فورا عبر المنصة كلها.

    ولماذا رموزُ السمة لا `white/…`: كان الزرّ `border-white/10 text-muted-foreground`،
    وهما لونان مبنيّان على أنّ ما خلفهما داكن. فإذا اختار الزائرُ المظهرَ
    الفاتح صار حدُّه أبيضَ بشفافيّة ١٠٪ على ورقٍ فاتح وأيقونتُه بيضاءَ بـ٤٥٪ —
    فاختفى الزرُّ الذي وحدَه يُرجعه إلى الداكن. ومَن لا يرى الزرَّ لا يعرف أنّ
    للموقع مظهرين.

    فصار الحدُّ `border-border` واللونُ `text-muted-foreground`، وكلاهما
    يُعرَّف في الوضعين معا فينقلب مع المظهر. وكبُرت الأيقونة من 3.5 إلى 4.5:
    رمزٌ بحجم 14px في دائرةٍ قطرُها 44px يبدو غبارا لا زرّا. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);
  const next = theme === "light" ? "الداكن" : "الفاتح";
  return (
    <button
      onClick={() => setTheme(toggleTheme())}
      aria-label={`التبديل إلى المظهر ${next}`}
      title={`المظهر ${next}`}
      /* `shrink-0`: القياسُ على هاتفٍ عرضُه ٣٩٠ بكسلا وجد الزرَّ ٢٠×٤٤ لا
         ٤٤×٤٤ — لأنّ الشريطَ الذي يحمله `flex`، وعنوانُ الصفحة الطويلُ
         بجانبه يضغطه فيصير خطّا رأسيّا لا زرّا. */
      className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-foreground/[0.04] text-muted-foreground transition hover:border-gold/60 hover:bg-gold/10 hover:text-gold-ink"
    >
      {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  );
}
