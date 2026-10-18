/* موادُّ الدورة في طور العرض المشروط — ما يكتبه المدرّبُ لكلّ دورةٍ اخترناها له.

   ═══ العطبُ الذي وُلد منه ═══

   العقدُ (البند 2-8) ورسالةُ اعتماد التوقيع يَعِدان المدرّبَ بخمسة أيّامٍ
   «تضع فيها محاور دوراتك التي أُهّلت لها ومواردها وواجباتها» في بوّابته.
   ولم يكن في البوّابة موضعٌ لذلك: مساحةُ الشعبة لا تُفتح قبل التفعيل
   والإسناد، و«مؤهّلاتي» لا تُظهر الدوراتِ قيد الإعداد، و«أعلنتُ اكتمالها»
   يجمّد المهلةَ ولا يحمل شيئا. فكان يُعلن اكتمالَ ما لا مكانَ له.

   قرارُ صاحب المنصّة (٣٠ سبتمبر ٢٠٢٦): لوحُ موادٍّ لكلّ دورةٍ في «مؤهّلاتي»
   نفسِها — لا تبويبٌ جديد، فقد أُغلق «تعديلاتي على دوراتي» بقراره.

   ═══ وما فيه، ولمَ هذا القدر ═══

   الخمسةُ التي يَعِد بها العقد، بأقلّ ما يُقيَّم به: محاورُ بمخرجاتها،
   ورابطُ مجلّد الموادّ (الكرّاسات والعروض — ملفّاتٌ تُرفع حيث يرفعها
   المدرّبُ عادةً)، ومهمّةٌ يسلّمها المتعلّم، ومصادرُ يقرؤها. والمحاورُ تبدأ
   من الكتالوج فيعدّلها ولا يكتبها من فراغ.

   والوحدةُ خالصةٌ يقرؤها الخادمُ والشاشةُ معا: ما تقول الشاشةُ إنّه ناقصٌ
   هو ما يردّ به الإعلانُ بعينه. */

export interface MaterialsModule {
  titleAr: string
  outcomeAr: string
}

export interface CourseMaterials {
  modules: MaterialsModule[]
  /** رابطُ مجلّد الموادّ — الكرّاساتُ والعروض */
  materialsUrl: string | null
  /** مهمّةٌ واحدةٌ على الأقلّ يسلّمها المتعلّم ويُقيَّم عليها */
  taskAr: string
  /** المصادر — سطرٌ لكلّ مصدر */
  sourcesAr: string
  /** ما يريد أن يقوله لمن يراجع — اختياريّ */
  noteAr: string
}

export const MATERIALS_MAX_MODULES = 20
export const MATERIALS_LINE = 160
export const MATERIALS_TEXT = 2000
export const MATERIALS_URL = 500

const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

/** رابطٌ يبدأ بـhttps:// وله نطاقٌ — وما سواه فراغ */
export function cleanMaterialsUrl(v: unknown): string | null {
  const s = text(v, MATERIALS_URL)
  if (!s || /\s/.test(s)) return null
  try {
    const u = new URL(s)
    return u.protocol === 'https:' && u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

/** ينظّف حمولةً غيرَ موثوقة — ما لا يُعرف يسقط، والمحورُ بلا عنوانٍ يسقط */
export function cleanCourseMaterials(raw: unknown): CourseMaterials {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const modules = (Array.isArray(r.modules) ? r.modules : [])
    .map((m) => {
      const o = m && typeof m === 'object' ? (m as Record<string, unknown>) : {}
      return { titleAr: text(o.titleAr, MATERIALS_LINE), outcomeAr: text(o.outcomeAr, MATERIALS_TEXT) }
    })
    .filter((m) => m.titleAr.length > 0)
    .slice(0, MATERIALS_MAX_MODULES)
  return {
    modules,
    materialsUrl: cleanMaterialsUrl(r.materialsUrl),
    taskAr: text(r.taskAr, MATERIALS_TEXT),
    sourcesAr: text(r.sourcesAr, MATERIALS_TEXT),
    noteAr: text(r.noteAr, MATERIALS_TEXT),
  }
}

/** ما ينقص الموادَّ لتُقيَّم — فارغةٌ إن اكتملت. والخادمُ يردّ الإعلانَ بها بعينها */
export function materialsMissingAr(m: CourseMaterials | null | undefined): string[] {
  if (!m) return ['لم تكتب موادّها بعد']
  const out: string[] = []
  if (m.modules.length === 0) out.push('محور واحد على الأقلّ')
  else if (m.modules.some((x) => x.outcomeAr.length === 0)) out.push('مخرج لكلّ محور')
  if (!m.materialsUrl) out.push('رابط الموادّ (الكرّاسات والعروض)')
  if (!m.taskAr) out.push('مهمّة يسلّمها المتعلّم')
  if (!m.sourcesAr) out.push('مصدر واحد على الأقلّ')
  return out
}

/* ═══ علامةُ الموادّ على الدورة المعتمَدة بلا شعبة (١٨ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة عن «جهّز شعب التعبئة»: «أصحيحٌ أنّ هذه الدورات معتمَدةٌ وموادَّها جاهزة؟».
   والاعتمادُ يقينٌ فيها — ولا يقين في الموادّ: الدورةُ تُعتمَد بلا شعبةٍ بطريقين، بزرّ «اعتمد هذه
   الدورة بموادّها» (ما كتبه في اللوح القديم) أو تأهيلا مباشرا لا يسأل عن موادّ. فاختار: «علِّمْ كلَّ
   دورة». والعلامةُ من صفّ التأهيل نفسِه — ما كُتب فيه وما ينقصه (`materialsMissingAr`). */
export type MaterialsMark = 'complete' | 'partial' | 'none'

export const MATERIALS_MARK_AR: Record<MaterialsMark, string> = {
  complete: 'موادّ معتمدة',
  partial: 'موادّ ناقصة',
  none: 'بلا موادّ',
}

export function materialsMarkOf(raw: unknown): MaterialsMark {
  if (!raw) return 'none'
  const m = cleanCourseMaterials(raw)
  if (m.modules.length === 0 && !m.materialsUrl && !m.taskAr && !m.sourcesAr) return 'none'
  return materialsMissingAr(m).length === 0 ? 'complete' : 'partial'
}
