/* محمّل طبقات بيانات V2 — يقرأ الملفات المولدة والمحررة يدويًا.
   كل شيء حتمي: نفس البيانات → نفس السلوك. */

import questionMetaJson from '../../../data/catalog/v2/question-meta.v2.json'
import skillLayersJson from '../../../data/catalog/v2/skill-layers.v2.json'
import pathwayDomainsJson from '../../../data/catalog/v2/pathway-domains.v2.json'
import type { DomainId, PersonaKey, QuestionMetaV2, SkillLayer } from './types'

interface QuestionMetaFile {
  version: string
  questions: Record<string, QuestionMetaV2 & { allowed_personas: PersonaKey[] | 'all' }>
}
interface SkillLayersFile {
  version: string
  skills: Record<
    string,
    {
      layers: SkillLayer[]
      /* active = مشاركة في منطق التشخيص فقط (لا الوجود التصنيفي — ذاك في القاموس الأم) */
      active: boolean
      diagnostic_active?: boolean
      academic_status?: 'approved_active' | 'future_catalog_skill' | 'future_personalization_signal' | 'merged' | 'pending_review'
      merged_into?: string
      decision_role_ar: string
      pathway_ids?: string[]
      measured_by?: string
    }
  >
}
interface PathwayDomainsFile {
  version: string
  domains: { id: DomainId; name_ar: string; desc_ar: string }[]
  pathway_domains: Record<string, DomainId[]>
  goal_domains: Record<string, DomainId[]>
  function_domains: Record<string, DomainId[]>
}

const qm = questionMetaJson as unknown as QuestionMetaFile
const sl = skillLayersJson as unknown as SkillLayersFile
const pd = pathwayDomainsJson as unknown as PathwayDomainsFile

/* التراكبات المولّدة (ج-٢) — الملف المضمن افتراضٌ، واللقطة المنشورة تتقدم عليه.
   `let` مقصودة كما في ج-١: روابط ES الحية تُري كل مستورد التراكب المثبَّت بلا
   إعادة بناء. وهذا ما يجعل سؤالا يُضاف بعد النشر مرئيا للمحرك. */
export let questionMetaV2: Record<string, QuestionMetaV2> = qm.questions
export let skillLayersV2: SkillLayersFile['skills'] = sl.skills

/** تثبيت ميتا الأسئلة من لقطة منشورة؛ null يرجّع الملف المضمن */
export function installQuestionMeta(map: Record<string, unknown> | null): void {
  questionMetaV2 = (map as Record<string, QuestionMetaV2> | null) ?? qm.questions
}

/** تثبيت طبقات المهارات من لقطة منشورة؛ null يرجّع الملف المضمن.
    ⚠ لا تُسقَط مهارة من هذه الخريطة: isDiagnosticSkillActive تعتبر «غير الموثقة
    نشطة»، فمهارةٌ مدموجة أو محكومة تغيب عن الخريطة تصبح نشطة تشخيصيا —
    انحدارٌ صامت. لذلك يولّدها باني اللقطة من كل صفوف المهارات لا المنشورة وحدها. */
export function installSkillLayers(map: Record<string, unknown> | null): void {
  skillLayersV2 = (map as SkillLayersFile['skills'] | null) ?? sl.skills
}
export const domainsV2 = pd.domains
/* وخريطةُ مجالات المسارات في ملفٍّ خفيفٍ وحدَها (٨ نوفمبر ٢٠٢٦، `pathway-domains.ts`) — تُعاد هنا كما هي، روابطَ حيّة */
export { pathwayDomainsV2, installPathwayDomains, domainsOfPathway } from './pathway-domains'
export const goalDomainsV2: Record<string, DomainId[]> = pd.goal_domains
export const functionDomainsV2: Record<string, DomainId[]> = pd.function_domains

export function domainLabelAr(id: DomainId): string {
  return domainsV2.find((d) => d.id === id)?.name_ar ?? id
}


/** طبقات مهارة — undefined إن لم تُوثق (يُسجل في التدقيق) */
export function layersOfSkill(slug: string) {
  return skillLayersV2[slug]
}

/** هل تشارك المهارة في منطق التشخيص؟ — القاعدة الوحيدة المسموح بها في كل المجال.
   غير موثقة = نشطة (سلوك قديم محفوظ)؛ academic_status محكومة = غير نشطة مهما كان الربط. */
export function isDiagnosticSkillActive(meta: ReturnType<typeof layersOfSkill>): boolean {
  if (meta === undefined) return true
  return meta.active && meta.diagnostic_active !== false
}
