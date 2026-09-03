/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /* ── أصغرُ حجمٍ مسموحٍ في المنصّة ──

         كانت الشاشاتُ تنزل إلى ٩ و١٠ بكسلا في ٢٧٥ موضعا — وأكثرُها في
         شاشات الفريق، حيث تُقرأ الجداولُ والشارات يوما كاملا. والقياسُ
         بالمتصفّح على هاتفٍ عرضُه ٣٩٠ بكسلا وجد نصوصا بتسعةِ بكسلات في
         بوّابة المدرّب وشاشة الشعب.

         فصار للحجم اسمٌ واحدٌ وحدٌّ واحد: `text-micro` بأحدَ عشرَ بكسلا،
         وهو أصغرُ ما يُكتب. والاسمُ يفعل ما لا يفعله الرقمُ المكتوبُ في
         مكانه: يمنع أن يعود التسعةُ والعشرةُ من باب النسخ، ويُحرَسُ ذلك
         باختبار.

         ولا يحمل ارتفاعَ سطرٍ معه — كما لا يحمله `text-[10px]` — فتبقى
         أصنافُ `leading-*` في مواضعها تعمل كما كانت. */
      fontSize: {
        micro: '11px',
      },
      colors: {
        /* توكنات الهوية (البند و-١) — bg-teal و text-teal-ink/70 وغيرها.
           تعبئة/حد: teal · teal-light · teal-deep · gold (ثابتة)
           نص: teal-ink · teal-light-ink · gold-ink (تنقلب على الفاتح)
           حبر فوق التعبئات الساطعة: on-teal · on-gold (ثابتة)
           «gold» لا «amber»: الأخير يظلّ مقياس amber-300/400 المستعمل. */
        teal: "rgb(var(--teal) / <alpha-value>)",
        "teal-light": "rgb(var(--teal-light) / <alpha-value>)",
        "teal-deep": "rgb(var(--teal-deep) / <alpha-value>)",
        "teal-darker": "rgb(var(--teal-darker) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        "teal-ink": "rgb(var(--teal-ink) / <alpha-value>)",
        "teal-light-ink": "rgb(var(--teal-light-ink) / <alpha-value>)",
        "gold-ink": "rgb(var(--gold-ink) / <alpha-value>)",
        ground: "rgb(var(--ground) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-teal": "rgb(var(--surface-teal) / <alpha-value>)",
        "on-teal": "rgb(var(--on-teal) / <alpha-value>)",
        "on-gold": "rgb(var(--on-gold) / <alpha-value>)",
        "on-bright": "rgb(var(--on-bright) / <alpha-value>)",
        "zoom-ink": "rgb(var(--zoom-ink) / <alpha-value>)",
        /* سلّم المخططات الترتيبي (إد-٢) */
        "ramp-1": "rgb(var(--ramp-1) / <alpha-value>)",
        "ramp-2": "rgb(var(--ramp-2) / <alpha-value>)",
        "ramp-3": "rgb(var(--ramp-3) / <alpha-value>)",
        "ramp-4": "rgb(var(--ramp-4) / <alpha-value>)",
        "ramp-5": "rgb(var(--ramp-5) / <alpha-value>)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* رموز الأسطح السيميائية — تتبدل تلقائيا بين الليلي والنهاري
           عبر متغيرات --c-* في src/index.css. ممنوع استخدام hex داكن
           حرفي للأسطح المتكيفة مع الثيم؛ استخدم هذه الأسماء دائما. */
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface3: "rgb(var(--c-surface3) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        paneldeep: "rgb(var(--c-paneldeep) / <alpha-value>)",
        panelto: "rgb(var(--c-panelto) / <alpha-value>)",
        warm: "rgb(var(--c-warm) / <alpha-value>)",
        warm2: "rgb(var(--c-warm2) / <alpha-value>)",
        warmglow: "rgb(var(--c-warmglow) / <alpha-value>)",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}