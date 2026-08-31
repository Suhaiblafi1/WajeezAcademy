/* مسودّة طلب الانضمام — تُحفظ عند المتقدّم فلا يبدأ من الصفر.

   النموذج طويلٌ بطبعه: هويةٌ وخبرةٌ واعتمادٌ ودافعٌ ومستندات. ومن أغلق اللسان
   ليبحث عن رقم اعتماده، أو نفدت بطاريته، أو ضغط «رجوع» — كان يعود إلى نموذج
   فارغ فلا يعيده أحد. فيُهجَر الطلب لا لأن صاحبه عدل عنه بل لأن الآلة نسيت.

   والحفظ عند المتصفّح لا عند الخادم: القسم الأول لم يُرسَل بعدُ أصلا، ولا
   حساب للمتقدّم قبله. وما لا يُحفظ: كلمة المرور ورمز التحقق — أسرارٌ عابرة
   لا مكان لها في تخزينٍ يبقى.

   والوحدة نقيّة لا تلمس React: تُختبر بمعزل، وتحرس ما لا يُحفظ. */

export const DRAFT_KEY = 'wajeez_trainer_draft_v1'
/* شهرٌ يكفي لمن يجمع أوراقه، ولا يُبقي بياناته عند متصفّحٍ نسيها */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface TrainerDraft {
  savedAt: number
  step: number
  form: Record<string, string | boolean>
  specialties: string[]
  languages: string[]
  targetCountries: string[]
  targetAudiences: string[]
  teachable: string[]
  teachableOther: string
  days: string[]
  periods: string[]
  hoursPerWeek: string
  startFrom: string
  demoConsent: boolean
  reference?: string
  candidateToken?: string
}

/* ما لا يُكتب أبدا مهما مرّ في `form` — الحارس يقرأ من هنا لا من ذاكرته */
export const NEVER_PERSISTED = ['accountPassword', 'verifyTokenInput', 'password'] as const

export function serializeDraft(d: Omit<TrainerDraft, 'savedAt'>, now: number = Date.now()): string {
  const form: Record<string, string | boolean> = {}
  for (const [k, v] of Object.entries(d.form)) {
    if ((NEVER_PERSISTED as readonly string[]).includes(k)) continue
    form[k] = v
  }
  return JSON.stringify({ ...d, form, savedAt: now })
}

export function saveDraft(d: Omit<TrainerDraft, 'savedAt'>, now: number = Date.now()): void {
  try {
    localStorage.setItem(DRAFT_KEY, serializeDraft(d, now))
  } catch {
    /* وضعٌ خاصّ أو تخزينٌ ممتلئ — المسودّة رفاهية لا تُسقط النموذج */
  }
}

export function loadDraft(now: number = Date.now()): TrainerDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as TrainerDraft
    if (typeof d?.savedAt !== 'number' || now - d.savedAt > DRAFT_TTL_MS) {
      clearDraft()
      return null
    }
    return d
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* لا شيء يُفعل — ولا شيء ينكسر */
  }
}

/** هل في المسودّة ما يستحقّ استئنافه؟ نموذجٌ لم يُمسّ لا يُعرض له إشعار */
export function draftHasContent(d: TrainerDraft): boolean {
  const typed = Object.entries(d.form).some(([k, v]) =>
    k !== 'phoneCountryCode' && (typeof v === 'string' ? v.trim().length > 0 : v === true))
  return typed || d.specialties.length > 0 || d.teachable.length > 0 || d.teachableOther.trim().length > 0
}
