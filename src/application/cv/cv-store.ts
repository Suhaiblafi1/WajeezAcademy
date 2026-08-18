/* مخزن السيرة الذاتية — الإصدار الأول (تجريبي محلي).
   - التخزين في IndexedDB الخاص بالمتصفح: الملف لا يدخل مجلد public ولا يُخدم برابط عام أبدا.
   - لا يُرسل محتوى الملف إلى أي نموذج ذكاء اصطناعي — يقرأه المستشار البشري فقط.
   - لا تُستخدم السيرة آليا في تغيير المسار في هذا الإصدار.
   مانع إنتاج موثق: الربط الخادمي الخاص (تخزين مشفر + وصول المستشار) يُبنى عند الانتقال للخادم. */

export const CV_MAX_BYTES = 5 * 1024 * 1024 // 5MB
export const CV_CONSENT_VERSION = 'cv-consent-v1'
export const CV_CONSENT_TEXT_AR =
  'أوافق على مشاركة سيرتي الذاتية مع فريق الاستشارات في أكاديمية وجيز لغرض مراجعة احتياجي التدريبي والتواصل معي.'

const ALLOWED_EXT = ['.pdf', '.doc', '.docx'] as const
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export interface CvFileLike {
  name: string
  size: number
  type: string
}

/** تحقق صارم: الامتداد + نوع MIME + الحجم + اسم الملف */
export function validateCvFile(file: CvFileLike): { ok: true } | { ok: false; reason_ar: string } {
  const name = (file.name ?? '').trim()
  if (name.length === 0 || name.length > 120) {
    return { ok: false, reason_ar: 'اسم الملف غير صالح — أعد تسميته باسم قصير واضح ثم حاول مجددا.' }
  }
  const lower = name.toLowerCase()
  const ext = ALLOWED_EXT.find((e) => lower.endsWith(e))
  if (!ext) {
    return { ok: false, reason_ar: 'الصيغة غير مسموحة — ارفع ملف PDF أو DOC أو DOCX فقط.' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, reason_ar: 'نوع الملف لا يطابق صيغته — تأكد أنه ملف سيرة ذاتية حقيقي وليس ملفا مُعاد تسميته.' }
  }
  if (file.size <= 0) {
    return { ok: false, reason_ar: 'الملف فارغ — اختر ملف سيرتك الفعلي.' }
  }
  if (file.size > CV_MAX_BYTES) {
    return { ok: false, reason_ar: 'حجم الملف يتجاوز 5MB — ضغّطه أو ارفع نسخة أخف.' }
  }
  return { ok: true }
}

export interface CvMeta {
  diagnostic_session_id: string
  user_id: string | null
  name: string | null
  phone: string | null
  uploaded_at: string
  consent_version: string
  original_filename: string
  storage_key: string
  review_status: 'pending_advisor_review'
}

interface CvRecord extends CvMeta {
  blob: Blob
}

const DB_NAME = 'wajeez-private-cv'
const STORE = 'cv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'storage_key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** يحفظ السيرة محليا بشكل خاص مع بياناتها الوصفية — بلا أي إرسال شبكي */
export async function saveCvPrivate(
  file: File,
  meta: {
    diagnosticSessionId: string
    userId?: string | null
    name?: string | null
    phone?: string | null
  },
): Promise<CvMeta> {
  const record: CvRecord = {
    diagnostic_session_id: meta.diagnosticSessionId,
    user_id: meta.userId ?? null,
    name: meta.name ?? null,
    phone: meta.phone ?? null,
    uploaded_at: new Date().toISOString(),
    consent_version: CV_CONSENT_VERSION,
    original_filename: file.name,
    storage_key: `cv-${meta.diagnosticSessionId}`,
    review_status: 'pending_advisor_review',
    blob: file,
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => {
      const { blob: _blob, ...m } = record
      void _blob
      resolve(m)
    }
    tx.onerror = () => reject(tx.error)
  })
}

/** يقرأ البيانات الوصفية لسيرة الجلسة إن وجدت — دون تحميل الملف نفسه */
export async function loadCvMeta(diagnosticSessionId: string): Promise<CvMeta | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(`cv-${diagnosticSessionId}`)
    req.onsuccess = () => {
      const rec = req.result as CvRecord | undefined
      if (!rec) return resolve(null)
      const { blob: _blob, ...m } = rec
      void _blob
      resolve(m)
    }
    req.onerror = () => reject(req.error)
  })
}

/** حذف السيرة قبل مراجعتها — حق المستخدم في التراجع */
export async function deleteCv(diagnosticSessionId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(`cv-${diagnosticSessionId}`)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
