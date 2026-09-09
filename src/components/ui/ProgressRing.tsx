/* حلقةُ التقدّم — رقمٌ في دائرةٍ تمتلئ، لا شريطٌ ولا نسبةٌ عارية.

   تقرؤها بطاقاتُ «شعبي» ورأسُ صفحة الشعبة: كم أُنجز من التجهيز. وهي درجةٌ
   في `ui/` لا رسمٌ يُعاد في كلّ شاشة — فالحلقةُ نفسُها بالمقاسات نفسِها
   حيثما ظهرت (٨ سبتمبر ٢٠٢٦). والأسلوبُ مؤسّسيّ: امتلاءٌ بلون المنصّة على
   مسارٍ خافت، وانتقالٌ واحدٌ حين تتغيّر القيمة. */

export default function ProgressRing({
  value, label, caption, size = 64, stroke = 6,
}: {
  /** ٠–١٠٠ */
  value: number
  /** ما يُكتب في المنتصف — «٤/٦» أو «٦٧٪» */
  label: string
  /** كلمةٌ تحت الرقم، اختياريّة */
  caption?: string
  size?: number
  stroke?: number
}) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const full = v >= 100
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${caption ? `${caption}: ` : ''}${label} — ${v}٪`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke="currentColor" className={`transition-[stroke-dashoffset] duration-700 ease-out ${full ? 'text-emerald-400' : 'text-teal'}`}
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-black tabular-nums text-foreground" dir="ltr">{label}</span>
        {caption && <span className="mt-0.5 text-fine text-muted-foreground">{caption}</span>}
      </div>
    </div>
  )
}
