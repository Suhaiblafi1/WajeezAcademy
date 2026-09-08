/* وجهٌ للقصّة — رسمٌ بالرصاص، وعن قصد.

   ═══ ما كان ═══

   ظِلٌّ بلا ملامح: رأسٌ وكتفان بلونين. وُضع بعد أن وُصف الرسمُ الأوّل
   (وجهٌ كاملٌ بحدقتين وخدّين محمرّين) بأنّه «طفوليّ جدّا»، وكان في الظلّ
   صدقٌ: لا يدّعي شخصا. لكنّه بارد — يُقرأ موضعَ صورةٍ غائبة لا إنسانا.

   ═══ القرار ═══

   قرارُ صاحب المنصّة (٨ سبتمبر ٢٠٢٦): «صور بشريّة مرسومة رسما بالقلم
   الرصاص — إبداعيّة، ليست حقيقيّة ولا تبدو غيرَ حقيقيّة جدّا. الرسمُ
   بالرصاص يعطي ما بين البينين.» وهو محقّ: الخطُّ المرسوم يقول «إنسان»
   ويقول في الوقت نفسه «رسم» — فلا يُحوّل نموذجا توضيحيّا إلى شهادةٍ ملفّقة،
   ولا يتركه قالبا فارغا.

   ═══ كيف يُرسم بالرصاص في SVG ═══

   · **خطٌّ مزدوج**: كلُّ خطٍّ رئيسيٍّ يُرسم مرّتين — مرّةً بكثافة، ومرّةً
     أخفّ بإزاحةٍ طفيفة. وهي عادةُ يد الرسّام حين تتلمّس الخطَّ قبل أن تثبته.
   · **ارتجافُ اليد**: `feTurbulence` بتردّدٍ عالٍ و`feDisplacementMap` بمقدارٍ
     صغير — فلا خطَّ مستقيما تماما، وهذا ما يفرّق الرصاصَ عن المتّجهات.
   · **تهشير** (hatching) في الشعر واللحية والحجاب — الظلُّ يُقال بخطوطٍ
     متوازية لا بتعبئة.
   · **ملامحُ قليلة**: حاجبان وعينان مسبلتان وأنفٌ وفمٌ بخطٍّ واحد لكلٍّ.
     الرسمُ التحريريّ (editorial) يوحي ولا يفصّل — والتفصيلُ هو ما جعل
     الوجهَ الأوّلَ طفوليّا.
   · **غسلةُ لون** خفيفة على الملبس من لوحة القصّة: تربط الرسمَ بألوان
     الموقع من غير أن تُلوّن الوجه.

   والحبرُ `currentColor`: رصاصٌ على ورقٍ فاتح، وطباشيرُ على الداكن —
   فيتبع المظهرَ بلا لوحةٍ ثانية.

   وتبقى `look` تُفرّق الهيئات (حجاب · شعرٌ طويل · قصير · لحية · مجموعة)
   فلكلّ قصّةٍ رسمٌ يخصّها، بلا أن يدّعي أيٌّ منها ملامحَ إنسانٍ بعينه.
   ويوم تصير عندنا قصصٌ موثّقةٌ بموافقة أصحابها، تُوضع صورُهم الحقيقيّة
   هنا — وتُرفع عنها كلمةُ «نموذج توضيحيّ» لأنّها لم تعد كذلك. */

import type { StoryAvatarLook } from '@/data/stories'

type Palette = { accent: string; figure: string; garment: string }

/* لوحاتٌ ثابتة تُختار بمعرّف القصّة فلا تتبدّل بين زيارتين.
   `accent` غسلةُ الخلفيّة والملبس، و`figure`/`garment` بقيّا لسَعة التنويع
   وقد يُقرأ منهما لونُ غسلةٍ ثانية. */
const PALETTES: Palette[] = [
  { accent: '#38A7B4', figure: '#12343A', garment: '#2F7C87' },
  { accent: '#57B9C4', figure: '#123833', garment: '#2E7F70' },
  { accent: '#D9A94C', figure: '#3A2E16', garment: '#8A6C2C' },
  { accent: '#7FC8D4', figure: '#14303A', garment: '#356E80' },
  { accent: '#9BD1B0', figure: '#16332A', garment: '#3B7A5E' },
  { accent: '#8FB8E8', figure: '#152A3E', garment: '#33608C' },
  { accent: '#C9A0D8', figure: '#2C1B38', garment: '#6B4A82' },
  { accent: '#E0A88F', figure: '#3A2620', garment: '#8C5B45' },
]

/* ــ بُعدٌ ثالثٌ محايد: سَعةٌ لا إصلاح (البند ٦٢) ــ

   خمسُ هيئاتٍ × ثمانِ لوحاتٍ × أربعِ ياقاتٍ = مئةٌ وستّون تركيبة. فمتى
   بلغت القصصُ عشرين أو ثلاثين بقي لكلٍّ مظهرُها. ولا تُشتقّ **الهيئةُ** من
   المعرّف: `look` تحمل دلالةً (حجابٌ · لحية) قد تناقض اسمَ صاحب القصّة إن
   اختيرت بالقرعة. فالبُعدان المضافان محايدان: لونٌ وياقة. */
const COLLARS = ['plain', 'vee', 'round', 'scarf'] as const
type Collar = (typeof COLLARS)[number]

/** بذرتان مختلفتان من المعرّف نفسِه — وإلّا سار البُعدان معا فلم يزيدا شيئا */
function hash(id: string, salt: number): number {
  let h = salt >>> 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function paletteFor(id: string): Palette {
  return PALETTES[hash(id, 0) % PALETTES.length]
}

function collarFor(id: string): Collar {
  return COLLARS[hash(id, 0x9e37) % COLLARS.length]
}

/** خطٌّ بالرصاص: ضربةٌ مؤكَّدة وضربةٌ أخفُّ بإزاحةٍ طفيفة — كما تتلمّس اليد */
function Stroke({ d, w = 1.4, faint = true }: { d: string; w?: number; faint?: boolean }) {
  return (
    <>
      {faint && (
        <path d={d} fill="none" stroke="currentColor" strokeWidth={w * 0.7} strokeLinecap="round" strokeLinejoin="round" opacity="0.32" transform="translate(0.7,-0.5)" />
      )}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </>
  )
}

/** تهشيرٌ: خطوطٌ قصيرةٌ متوازية تقول «ظلّ» بلا تعبئة */
function Hatch({ lines, w = 0.75, opacity = 0.55 }: { lines: string[]; w?: number; opacity?: number }) {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={opacity}>
      {lines.map((d) => <path key={d} d={d} />)}
    </g>
  )
}

/** رأسٌ وكتفان بالرصاص — الوجهُ بملامحَ قليلة، والهيئةُ بالشعر أو الحجاب */
function Figure({ p, look, collar }: { p: Palette; look: StoryAvatarLook; collar: Collar }) {
  const hijab = look === 'hijab'
  return (
    <g>
      {/* غسلةُ لونٍ على الملبس — تحت الخطوط كي تبقى الخطوطُ هي الرسم */}
      <path d="M8 96c2-16 14-27 33-31l7-1 7 1c19 4 31 15 33 31z" fill={p.accent} opacity="0.16" />
      {hijab && <path d="M27 44c0-19 9-31 21-31s21 12 21 31c0 8-2 14-5 20l8 20H24l8-20c-3-6-5-12-5-20z" fill={p.accent} opacity="0.1" />}

      {/* الكتفان والعنق */}
      <Stroke d="M6 96C10 76 24 68 41 64" />
      <Stroke d="M90 96C86 76 72 68 55 64" />
      {!hijab && <Stroke d="M42 54.5c-.4 3.6-.6 6.6-1 9.5M54 54.5c.4 3.6.6 6.6 1 9.5" w={1.1} faint={false} />}

      {/* الياقة — تفصيلُ ملبسٍ محايد يفرّق المتشابهات */}
      {collar === 'plain' && <Stroke d="M38 66l10 12 10-12" w={1} faint={false} />}
      {collar === 'vee' && <Stroke d="M35 65l13 19 13-19M39 65.5l9 13 9-13" w={1} faint={false} />}
      {collar === 'round' && <Stroke d="M35 67c4 5 22 5 26 0M37 69c3 3 19 3 22 0" w={1} faint={false} />}
      {collar === 'scarf' && (
        <>
          <Stroke d="M32 69c5 6 27 6 32 0M34 72c4 5 24 5 28 0" w={1} faint={false} />
          <Stroke d="M55 76l4 20M58 76l3 20" w={0.9} faint={false} />
        </>
      )}

      {/* الوجه: بيضةٌ بذقنٍ أدقّ من الجبهة — الحجابُ يخفي الأذنين */}
      <Stroke d="M33 36c0-12 6.5-19 15-19s15 7 15 19c0 11-6 20-15 20s-15-9-15-20z" />
      {!hijab && (
        <>
          <Stroke d="M33.5 37.5c-2.2-1.2-3.6 1.6-2.4 4.2.8 1.8 2.2 2.6 3.2 2.2" w={1} faint={false} />
          <Stroke d="M62.5 37.5c2.2-1.2 3.6 1.6 2.4 4.2-.8 1.8-2.2 2.6-3.2 2.2" w={1} faint={false} />
        </>
      )}

      {/* الملامح — خطٌّ واحدٌ لكلٍّ، والعينان مسبلتان: تأمّلٌ لا ابتسامةٌ مرسومة */}
      <Hatch lines={['M39 33.5q4-2 8 0', 'M49 33.5q4-2 8 0']} w={1.1} opacity={0.85} />
      <Hatch lines={['M40.5 38.6q3.5 2.2 7 0', 'M48.5 38.6q3.5 2.2 7 0']} w={1} opacity={0.85} />
      <Stroke d="M48.5 37c-.8 3-1.6 5.6-.2 8.2" w={0.9} faint={false} />
      <Hatch lines={['M43.5 49.5q4.5 2 9 0']} w={1} opacity={0.75} />
      {/* ظلٌّ تحت الفكّ */}
      <Hatch lines={['M36 46l2 3', 'M38.5 49.5l2 2.6', 'M60 46l-2 3', 'M57.5 49.5l-2 2.6']} w={0.6} opacity={0.35} />

      {/* الشعر أو الحجاب */}
      {(look === 'short' || look === 'beard') && (
        <>
          <Stroke d="M32.5 34c-.5-12 7-20 15.5-20s16 8 15.5 20c-3-7-8-10-15.5-10s-12.5 3-15.5 10z" />
          <Hatch lines={['M37 26l4-5', 'M42 22.5l3-4.5', 'M48 21l1.5-4.5', 'M54 22.5l-2-4.5', 'M59 26l-3.5-5', 'M35 30l3-3', 'M61 30l-3-3']} />
        </>
      )}
      {look === 'beard' && (
        <>
          <Stroke d="M34.5 44c1.5 11 7 19 13.5 19s12-8 13.5-19" w={1.1} />
          <Hatch lines={['M37 47l1 5', 'M40 51l1 5', 'M43.5 55l.6 4', 'M52.5 55l-.6 4', 'M56 51l-1 5', 'M59 47l-1 5', 'M46 58l.5 3', 'M50 58l-.5 3']} />
        </>
      )}
      {look === 'longHair' && (
        <>
          <Stroke d="M32.5 35c-.5-13 7-21 15.5-21s16 8 15.5 21c-3-7.5-8-10.5-15.5-10.5s-12.5 3-15.5 10.5z" />
          <Stroke d="M32.5 35c-1 10-2.5 19-7 27.5M63.5 35c1 10 2.5 19 7 27.5" />
          <Stroke d="M30 42c-.6 7-2 13-4.6 19.5M66 42c.6 7 2 13 4.6 19.5" w={0.9} faint={false} />
          <Hatch lines={['M36 27l4-5', 'M42 23l3-4.5', 'M54 23l-2-4.5', 'M60 27l-3.5-5', 'M29.5 48l-1.5 6', 'M66.5 48l1.5 6']} />
        </>
      )}
      {hijab && (
        <>
          <Stroke d="M27 44c0-19 9-31 21-31s21 12 21 31c0 8-2 14-5.5 20.5" />
          <Stroke d="M27 44c0 8 2 14 5.5 20.5" />
          <Stroke d="M32.5 64.5L24 86M63.5 64.5L72 86" />
          {/* ثنياتُ القماش */}
          <Hatch lines={['M33 40c-1 6-.5 12 1.5 18', 'M63 40c1 6 .5 12-1.5 18', 'M30 70l-3 9', 'M66 70l3 9', 'M36 20l-3 5', 'M60 20l3 5']} />
        </>
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
  const collar = collarFor(id)
  const gid = `av-${id}`
  /* بذرةُ الارتجاف من المعرّف: يدُ كلِّ رسمٍ تختلف قليلا، وتثبت بين زيارتين */
  const seed = hash(id, 7) % 100

  return (
    <svg
      viewBox="0 0 96 96"
      className={`shrink-0 rounded-full text-foreground ${className}`}
      role="img"
      aria-label={`رسمٌ بالرصاص يمثّل ${name} — نموذج توضيحي لا شخص حقيقي`}
    >
      <defs>
        <clipPath id={`${gid}-clip`}>
          <circle cx="48" cy="48" r="46" />
        </clipPath>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={p.accent} stopOpacity="0.06" />
        </linearGradient>
        {/* ارتجافُ اليد — إزاحةٌ طفيفةٌ بضجيجٍ ناعم، فلا خطَّ مستقيما تماما */}
        <filter id={`${gid}-pencil`} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.1" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g clipPath={`url(#${gid}-clip)`}>
        <rect width="96" height="96" fill={`url(#${gid}-bg)`} />
        {/* حُبَيباتُ الورق — نقاطٌ باهتة تقول «ورق» لا «شاشة» */}
        <g fill="currentColor" opacity="0.06">
          {[[12, 20], [80, 14], [22, 78], [70, 84], [88, 60], [8, 52], [50, 8], [40, 90]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" />
          ))}
        </g>

        <g filter={`url(#${gid}-pencil)`}>
          {look === 'group' ? (
            /* دفعةٌ لا شخصٌ واحد — ثلاثةُ رسومٍ متداخلة، والأوسطُ أقربُ وأوضح */
            <g>
              <g opacity="0.45" transform="translate(19,50) scale(0.55) translate(-48,-40)">
                <Figure p={p} look="short" collar="round" />
              </g>
              <g opacity="0.45" transform="translate(77,50) scale(0.55) translate(-48,-40)">
                <Figure p={p} look="hijab" collar="plain" />
              </g>
              <g transform="translate(48,52) scale(0.9) translate(-48,-46)">
                <Figure p={p} look="short" collar={collar} />
              </g>
            </g>
          ) : (
            <Figure p={p} look={look} collar={collar} />
          )}
        </g>
      </g>
      <circle cx="48" cy="48" r="46" fill="none" stroke={p.accent} strokeOpacity="0.45" strokeWidth="1.5" />
    </svg>
  )
}
