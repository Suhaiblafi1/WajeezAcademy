/* مؤطِّرُ الصورة — صاحبُها يختار ما يظهر، لا نحن.

   ═══ الطلبُ ═══

   قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «اسمح للمستخدم أن يعمل زوم أو يحدّد
   المربّع الذي يريد أن يظهر بدلا من أن تكون الصورة صغيرة».

   فكان القصُّ من الوسط دائما — وهو تخمينٌ يُخرج وجها في حافّةٍ أو يقطعه.

   ═══ ولمَ بلا مكتبة ═══

   مكتباتُ القصّ الجاهزة تزيد المستودَعَ حزمةً وهو على أربعٍ وعشرين، والمطلوبُ
   هنا إزاحةٌ ومقياسٌ لا أكثر. والحسابُ كلُّه في `prepare-image.ts` ليُقاس
   باختبار — وهذا الملفُّ يدٌ عليه لا منطقٌ فيه.

   ═══ والمعاينةُ تصدُق ═══

   النافذةُ مربّعةٌ وما فيها هو ما يُرفع بعينه: المعاينةُ تُرسم على قماشٍ
   بـ`cropRect` نفسِها التي يقتطع بها المُخرَج — لا بـ`transform` يقارب. فما
   رآه صاحبُها هو ما يخرج، بكسلا ببكسل. */

import { useEffect, useRef, useState } from 'react'
import { Check, X, ZoomIn } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Inset } from '@/components/ui/Surface'
import {
  decode, renderFraming, cropRect, framingIsSoft, FRAMING_CENTER, MAX_ZOOM,
  PHOTO_MIN_SIDE, ImageConditionError, type Decoded, type Framing,
} from '@/lib/prepare-image'

/** ضلعُ نافذة المعاينة بالبكسل — مربّعةٌ كما يُعرض */
const VIEW = 260

export default function ImageFramer({
  file, onDone, onCancel,
}: {
  file: File
  onDone: (blob: Blob) => void | Promise<void>
  onCancel: () => void
}) {
  const [img, setImg] = useState<Decoded | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [framing, setFraming] = useState<Framing>(FRAMING_CENTER)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)

  /* الفكُّ مرّةً واحدة، والتحريرُ عند الإغلاق — `ImageBitmap` يحجز ذاكرة */
  useEffect(() => {
    let live = true
    let opened: Decoded | null = null
    void (async () => {
      try {
        const d = await decode(file)
        if (!live) { d.release(); return }
        opened = d
        setImg(d)
      } catch (e) {
        setErr(e instanceof ImageConditionError ? e.message : 'تعذّر فكُّ الصورة')
      }
    })()
    return () => { live = false; opened?.release() }
  }, [file])

  /* المعاينةُ تُرسم بالحساب نفسِه الذي يقتطع — فلا تفترق عن المُخرَج */
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !img) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const { sx, sy, side } = cropRect(img.width, img.height, framing)
    ctx.clearRect(0, 0, VIEW, VIEW)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img.source, sx, sy, side, side, 0, 0, VIEW, VIEW)
  }, [img, framing])

  /* السحبُ بإحداثيّات المصدر: بكسلُ شاشةٍ واحدٌ يساوي `side/VIEW` من المصدر */
  const move = (dxView: number, dyView: number) => {
    if (!img) return
    const ratio = cropRect(img.width, img.height, framing).side / VIEW
    setFraming((f) => ({
      ...f,
      offsetX: f.offsetX - dxView * ratio,
      offsetY: f.offsetY - dyView * ratio,
    }))
  }

  const soft = img ? framingIsSoft(img.width, img.height, framing) : false

  const confirm = async () => {
    if (!img) return
    setBusy(true)
    try {
      await onDone(await renderFraming(img, framing))
    } catch (e) {
      setErr(e instanceof ImageConditionError ? e.message : 'تعذّر تجهيزُ الصورة')
    } finally { setBusy(false) }
  }

  return (
    <Inset className="mt-3">
      <p className="text-read font-black">أطّر صورتك — ما داخل المربّع هو ما يظهر</p>

      {err ? (
        <p role="alert" className="mt-2 text-read leading-5 font-semibold text-red-300">{err}</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-start gap-4">
            <canvas
              ref={canvasRef}
              width={VIEW}
              height={VIEW}
              aria-label="معاينةُ الإطار"
              className="h-[260px] w-[260px] max-w-full shrink-0 cursor-move touch-none rounded-2xl bg-black/30 ring-1 ring-white/15"
              onPointerDown={(e) => {
                drag.current = { x: e.clientX, y: e.clientY }
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (!drag.current) return
                /* الأفقيُّ معكوسٌ في RTL؟ لا — الإحداثيّاتُ بكسلاتُ شاشةٍ لا اتّجاهُ نصّ */
                move(e.clientX - drag.current.x, e.clientY - drag.current.y)
                drag.current = { x: e.clientX, y: e.clientY }
              }}
              onPointerUp={() => { drag.current = null }}
              onPointerCancel={() => { drag.current = null }}
              onWheel={(e) => {
                setFraming((f) => ({
                  ...f,
                  zoom: Math.min(MAX_ZOOM, Math.max(1, f.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))),
                }))
              }}
            />

            <div className="min-w-48 flex-1">
              <label className="flex items-center gap-2 text-fine font-bold text-muted-foreground" htmlFor="framer-zoom">
                <ZoomIn className="h-3.5 w-3.5" /> التقريب
              </label>
              <input
                id="framer-zoom"
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.05}
                value={framing.zoom}
                onChange={(e) => setFraming((f) => ({ ...f, zoom: Number(e.target.value) }))}
                className="mt-1 w-full accent-teal"
              />
              <p className="mt-1 text-fine leading-5 text-muted-foreground">
                اسحب الصورةَ بإصبعك أو بالفأرة · ودولابُ الفأرة يقرّب ويبعّد
              </p>
              {soft && (
                <p className="mt-2 text-read leading-5 font-semibold text-gold-ink">
                  ستبدو أقلَّ حدّةً — المأخوذُ دون {PHOTO_MIN_SIDE} بكسل. بعّد قليلا لجودةٍ أفضل.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button tone="confirm" size="sm" disabled={busy || !img} onClick={() => void confirm()}>
              <Check className="h-3.5 w-3.5" /> {busy ? 'جارٍ الرفع…' : 'استعمِل هذا الإطار'}
            </Button>
            <Button tone="ghost" size="sm" disabled={busy} onClick={onCancel}>
              <X className="h-3.5 w-3.5" /> إلغاء
            </Button>
          </div>
        </>
      )}
    </Inset>
  )
}
