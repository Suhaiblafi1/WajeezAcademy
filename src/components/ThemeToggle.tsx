import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, toggleTheme } from "@/services/theme";

import Button from "@/components/ui/Button";
/** زر تبديل المظهر — شمس في الداكن، قمر في الفاتح؛ يُحفظ الاختيار ويعمل فورا عبر المنصة كلها.

    ولماذا رموزُ السمة لا `white/…`: كان الزرّ `border-white/10 text-muted-foreground`،
    وهما لونان مبنيّان على أنّ ما خلفهما داكن. فإذا اختار الزائرُ المظهرَ
    الفاتح صار حدُّه أبيضَ بشفافيّة ١٠٪ على ورقٍ فاتح وأيقونتُه بيضاءَ بـ٤٥٪ —
    فاختفى الزرُّ الذي وحدَه يُرجعه إلى الداكن. ومَن لا يرى الزرَّ لا يعرف أنّ
    للموقع مظهرين.

    فصار الحدُّ `border-border` واللونُ `text-muted-foreground`، وكلاهما
    يُعرَّف في الوضعين معا فينقلب مع المظهر. وكبُرت الأيقونة من 3.5 إلى 4.5:
    رمزٌ بحجم 14px في دائرةٍ قطرُها 44px يبدو غبارا لا زرّا.

    ⚠️ **ونبرتُه `ghost` لا `primary` — وكانت `primary` غلطا كلّف كلَّ شاشة.**

    حين دخل هذا الزرُّ سلّمَ النبرات (٢٢٩ زرّا، الالتزام `0648046`) أُعطي
    `tone="primary"`، فصار `bg-gold text-on-gold` — أي **زرّا ذهبيَّ التعبئة
    في ترويسة كلّ شاشةٍ في المنصّة**. والأرجحُ أنّ سببَ الاختيار أنّ التحويم
    كان يذكر الذهبَ (`hover:bg-gold/10`)، فقُرئ لونُ التحويم لونا للزرّ.

    والذهبيُّ في هذا السلّم **فعلُ الصفحة الأوّل، واحدٌ في الشاشة لا اثنان**
    (`ui/Button.tsx`). وتبديلُ المظهر ليس فعلَ صفحةٍ في أيّ شاشة: هو أداةٌ
    في الإطار. فكان في `/auth` ذهبيّان معا — «التبديل إلى المظهر» و«ادخل إلى
    حسابي» — وقِيسا في المتصفّح بالتعبئة نفسِها `rgb(250,188,5)`.

    ولم يمسكه الحارسُ لأنّه كان يعدّ **الذهبيَّ في الملفّ**، وهذا ملفٌّ فيه
    واحد. والشاشةُ تُبنى من ملفّات. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);
  const next = theme === "light" ? "الداكن" : "الفاتح";
  return (
    <Button tone="ghost" onClick={() => setTheme(toggleTheme())}
      aria-label={`التبديل إلى المظهر ${next}`}
      title={`المظهر ${next}`}
      /* `shrink-0`: القياسُ على هاتفٍ عرضُه ٣٩٠ بكسلا وجد الزرَّ ٢٠×٤٤ لا
         ٤٤×٤٤ — لأنّ الشريطَ الذي يحمله `flex`، وعنوانُ الصفحة الطويلُ
         بجانبه يضغطه فيصير خطّا رأسيّا لا زرّا. */ className="grid h-11 w-11 shrink-0 place-items-center border border-border bg-foreground/[0.04] hover:border-gold/60 hover:bg-gold/10">
      {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </Button>
  );
}
