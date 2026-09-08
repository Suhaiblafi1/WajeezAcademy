/* اللسان — الدرجةُ التي كانت ناقصةً في السلّم.
 *
 * ── القرارُ الذي كان مؤجَّلا ──
 *
 * كُتب في حارس السقف بعد ترحيل الأزرار: «وترحيلُها يحتاج قرارا لا نسخا: أهي
 * `Button` بنبرتَين؟ أم مكوّنُ لسانٍ جديدٌ في السلّم؟» وهذا جوابُه، ودليلُه
 * ستُّ ألسنةٍ قِيست في المستودَع:
 *
 *   المالية           حبّاتٌ في حاوٍ بحدّ، والمختارُ فيروزيٌّ صمّاء
 *   المستخدمون        الصيغةُ نفسُها — نُسخت
 *   مراجعة التقييم    حبّاتٌ قائمةٌ بذاتها، والمختارُ حدٌّ فيروزيٌّ وتلوينٌ خفيف
 *   تأليف المتون      حبّاتٌ مربّعةُ الزوايا بأيقونةٍ وعلامةِ اكتمال
 *   طلبات المدرّبين   حبّاتٌ، والمختارُ **ذهبيٌّ صمّاء**
 *   بطاقة الشعبة      `Button` بنبرتَين
 *
 * ستُّ لغاتٍ للشيء الواحد. ومن حسّن واحدةً لم يبلغ تحسينُه أختَها — وهو
 * بعينه ما جعل حكمَ صاحب المنصّة يُقرأ صادقا: «التصاميمُ لم تتغيّر».
 *
 * ── ولماذا ليست `Button` بنبرتَين ──
 *
 * لأنّ اللسانَ ليس زرّا في دلالته: الزرُّ **يفعل**، واللسانُ **يختار أيَّ
 * لوحٍ يُعرض**. وقارئُ الشاشة يحتاج أن يُقال له ذلك صراحةً — `tablist` و
 * `tab` و`aria-selected` — ولا يقولها زرّ.
 *
 * وأثقلُ من ذلك: **لوحةُ المفاتيح**. الألسنةُ السّتُّ كلُّها كانت أزرارا
 * متتالية، فمن يتنقّل بـTab يمرّ على كلِّ لسانٍ قبل أن يبلغ محتواه — ستُّ
 * وقفاتٍ ليصل إلى ما جاء إليه. والمعيارُ يقول غيرَ ذلك: **وقفةٌ واحدةٌ
 * للشريط كلِّه**، والتنقّلُ بينها بالأسهم (`roving tabindex`). وهو ما لم
 * يكن في أيٍّ منها.
 *
 * ── والسهمُ في العربيّة يعكس ──
 *
 * الشريطُ يُقرأ من اليمين، فالسهمُ الأيسرُ يمضي إلى **التالي** والأيمنُ إلى
 * **السابق** — عكسَ اللاتينيّة. وكتابتُها على عادة اللاتينيّة تجعل التنقّل
 * يمشي إلى الوراء في وجه من يقرأ.
 */

import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem<K extends string> {
  id: K
  /** `ReactNode` بقصد: منها ما يحمل أيقونةً أو عددا أو علامةَ اكتمال */
  label: ReactNode
  /** يُقال عند الوقوف عليه — ولا يُغني عن نصٍّ ظاهر */
  hint?: string
}

export interface TabBarProps<K extends string> {
  items: readonly TabItem<K>[]
  value: K
  onChange: (next: K) => void
  /** اسمُ الشريط لقارئ الشاشة: «أقسام الملفّ» لا «ألسنة» */
  ariaLabel: string
  className?: string
}

export default function TabBar<K extends string>({
  items, value, onChange, ariaLabel, className = '',
}: TabBarProps<K>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  /* الاختيارُ يتبع التركيزَ (تفعيلٌ تلقائيّ): الألواحُ هنا تُعرض من حالةٍ
     محمَّلةٍ أصلا، فلا كلفةَ في تبديلها بالسهم. ولو كان لسانٌ يجلب من
     الخادم لَوجب فصلُ التركيز عن الاختيار. */
  function move(to: number) {
    const next = items[(to + items.length) % items.length]
    if (!next) return
    onChange(next.id)
    refs.current[next.id]?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    /* من اليمين يُقرأ: الأيسرُ تالٍ والأيمنُ سابق */
    if (e.key === 'ArrowLeft') { e.preventDefault(); move(i + 1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); move(i - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(items.length - 1) }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      /* ولماذا `inline-flex` لا `flex`: أوّلُ رسمٍ للمعاينة أظهر الحاويَ
         يمتدّ بعرض الصفحة كلِّها والألسنةَ مكوَّمةً في طرفه — حبّةٌ فارغةٌ
         طولُها ألفُ بكسل. فالشريطُ يقيس محتواه، و`max-w-full` يردّه إلى
         الالتفاف على الضيّق بدل أن يفيض. */
      className={`inline-flex max-w-full flex-wrap gap-1 rounded-full border border-white/15 p-1 ${className}`.trim()}
    >
      {items.map((t, i) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            /* وقفةٌ واحدةٌ للشريط: المختارُ وحدَه يدخل ترتيبَ التنقّل */
            tabIndex={on ? 0 : -1}
            title={t.hint}
            ref={(el) => { refs.current[t.id] = el }}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-black transition
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal
              focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
              on ? 'bg-teal text-on-teal' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
