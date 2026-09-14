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


/* ═══ أغراضُ ملفّات الشعبة — ولمَ هما في ملفٍّ واحد (د-٣) ═══

   متنُ المحور (ع-٢) وملفُّ المصدر (د-٣) يختلفان في ما يُقبل منهما: المتنُ
   درسٌ يُقرأ فصيغتاه PDF وWord، والمصدرُ قد يكون شريحةً أو جدولا أو صورةً —
   فبابُه أوسع.

   ويتّفقان في **من يقرأ**: من التحق بالشعبة، أو مدرّبُها، أو من يعتمد
   خطّتَها. وتلك قاعدةُ وصولٍ، ونسخُها في موضعَين أخطرُ من سطرٍ مكرَّر —
   تُشدَّد في أحدهما وتُنسى في الآخر. فالحارسُ واحدٌ والمقبولُ يختلف. */
export const FILE_PURPOSES = ['module_body', 'plan_resource'] as const
export type FilePurpose = (typeof FILE_PURPOSES)[number]

/* ── وما يُقبل مصدرا ──

   د-٣ يقول «PDF ورابطٌ وفيديو وغيرُها». والمرفوعُ منها ما يُخزَّن ويُقرأ:
   وثيقةٌ أو شريحةٌ أو جدولٌ أو صورة. وما عداها رابطٌ يُلصق — ولا نستضيف
   فيديو، وقد قيل في `Recording` نصّا: «نستضيف ونربط». */
export const RESOURCE_FILE_TYPES = [
  { mime: 'application/pdf', labelAr: 'PDF', inline: true },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    labelAr: 'Word', inline: false,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    labelAr: 'شرائح', inline: false,
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    labelAr: 'جدول', inline: false,
  },
  { mime: 'image/png', labelAr: 'صورة', inline: true },
  { mime: 'image/jpeg', labelAr: 'صورة', inline: true },
] as const

export const RESOURCE_FILE_MIMES: readonly string[] = RESOURCE_FILE_TYPES.map((t) => t.mime)

/** ما يُقبل لكلّ غرض — مالكٌ واحدٌ يقرؤه الخادمُ والشاشة */
export function acceptedMimes(purpose: FilePurpose): readonly string[] {
  return purpose === 'module_body' ? BODY_FILE_MIMES : RESOURCE_FILE_MIMES
}

export function fileLabelAr(purpose: FilePurpose, mime: string | null | undefined): string {
  if (purpose === 'module_body') return bodyFileLabelAr(mime)
  return RESOURCE_FILE_TYPES.find((t) => t.mime === mime)?.labelAr ?? 'ملفّ'
}

/** أيُعرض في الصفحة أم يُنزَّل؟ */
export function fileReadsInline(purpose: FilePurpose, mime: string | null | undefined): boolean {
  if (purpose === 'module_body') return readsInline(mime)
  return RESOURCE_FILE_TYPES.some((t) => t.mime === mime && t.inline)
}

/** لماذا يُردّ هذا الملفُّ لهذا الغرض — أو `null` فيُقبل */
export function fileBlockerAr(
  purpose: FilePurpose, mime: string, sizeBytes?: number,
): string | null {
  const allowed = acceptedMimes(purpose)
  if (!allowed.includes(mime)) {
    const names = purpose === 'module_body'
      ? BODY_FILE_TYPES.map((t) => t.labelAr)
      : [...new Set(RESOURCE_FILE_TYPES.map((t) => t.labelAr))]
    return `لا يُقبل إلّا ${names.join(' أو ')}`
  }
  if (typeof sizeBytes === 'number' && sizeBytes > MAX_BODY_FILE_BYTES) {
    return `الملفُّ أكبرُ من ${Math.round(MAX_BODY_FILE_BYTES / (1024 * 1024))} ميغابايت`
  }
  return null
}

/* ═══ ومصدرٌ له ما يُفتح — رابطٌ أو ملفّ (د-٣) ═══

   كان الشرطُ «رابطٌ بصيغةِ https» في موضعَين: زرُّ الحفظ في الشاشة، وحاجزُ
   الحفظ عند الخادم. وزاد د-٣ بديلا — ملفٌّ مرفوع — فلو زِيد في أحدهما دون
   الآخرَ رُفع الملفُّ ثمّ رُدّ حفظُه، أو حُفظ مصدرٌ لا يقود إلى شيء.

   فمالكٌ واحدٌ يقرؤه الطرفان. */
export interface ResourceSourceLike {
  url?: string | null
  bodyFileKey?: string | null
}

export function resourceHasSource(r: ResourceSourceLike): boolean {
  if ((r.bodyFileKey ?? '').trim().length > 0) return true
  return /^https?:\/\//.test((r.url ?? '').trim())
}

/** ما ينقص هذا المصدرَ — أو `null` فهو تامّ */
export function resourceSourceBlockerAr(r: ResourceSourceLike): string | null {
  return resourceHasSource(r) ? null : 'بلا رابطٍ ولا ملفّ — ولا يُعرض على متعلّمٍ سطرٌ لا يقود إلى شيء'
}
