/* شروطُ الصورة تُفرض في المتصفّح — قبل أن تُرسَل بايتةٌ واحدة.

   ═══ لماذا هنا ═══

   قرارُ صاحب المنصّة (١٤ سبتمبر ٢٠٢٦): «the system have conditions for the
   picture so it fits the design». والشرطُ إمّا أن يُفرض على الخادم بمكتبةِ
   صورٍ (`sharp`: اعتماديّةٌ ثنائيّةٌ أصليّةٌ في مستودَعٍ فيه أربعٌ وعشرون)،
   وإمّا في المتصفّح بـ`canvas` وهو موجودٌ أصلا بلا تثبيتِ شيء.

   والمختارُ الثاني، ومعه فحصُ توقيعِ البايتات على الخادم
   (`sniffImageMime`) — فالمتصفّحُ يُحسِن الصورةَ ولا يُوثَق به وحدَه: من
   تجاوز الشاشةَ ورفع بايتاتٍ مباشرةً يسقط هناك.

   ═══ وماذا يفعل بالضبط ═══

   ١) يردّ ما ليس JPEG أو PNG أو WebP.
   ٢) يردّ ما كان ضلعُه دون ٤٠٠ — فالصغيرةُ تُنفخ فتُرى مهترئةً في ٩٦ بكسل
      على شاشةٍ مضاعفةِ الكثافة، ونفخُها في العرض أسوأُ من ردّها في الرفع.
   ٣) يقتطع **مربّعا من الوسط**: التصميمُ يعرضها دائرةً أو مربّعا، والمستطيلُ
      يُقصّ في العرض على كلّ حال — فالقصُّ هنا مرئيٌّ لصاحبه لا مفاجأةٌ بعده.
   ٤) يحجّمها إلى ٥١٢، ويعيد ترميزَها WebP.

   ═══ وأثرٌ جانبيٌّ مقصود: تختفي EXIF ═══

   صورةُ الهاتف تحمل في ترويستها إحداثيّاتِ المكان الذي التُقطت فيه — وهو
   بيتُ صاحبها غالبا. و`canvas` يرسم **البكسلاتِ وحدَها** ثمّ يصدّرها، فلا
   تعبر الترويسةُ إلى الملفّ الجديد. فما يصل الخادمَ صورةٌ بلا موضع. */

export const PHOTO_MIN_SIDE = 400
export const PHOTO_OUT_SIDE = 512
export const PHOTO_OUT_MIME = 'image/webp'
export const PHOTO_IN_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** خطأٌ برسالةٍ عربيّةٍ تُعرض كما هي — لا رمزٌ تترجمه الشاشة */
export class ImageConditionError extends Error {}

/* ═══ ولمَ لا `blob:` هنا — وقد كانت، فمنعتها السياسة ═══

   كان الفكُّ يصنع `URL.createObjectURL(file)` ويسنده إلى `<img>`. وسياسةُ
   أمان الموقع في `deploy/Caddyfile` تقول `img-src 'self' data:` — **بلا
   `blob:`**. فكان المتصفّحُ يمنع الرابطَ ويُطلق `onerror`، ونقول نحن «قد
   يكون الملفُّ تالفا». والملفُّ سليم، والسياسةُ منعته — فكانت الرسالةُ
   تتّهم صاحبَها بما ليس فيه.

   والإصلاحُ هنا لا في السياسة: `createImageBitmap` يفكّ الملفَّ **بلا رابطٍ
   أصلا**، فلا تمسّه `img-src` ولا تُوسَّع السياسةُ لأجل شاشةٍ واحدة. وإن
   غاب — متصفّحٌ قديم — فالتراجعُ إلى `data:` وهي مسموحةٌ في السياسة نصّا. */

export interface Decoded {
  source: CanvasImageSource
  width: number
  height: number
  /** يُنادى بعد الرسم: `ImageBitmap` يحجز ذاكرةً لا يحرّرها جامعُ القمامة وحدَه */
  release: () => void
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new ImageConditionError('تعذّرت قراءةُ الملفّ من جهازك'))
    reader.readAsDataURL(file)
  })
}

function loadFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new ImageConditionError(
      'تعذّر فكُّ الصورة — جرّب صيغةً أخرى (JPEG أو PNG)',
    ))
    img.src = url
  })
}

export async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch {
      /* بعضُ المتصفّحات لا تفكّ كلَّ الصيغ بهذا الطريق — فالتراجعُ لا الفشل */
    }
  }
  const img = await loadFromUrl(await readAsDataUrl(file))
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => { /* لا شيءَ يُحرَّر */ },
  }
}

/* ═══ هندسةُ الإطار — تُحسب هنا لتُقاس، لا في المكوّن ═══

   المؤطِّرُ يعرض الصورةَ في نافذةٍ مربّعة، ولصاحبها إزاحةٌ ومقياس. وما
   يُرفع هو **ما تحت النافذة** لا الصورةُ كلُّها.

   والحسابُ في ملفٍّ لا شاشةٍ بقصد: القاعدتان اللتان لا تُريان بالنظر —
   أنّ المُخرَج يبقى مربّعا ٥١٢ مهما كان الإطار، وأنّ الإزاحةَ لا تخرج عن
   حدود الصورة فتُرسم حافّةٌ سوداء — تُحرَسان باختبارٍ لا بتجربةِ يد. */

export interface Framing {
  /** مقياسُ العرض: ١ يعني أنّ الضلعَ الأقصرَ يملأ النافذةَ تماما */
  zoom: number
  /** إزاحةُ المركز بالبكسل في إحداثيّات **المصدر** */
  offsetX: number
  offsetY: number
}

export const FRAMING_CENTER: Framing = { zoom: 1, offsetX: 0, offsetY: 0 }
export const MAX_ZOOM = 5

/** ضلعُ المربّع المقتطَع من المصدر عند هذا التقريب */
export function sourceSide(width: number, height: number, zoom: number): number {
  return Math.min(width, height) / Math.max(1, zoom)
}

/**
 * يحوّل الإطارَ إلى مستطيلِ اقتطاعٍ داخلَ حدود الصورة.
 * والإزاحةُ **تُقصّ** عند الحدّ: من سحب أبعدَ من الحافّة يقف عندها، فلا
 * تُرسم حافّةٌ سوداء في المُخرَج.
 */
export function cropRect(
  width: number, height: number, framing: Framing,
): { sx: number; sy: number; side: number } {
  const side = sourceSide(width, height, framing.zoom)
  const maxX = (width - side) / 2
  const maxY = (height - side) / 2
  const dx = Math.min(maxX, Math.max(-maxX, framing.offsetX))
  const dy = Math.min(maxY, Math.max(-maxY, framing.offsetY))
  return { sx: (width - side) / 2 + dx, sy: (height - side) / 2 + dy, side }
}

/** أدونَ الحدِّ حدّةً؟ — يُقاس **المربّعُ المختار** لا الملفُّ كلُّه */
export function framingIsSoft(width: number, height: number, framing: Framing): boolean {
  return cropRect(width, height, framing).side < PHOTO_MIN_SIDE
}

/**
 * يفحص الصورةَ ويجهّزها: مربّعةً ٥١٢ بـWebP، بلا بياناتِ موضع.
 * يرمي `ImageConditionError` برسالةٍ عربيّةٍ إن خالفت شرطا.
 */
export async function prepareImage(file: File, framing: Framing = FRAMING_CENTER): Promise<Blob> {
  if (!(PHOTO_IN_MIMES as readonly string[]).includes(file.type)) {
    throw new ImageConditionError('الصورةُ JPEG أو PNG أو WebP')
  }

  const img = await decode(file)
  try {
    return await renderFraming(img, framing)
  } finally {
    img.release()
  }
}

/** يرسم المربّعَ المختار إلى ٥١٢ ويرمّزه — يُنادى بعد فكٍّ قائم */
export async function renderFraming(img: Decoded, framing: Framing): Promise<Blob> {
  {
    const { sx, sy, side } = cropRect(img.width, img.height, framing)

    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_OUT_SIDE
    canvas.height = PHOTO_OUT_SIDE
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageConditionError('تعذّرت معالجةُ الصورة في هذا المتصفّح')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img.source, sx, sy, side, side, 0, 0, PHOTO_OUT_SIDE, PHOTO_OUT_SIDE)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, PHOTO_OUT_MIME, 0.82)
    })
    if (!blob) throw new ImageConditionError('تعذّر ترميزُ الصورة')
    return blob
  }
}
