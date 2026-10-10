/* ═══ ملفُّ التسليم — ما يُرفع مع الواجب، وكيف يُفتح (١٠ أكتوبر ٢٠٢٦) ═══

   كان التسليمُ نصّا وحدَه، ومهمّةٌ تطلب تسجيلا أو ملفّا لا تُسلَّم إلّا برابطٍ يُلصق. فقال صاحبُ
   المنصّة: «this is our challenge… no need to tell the trainers to make links instead of text or
   files… solve it not limiting the trainers». فيرفع المتعلّمُ ملفّه مع نصّه أو وحدَه، ويفتحه
   مدرّبُه من «طابور التقييم».

   ═══ النوعُ من امتداد الاسم لا من المتصفّح ═══

   ما يقوله المتصفّحُ عن نوع الملفّ يكتبه العميل، وقد يأتي فارغا (HEIC وبعضُ ملفّات Word على
   بعض الأجهزة). فالنوعُ هنا من قائمةٍ مغلقة بالامتداد، ومنها يُخزَّن ويُقدَّم: لا يُرفع ملفُّ HTML أو
   SVG فيُفتح من نطاق المنصّة صفحةً تعمل. وما يُفتح في المتصفّح (PDF والصور والصوت والفيديو
   والنصّ) يُفتح، وما سواه يُنزَّل.

   بلا React ولا خادم — تقرؤه شاشةُ المتعلّم قبل الرفع، والخادمُ عند الطلب وعند التقديم. */

/** أقصى حجمٍ لملفّ التسليم — تسجيلُ فيديو قصيرٍ بجودةٍ عاديّة يدخل فيه */
export const SUBMISSION_FILE_MAX_BYTES = 100 * 1024 * 1024

interface FileType { mime: string; inline: boolean }

const T = (mime: string, inline = false): FileType => ({ mime, inline })

const TYPES: Record<string, FileType> = {
  pdf: T('application/pdf', true),
  doc: T('application/msword'),
  docx: T('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  ppt: T('application/vnd.ms-powerpoint'),
  pptx: T('application/vnd.openxmlformats-officedocument.presentationml.presentation'),
  xls: T('application/vnd.ms-excel'),
  xlsx: T('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  odt: T('application/vnd.oasis.opendocument.text'),
  odp: T('application/vnd.oasis.opendocument.presentation'),
  ods: T('application/vnd.oasis.opendocument.spreadsheet'),
  rtf: T('application/rtf'),
  txt: T('text/plain', true),
  csv: T('text/csv'),
  jpg: T('image/jpeg', true),
  jpeg: T('image/jpeg', true),
  png: T('image/png', true),
  webp: T('image/webp', true),
  gif: T('image/gif', true),
  heic: T('image/heic'),
  heif: T('image/heif'),
  mp3: T('audio/mpeg', true),
  m4a: T('audio/mp4', true),
  wav: T('audio/wav', true),
  ogg: T('audio/ogg', true),
  aac: T('audio/aac', true),
  mp4: T('video/mp4', true),
  mov: T('video/quicktime', true),
  webm: T('video/webm', true),
  m4v: T('video/mp4', true),
  '3gp': T('video/3gpp', true),
  zip: T('application/zip'),
}

/** ما يُكتب في حقل الاختيار — `accept` */
export const SUBMISSION_FILE_ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(',')

/** ما يُقال للمتعلّم عن الأنواع المقبولة — بكلماتٍ يعرفها */
export const SUBMISSION_FILE_KINDS_AR = 'PDF أو Word أو PowerPoint أو Excel أو صورة أو تسجيل صوت أو فيديو أو ملف ZIP'

const extOf = (name: string): string => {
  const m = /\.([A-Za-z0-9]+)$/.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}

/** نوعُ الملفّ من امتداده — `null` لما ليس في القائمة */
export function submissionFileType(name: string): FileType | null {
  return TYPES[extOf(name)] ?? null
}

/** هل يُفتح في المتصفّح أم يُنزَّل — من النوع المخزَّن لا من اسمٍ يكتبه العميل */
export function submissionFileInline(mime: string | null | undefined): boolean {
  if (!mime) return false
  return Object.values(TYPES).some((t) => t.inline && t.mime === mime)
}

/** حجمُ الملفّ كما يُقرأ: «850 كيلوبايت»، «3.2 ميغابايت» */
export function fileSizeAr(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)} ميغابايت`
}

/** سببُ ردّ الملفّ بكلامٍ واضح — `null` إن كان مقبولا */
export function submissionFileProblemAr(name: string, sizeBytes: number): string | null {
  if (!submissionFileType(name)) return `لا يمكن رفع هذا النوع من الملفات. ارفع ${SUBMISSION_FILE_KINDS_AR}.`
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return 'الملف فارغ.'
  /* بلا حجمه: ملفٌّ يزيد بايتا على الحدّ يُقرأ حجمُه «100 ميغابايت» كالحدّ نفسِه */
  if (sizeBytes > SUBMISSION_FILE_MAX_BYTES) return `الملف أكبر من ${fileSizeAr(SUBMISSION_FILE_MAX_BYTES)}، وهو الحد الأقصى للتسليم.`
  return null
}

/** اسمُ الملفّ كما يُحفظ ويُعرض — بلا مسارٍ ولا رموزِ تحكّم، وبطولٍ يُقرأ، وامتدادُه باقٍ */
export function cleanFileName(name: string): string {
  const visible = [...name].filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127).join('')
  const base = visible.replace(/^.*[\\/]/, '').replace(/\s+/g, ' ').trim()
  if (base.length <= 150) return base
  const ext = extOf(base)
  return `${base.slice(0, 150 - ext.length - 2).trimEnd()}….${ext}`
}

/** ملفُّ التسليم كما يخرج إلى الشاشة — بابٌ محروسٌ بدل المفتاح، واسمُه وحجمُه، وهل ينتظر وصولَه.

    «ينتظر» لتسليمٍ طُلب له رابطٌ ولم يصل ملفُّه كاملا (انقطع الرفع). وما سُلّم قبل أن يُحفظ
    الاسمُ لا يُقال عنه «لم يصل» — لا يُعرف ذلك عنه. */
export interface SubmissionFileView {
  fileUrl: string | null
  fileName: string | null
  fileSize: number | null
  fileWaiting: boolean
}

export function submissionFileView(r: {
  storageKey: string | null; fileName: string | null; fileSize: number | null; fileUploadedAt: Date | string | null
}): SubmissionFileView {
  if (!r.storageKey) return { fileUrl: null, fileName: null, fileSize: null, fileWaiting: false }
  return {
    fileUrl: `/api/v1/submission-files/${encodeURIComponent(r.storageKey)}`,
    fileName: r.fileName ?? 'الملف المرفق',
    fileSize: r.fileSize,
    fileWaiting: r.fileName !== null && r.fileUploadedAt === null,
  }
}

/** أيُسلَّم الآن؟ — نصٌّ مكتوب، أو ملفٌّ مقبول، أو كلاهما. وملفٌّ مردودٌ لا يُسلَّم معه شيء */
export function readyToSubmit(text: string | undefined, file: File | { name: string; size: number } | null | undefined): boolean {
  if (file) return submissionFileProblemAr(file.name, file.size) === null
  return Boolean((text ?? '').trim())
}

type FileColumns = { storageKey: string | null; fileName: string | null; fileSize: number | null; fileUploadedAt: Date | string | null; fileMime?: string | null }

/** صفُّ التسليم كما يخرج: بلا مفتاحِ تخزينٍ ولا نوعٍ ولا وقتِ وصول، ومعه بابُ ملفّه (`submissionFileView`) */
export function withSubmissionFileView<T extends FileColumns>(row: T): Omit<T, 'storageKey' | 'fileMime' | 'fileUploadedAt'> & SubmissionFileView {
  const out = { ...row, ...submissionFileView(row) } as unknown as Record<string, unknown>
  delete out.storageKey
  delete out.fileMime
  delete out.fileUploadedAt
  return out as Omit<T, 'storageKey' | 'fileMime' | 'fileUploadedAt'> & SubmissionFileView
}
