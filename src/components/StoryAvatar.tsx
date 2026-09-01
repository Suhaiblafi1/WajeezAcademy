/* وجهٌ للقصّة — ظِلٌّ لا وجهٌ مرسوم، وعن قصد مرّتين.

   ١) **لماذا لا صورة.** هذه القصص نماذجُ توضيحيّة مُعلَنة — لا أشخاصٌ
   حقيقيّون. ووجهٌ فوتوغرافيّ هو أقوى إشارةٍ ممكنة على أنّ صاحبَه موجود، فوضعُه
   على قصّةٍ مؤلَّفة يحوّلها من نموذجٍ صادقٍ إلى شهادةٍ ملفّقة مهما صغُر
   التنويه تحتها. ولا سبيل إليها تقنيّا أصلا: `img-src 'self'` تمنع كلَّ
   مصدرٍ خارجيّ.

   ٢) **ولماذا لا ملامح.** كان الرسمُ الأوّل وجها كاملا: حاجبان وعينان
   بحدقتين وأنفٌ وابتسامةٌ وخدّان محمرّان. ووصفه صاحبُ المنصّة بأنّه
   «طفوليّ جدّا» — وهو محقّ: العينُ المرسومةُ في وجهٍ مسطّح تُقرأ رسمَ أطفالٍ
   لا هويّةَ منتَجٍ مهنيّ، مهما أُتقنت. والملامحُ لم تكن تشتري شيئا: هي لا
   تُميّز شخصا (لا شخصَ هنا) ولا تحمل معلومة.

   فصار ظِلّا: هيئةٌ نظيفةٌ بلا ملامح، بلونين وحدٍّ رفيع. وهذا ما تفعله
   المنتجاتُ الجادّة في مكان الصورة الغائبة — يُقرأ موضعا محفوظا لصورةٍ لا
   ادّعاءَ شخصٍ، ولا يُقرأ رسما لطفل.

   وتبقى `look` تُفرّق الهيئات (حجاب · شعرٌ طويل · قصير · لحية · مجموعة) فلكلّ
   قصّةٍ ظلٌّ يخصّها، بلا أن يدّعي أيٌّ منها ملامحَ إنسانٍ بعينه.

   ويوم تصير عندنا قصصٌ موثّقةٌ بموافقة أصحابها، تُوضع صورُهم الحقيقيّة هنا —
   وتُرفع عنها كلمةُ «نموذج توضيحيّ» لأنّها لم تعد كذلك. */

import type { StoryAvatarLook } from '@/data/stories'

type Palette = { accent: string; figure: string; garment: string }

/* لوحاتٌ ثابتة تُختار بمعرّف القصّة فلا تتبدّل بين زيارتين.
   و`figure` أغمقُ من `garment` دائما: التباينُ بينهما هو ما يُظهر الكتفين
   من الرأس بلا خطٍّ فاصل. */
const PALETTES: Palette[] = [
  { accent: '#38A7B4', figure: '#12343A', garment: '#2F7C87' },
  { accent: '#57B9C4', figure: '#123833', garment: '#2E7F70' },
  { accent: '#D9A94C', figure: '#3A2E16', garment: '#8A6C2C' },
  { accent: '#7FC8D4', figure: '#14303A', garment: '#356E80' },
  { accent: '#9BD1B0', figure: '#16332A', garment: '#3B7A5E' },
]

function paletteFor(id: string): Palette {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTES[h % PALETTES.length]
}

/** ظِلُّ شخصٍ واحد — رأسٌ وكتفان، بلا ملامح */
function Figure({ p, look }: { p: Palette; look: StoryAvatarLook }) {
  return (
    <g>
      {/* الكتفان — يُرسمان أوّلا ليمرّ الرأسُ فوقهما */}
      <path d="M4 96c0-20 19.7-32 44-32s44 12 44 32z" fill={p.garment} />
      {/* ياقةٌ خفيفة: خطٌّ واحدٌ يعطي الهيئةَ عمقا بلا تفصيل */}
      <path d="M38 66.5c3 5.5 17 5.5 20 0l4.5 2.2L48 80 33.5 68.7z" fill={p.figure} fillOpacity="0.18" />

      {/* الشعرُ الخلفيّ أو الحجاب — قبل الرأس ليظهر من خلفه */}
      {look === 'longHair' && (
        <path d="M26 42c0-16.5 9.8-26 22-26s22 9.5 22 26c0 10 1.6 16.5 3.4 22.5-7 2.8-14.4 4-25.4 4s-18.4-1.2-25.4-4C24.4 58.5 26 52 26 42z" fill={p.figure} />
      )}
      {look === 'hijab' && (
        <path d="M23 45c0-17.5 11.2-29 25-29s25 11.5 25 29c0 11-3 17.5-6.2 23.6L71 82H25l4.2-13.4C26 62.5 23 56 23 45z" fill={p.figure} />
      )}

      {/* الرأس */}
      <ellipse
        cx="48"
        cy={look === 'hijab' ? 40 : 39}
        rx={look === 'hijab' ? 15.5 : look === 'beard' ? 17.5 : 17}
        ry={look === 'hijab' ? 17.5 : 19}
        fill={p.figure}
      />

      {/* الشعرُ الأماميّ — كتلةٌ واحدة، بلا خصلاتٍ تُقرأ رسما كرتونيّا */}
      {(look === 'short' || look === 'beard') && (
        <path d="M31 38c0-13 7.2-19.5 17-19.5S65 25 65 38c-2.2-8.5-7.4-12-17-12s-14.8 3.5-17 12z" fill={p.figure} />
      )}
      {look === 'longHair' && (
        <path d="M31 37c0-13 7.2-19.5 17-19.5S65 24 65 37c-1.4-9.5-8.4-12.8-14.8-9.6-4.2 2.1-8.4 4.2-14.8 3.2-3-.5-3.6 2.6-4.4 6.4z" fill={p.figure} />
      )}
      {look === 'beard' && (
        <path d="M31 44c1 12.5 7.6 20.5 17 20.5S64 56.5 65 44c-3 8.4-8.8 12-17 12s-14-3.6-17-12z" fill={p.figure} />
      )}
    </g>
  )
}

export default function StoryAvatar({
  id,
  name,
  look = 'short',
  className = '',
}: {
  id: string
  name: string
  look?: StoryAvatarLook
  className?: string
}) {
  const p = paletteFor(id)
  const gid = `av-${id}`

  return (
    <svg
      viewBox="0 0 96 96"
      className={`shrink-0 rounded-full ${className}`}
      role="img"
      aria-label={`ظِلٌّ يمثّل ${name} — نموذج توضيحي لا شخص حقيقي`}
    >
      <defs>
        <clipPath id={`${gid}-clip`}>
          <circle cx="48" cy="48" r="46" />
        </clipPath>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.accent} stopOpacity="0.26" />
          <stop offset="100%" stopColor={p.accent} stopOpacity="0.07" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${gid}-clip)`}>
        <rect width="96" height="96" fill={`url(#${gid}-bg)`} />

        {look === 'group' ? (
          /* دفعةٌ لا شخصٌ واحد — ثلاثةُ ظِلالٍ متداخلة، والأوسطُ أقربُ وأكبر */
          <g>
            <g opacity="0.55">
              <path d="M-6 96c0-15 11-24 25-24s25 9 25 24z" fill={p.garment} />
              <ellipse cx="19" cy="53" rx="11.5" ry="12.5" fill={p.figure} />
              <path d="M8.5 52c0-9 4.6-13.5 10.5-13.5S29.5 43 29.5 52c-1.4-5.6-4.4-8-10.5-8s-9.1 2.4-10.5 8z" fill={p.figure} />
            </g>
            <g opacity="0.55">
              <path d="M52 96c0-15 11-24 25-24s25 9 25 24z" fill={p.garment} />
              <ellipse cx="77" cy="53" rx="11.5" ry="12.5" fill={p.figure} />
              <path d="M65.5 54c0-11 5-15.5 11.5-15.5S88.5 43 88.5 54c0-6.4-4.6-9.6-11.5-9.6s-11.5 3.2-11.5 9.6z" fill={p.figure} />
            </g>
            <g transform="translate(48,52) scale(0.9) translate(-48,-46)">
              <Figure p={p} look="short" />
            </g>
          </g>
        ) : (
          <Figure p={p} look={look} />
        )}
      </g>
      <circle cx="48" cy="48" r="46" fill="none" stroke={p.accent} strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  )
}
