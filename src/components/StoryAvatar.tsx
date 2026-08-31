/* وجهٌ للقصّة — مرسومٌ لا مصوَّر، وعن قصد.

   طُلبت صورةٌ «تبدو بشرية طبيعية لأبعد حدّ» لكلّ قصّة. والمرسومُ هنا يقترب
   منها قدر ما يجوز، ولا يبلغها — ويُقال السببُ صراحةً بدل أن يُترك للتخمين:

   هذه القصص **نماذجُ توضيحية** مُعلَنة — لا أشخاصٌ حقيقيّون. ووجهٌ فوتوغرافيّ
   واقعيّ هو أقوى إشارةٍ ممكنة على أنّ صاحبَه موجود؛ فوضعُه على قصّةٍ مؤلَّفة
   يحوّلها من نموذجٍ صادقٍ إلى شهادةٍ ملفّقة، مهما صغُر التنويه تحتها. وذلك
   يناقض قاعدة المنصّة: لا قصّةَ تُعرض كحقيقةٍ قبل توثيقها. ولا سبيل إليها
   تقنيّا أصلا: سياسةُ الأمن عندنا `img-src 'self'` تمنع كلَّ مصدرٍ خارجيّ.

   فالمرسومُ يُعطي كلَّ بطاقةٍ وجها بملامحَ ودفءٍ وهيئةٍ تخصّه — ولا يدّعي
   أنّ أحدا جلس أمام كاميرا. وهو SVG بلا ملفٍّ ولا طلبِ شبكة.

   ويوم تصير عندنا قصصٌ موثّقةٌ بموافقة أصحابها، تُوضع صورُهم الحقيقية هنا —
   وتُرفع عنها كلمةُ «نموذج توضيحي» لأنّها لم تعد كذلك. */

import type { StoryAvatarLook } from '@/data/stories'

type Palette = { ring: string; skin: string; shade: string; hair: string; cloth: string; veil: string }

/* لوحاتٌ ثابتة — تُختار بمعرّف القصّة فلا تتبدّل بين زيارتين.
   و`veil` أفتحُ من `cloth` عمدا: الحجاب بلون الثوب يذوب في خلفيّةٍ داكنة
   فيبدو الرأسُ عاريا — وهذا ما وقع في أوّل رسم. */
const PALETTES: Palette[] = [
  { ring: '#38A7B4', skin: '#D9A87E', shade: '#B98A63', hair: '#2B2320', cloth: '#1F4E57', veil: '#7FBFC9' },
  { ring: '#57B9C4', skin: '#C08D62', shade: '#A0714B', hair: '#1C1613', cloth: '#264F45', veil: '#8CC7B4' },
  { ring: '#D9A94C', skin: '#E2BB95', shade: '#C29B75', hair: '#3A2A20', cloth: '#3E3524', veil: '#D9BE8A' },
  { ring: '#7FC8D4', skin: '#C99A72', shade: '#A97C57', hair: '#241B16', cloth: '#20404A', veil: '#9BCBD6' },
  { ring: '#9BD1B0', skin: '#D3A57C', shade: '#B3835C', hair: '#2A1F19', cloth: '#27423A', veil: '#A8D6BC' },
]

function paletteFor(id: string): Palette {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTES[h % PALETTES.length]
}

/** الملامح: حاجبان وعينان بحدقتين وأنفٌ وابتسامةٌ خفيفة — مرسومةٌ حول (٤٨،٣٨) */
function Face({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M39.6 32.2c1.9-1.3 4.2-1.3 6.1 0" stroke={p.hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M50.3 32.2c1.9-1.3 4.2-1.3 6.1 0" stroke={p.hair} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <ellipse cx="42.6" cy="37.4" rx="2.4" ry="1.9" fill="#FFFFFF" fillOpacity="0.92" />
      <ellipse cx="53.4" cy="37.4" rx="2.4" ry="1.9" fill="#FFFFFF" fillOpacity="0.92" />
      <circle cx="42.6" cy="37.6" r="1.15" fill={p.hair} />
      <circle cx="53.4" cy="37.6" r="1.15" fill={p.hair} />
      <path d="M48 39.4v4c0 .9-.7 1.4-1.7 1.4" stroke={p.shade} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M43.8 48.6c2.5 2 5.9 2 8.4 0" stroke={p.shade} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <ellipse cx="37.6" cy="43" rx="2.6" ry="1.6" fill={p.shade} fillOpacity="0.35" />
      <ellipse cx="58.4" cy="43" rx="2.6" ry="1.6" fill={p.shade} fillOpacity="0.35" />
    </g>
  )
}

/** كتفان يملآن أسفل الدائرة — بلا هذا يطفو الرأسُ في فراغ */
function Bust({ p }: { p: Palette }) {
  return (
    <>
      <path d="M41.5 50h13v20a6.5 6.5 0 0 1-13 0z" fill={p.shade} />
      <path d="M-6 96c0-19 22-30 54-30s54 11 54 30z" fill={p.cloth} />
      <path d="M42 68c2 4 10 4 12 0l7 3-13 8-13-8z" fill={p.veil} fillOpacity="0.25" />
    </>
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
      aria-label={`رسمٌ يمثّل ${name} — نموذج توضيحي لا شخص حقيقي`}
    >
      <defs>
        <clipPath id={`${gid}-clip`}>
          <circle cx="48" cy="48" r="46" />
        </clipPath>
        <radialGradient id={`${gid}-bg`} cx="0.5" cy="0.26" r="0.85">
          <stop offset="0%" stopColor={p.ring} stopOpacity="0.34" />
          <stop offset="100%" stopColor={p.ring} stopOpacity="0.08" />
        </radialGradient>
      </defs>

      <g clipPath={`url(#${gid}-clip)`}>
        <rect width="96" height="96" fill={`url(#${gid}-bg)`} />

        {look === 'group' ? (
          /* دفعةٌ لا شخصٌ واحد — ثلاثةُ أشخاصٍ خلف بعضهم */
          <g>
            <path d="M-2 96c0-15 11-24 25-24s25 9 25 24z" fill={p.cloth} fillOpacity="0.7" />
            <ellipse cx="23" cy="52" rx="11" ry="12" fill={p.shade} />
            <path d="M12 51c0-9 5-13 11-13s11 4 11 13c-1.4-5-4-7-11-7s-9.6 2-11 7z" fill={p.hair} />
            <path d="M48 96c0-15 11-24 25-24s25 9 25 24z" fill={p.cloth} fillOpacity="0.7" />
            <ellipse cx="73" cy="52" rx="11" ry="12" fill={p.skin} />
            <path d="M62 53c0-11 5-15 11-15s11 4 11 15c0-6-4-9-11-9s-11 3-11 9z" fill={p.veil} />
            <path d="M17 96c0-18 13-28 31-28s31 10 31 28z" fill={p.cloth} />
            <ellipse cx="48" cy="45" rx="15" ry="16.5" fill={p.skin} />
            <path d="M33 45c0-11 6-16 15-16s15 5 15 16c-1.8-7-6-9.5-15-9.5s-13.2 2.5-15 9.5z" fill={p.hair} />
            <g transform="translate(48,45) scale(0.86) translate(-48,-38)">
              <Face p={p} />
            </g>
          </g>
        ) : (
          <g>
            <Bust p={p} />

            {/* الشعر الخلفيّ — قبل الوجه ليظهر من خلفه */}
            {look === 'longHair' && (
              <path d="M27 40c0-16 9-25 21-25s21 9 21 25c0 9 2 15 4 21-7 3-14 4-25 4s-18-1-25-4c2-6 4-12 4-21z" fill={p.hair} />
            )}
            {look === 'hijab' && (
              <path d="M23 44c0-17 11-28 25-28s25 11 25 28c0 11-3 17-6 23l5 13H24l5-13c-3-6-6-12-6-23z" fill={p.veil} />
            )}

            {/* الرأس */}
            <ellipse cx="48" cy="38" rx={look === 'hijab' ? 15 : 17} ry={look === 'hijab' ? 17 : 19} fill={p.skin} />
            {look !== 'hijab' && (
              <>
                <ellipse cx="30.6" cy="39" rx="2.7" ry="3.6" fill={p.shade} />
                <ellipse cx="65.4" cy="39" rx="2.7" ry="3.6" fill={p.shade} />
              </>
            )}

            {/* الشعر الأماميّ */}
            {(look === 'short' || look === 'beard') && (
              <path d="M31 37c0-13 7-19 17-19s17 6 17 19c-2-8-7-11-17-11s-15 3-17 11z" fill={p.hair} />
            )}
            {look === 'longHair' && (
              <path d="M31 36c0-13 7-19 17-19s17 6 17 19c-1-9-8-12-14-9-4 2-8 4-14 3-3-.5-5 2-6 6z" fill={p.hair} />
            )}
            {look === 'beard' && (
              <path d="M32 42c.7 12 7 20 16 20s15.3-8 16-20c-3 8-8.4 11.5-16 11.5S35 50 32 42z" fill={p.hair} fillOpacity="0.94" />
            )}

            <Face p={p} />
          </g>
        )}
      </g>
      <circle cx="48" cy="48" r="46" fill="none" stroke={p.ring} strokeOpacity="0.45" strokeWidth="2" />
    </svg>
  )
}
