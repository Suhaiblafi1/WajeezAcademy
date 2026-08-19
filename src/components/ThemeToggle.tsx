import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getTheme, toggleTheme } from "@/services/theme";

/** زر تبديل المظهر — شمس في الداكن، قمر في الفاتح؛ يُحفظ الاختيار ويعمل فورا عبر المنصة كلها */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);
  const next = theme === "light" ? "الداكن" : "الفاتح";
  return (
    <button
      onClick={() => setTheme(toggleTheme())}
      aria-label={`التبديل إلى المظهر ${next}`}
      title={`المظهر ${next}`}
      className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-white/10 text-white/45 transition hover:border-[#FABC05]/60 hover:text-[#FABC05]"
    >
      {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
    </button>
  );
}
