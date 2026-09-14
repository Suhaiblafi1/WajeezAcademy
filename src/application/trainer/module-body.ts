/* المحتوى النظريُّ: مكتوبٌ أو ملفٌّ يُقرأ — قسمةٌ واحدةٌ (ع-٢ · تمامُ د-١).

   ═══ ما يطلبه البند ═══

   «المدرّبُ يُرفق وثيقةً **بدلا** من أن يكتب النظريّةَ، ويقرؤها المتعلّمُ في
   بوّابته». و«بدلا» هي الكلمة: الملفُّ يُغني عن الكتابة، لا يُضاف إليها.

   ═══ فلمَ لا يكون المكتوبُ وحدَه هو الأصل ═══

   `LessonBody` وMarkdownُه المقيَّد بناءٌ متينٌ: يُقسَّم إلى دروسٍ، وتُركَّب
   عليه تمارينُ الاسترجاع، ويُقرأ على الهاتف كما يُقرأ على الحاسوب. والملفُّ
   لا شيءَ من ذلك — صفحةٌ تُفتح أو تُنزَّل.

   ولكنّ البديلَ عنه ليس متنا أحسنَ، بل **محورا فارغا**: مدرّبٌ معه عرضُه
   جاهزا لا يُعيد كتابتَه في محرّرٍ، فيترك الخانةَ خاليةً — ويقرأ متعلّمُه
   «هذه الوحدة قيد التأليف». فالملفُّ يكسب حين تكون المقارنةُ به لا بالمتن.

   ═══ ولمَ أربعةُ ميغابايت لا عشرون ═══

   كنتُ أوصيتُ بعشرين. وهو خطأٌ: مسارُ الرفع يقرأ الجسمَ **كاملا في
   الذاكرة** وحدُّه `bodyLimit: MAX_UPLOAD_ANY` — أربعةٌ. فإعلانُ عشرين
   يجعل Fastify يردّ الطلبَ قبل أن يبلغ الفحصَ، ويقرأ المدرّبُ رفضا لا
   يفهمه. وأربعةٌ هي سقفُ كلّ وثيقةٍ في المنصّة (شهاداتٌ وسيَرٌ وأدلّة)،
   فلا سقفَ ثانيا يُتذكَّر. */

/** أقلُّ ما يُعدّ محتوًى مكتوبا — مستوردٌ من مالكه في الخادم */
export const MIN_MODULE_BODY = 40

/* ── الصيغتان، ولمَ هما دون غيرهما ──

   PDF يُقرأ في الصفحة نفسِها في كلّ متصفّحٍ بلا مكتبة. وWord صيغةُ من يكتب
   عرضَه أصلا، ويُنزَّل. وما عداهما — صورٌ وشرائحُ ونصوصٌ — بابُه «المصادر»
   (د-٣) وهو مفتوحٌ أصلا: المحتوى النظريُّ **درسٌ يُقرأ** لا مرفقٌ يُجمع. */
export const BODY_FILE_TYPES = [
  { mime: 'application/pdf', ext: 'pdf', labelAr: 'PDF', inline: true },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx', labelAr: 'Word', inline: false,
  },
] as const

export type BodyFileMime = (typeof BODY_FILE_TYPES)[number]['mime']

export const BODY_FILE_MIMES: readonly string[] = BODY_FILE_TYPES.map((t) => t.mime)

/** سقفُ الملفّ — سقفُ الوثائق نفسُه، لا سقفٌ ثانٍ يُتذكَّر */
export const MAX_BODY_FILE_BYTES = 4 * 1024 * 1024

/** أيُقرأ في الصفحة أم يُنزَّل؟ PDF وحدَه يُقرأ */
export function readsInline(mime: string | null | undefined): boolean {
  return BODY_FILE_TYPES.some((t) => t.mime === mime && t.inline)
}

export function bodyFileLabelAr(mime: string | null | undefined): string {
  return BODY_FILE_TYPES.find((t) => t.mime === mime)?.labelAr ?? 'ملفّ'
}

/** لماذا يُردّ هذا الملفّ — أو `null` فيُقبل */
export function bodyFileBlockerAr(mime: string, sizeBytes?: number): string | null {
  if (!BODY_FILE_MIMES.includes(mime)) {
    return `لا يُقبل إلّا ${BODY_FILE_TYPES.map((t) => t.labelAr).join(' أو ')} — وما عداهما يُرفع في «المصادر»`
  }
  if (typeof sizeBytes === 'number' && sizeBytes > MAX_BODY_FILE_BYTES) {
    return `الملفُّ أكبرُ من ${Math.round(MAX_BODY_FILE_BYTES / (1024 * 1024))} ميغابايت`
  }
  return null
}

/* ═══ وتمامُ المحور — القاعدةُ التي يغيّرها ع-٢ ═══

   كانت: «مكتوبٌ بأربعين حرفا». وصارت: «مكتوبٌ **أو** مرفوع». وهي في موضعٍ
   واحدٍ يقرؤه الخادمُ (بوّابةُ الإرسال) وتقرؤه شاشةُ المدرّب (قائمةُ ما
   ينقص) وتقرؤه شاشةُ المتعلّم — فلا يقول أحدُهما «تامّ» ويقول الآخرُ «ناقص».

   ولمَ لا يُشترط الاثنان: «بدلا» في نصّ البند. ومن كتب ورفع فله الاثنان،
   والمتعلّمُ يقرأ المكتوبَ ويجد الملفَّ تحته. */
export interface ModuleBodyLike {
  bodyAr?: string | null
  bodyFileKey?: string | null
}

export function moduleBodyDone(m: ModuleBodyLike): boolean {
  if ((m.bodyFileKey ?? '').trim().length > 0) return true
  return (m.bodyAr ?? '').trim().length >= MIN_MODULE_BODY
}

/** ما ينقص هذا المحورَ، بعبارةٍ تقول البديلَ لا «غيرُ مكتمل» */
export function moduleBodyBlockerAr(m: ModuleBodyLike): string | null {
  if (moduleBodyDone(m)) return null
  return `اكتب أربعين حرفا على الأقلّ، أو أرفق ${BODY_FILE_TYPES.map((t) => t.labelAr).join(' أو ')}`
}
