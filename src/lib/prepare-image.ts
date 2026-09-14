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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageConditionError('تعذّرت قراءةُ الصورة — قد يكون الملفُّ تالفا'))
    }
    img.src = url
  })
}

/**
 * يفحص الصورةَ ويجهّزها: مربّعةً ٥١٢ بـWebP، بلا بياناتِ موضع.
 * يرمي `ImageConditionError` برسالةٍ عربيّةٍ إن خالفت شرطا.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!(PHOTO_IN_MIMES as readonly string[]).includes(file.type)) {
    throw new ImageConditionError('الصورةُ JPEG أو PNG أو WebP')
  }

  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  if (side < PHOTO_MIN_SIDE) {
    throw new ImageConditionError(
      `الصورةُ صغيرة (${img.naturalWidth}×${img.naturalHeight}) — أقلُّ ضلعٍ ${PHOTO_MIN_SIDE} بكسل`,
    )
  }

  /* المربّعُ من الوسط: ما زاد من الضلع الأطول يُقصّ نصفَين متساويَين */
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_OUT_SIDE
  canvas.height = PHOTO_OUT_SIDE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageConditionError('تعذّرت معالجةُ الصورة في هذا المتصفّح')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_OUT_SIDE, PHOTO_OUT_SIDE)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, PHOTO_OUT_MIME, 0.82)
  })
  if (!blob) throw new ImageConditionError('تعذّر ترميزُ الصورة')
  return blob
}
