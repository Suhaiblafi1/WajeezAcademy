/* حزمةُ المدرّبين لكتابة اقتراحاتنا — ما كتبوه وسيرُهم وشهاداتُهم (٢٠ أكتوبر ٢٠٢٦).

   ═══ القرارُ الذي كُتبت له ═══

   قرارُ صاحب المنصّة: «اكتب للجميع وسأرسل لمن هم اكتف أو نشرت دوراتهم للموسم.. اجعلها
   جاهزةً للجميع». ثمّ اختار من خيارين: الحزمةُ **مع السير الذاتيّة والشهادات**، لا النصُّ وحدَه.
   فمسوّداتُ «لماذا نفتخر به» والنبذةِ (`trainer-suggestion-drafts.ts`) تُكتب من حقائقَ موثَّقة،
   وأكثرُ المدرّبين لا نبذةَ عامّةً لهم تُقرأ.

   ═══ ما فيها ═══

   كلُّ ملفِّ مدرّبٍ **لا مسوّدةَ له** ولم يُقترح عليه شيءٌ بعد — ومن له مسوّدةٌ كُتب له:
   · `المدربون.md` يُقرأ، و`trainers.json` بالحقول نفسِها لمن يكتب المسوّدات؛
   · حالُه، وهل له دورةٌ منشورةٌ هذا الفصلَ أو بعده (`liveTrainerWhere`) — فيُعرف لمن يُرسَل؛
   · عنوانُه ونبذتُه العامّان، وما كتبه في طلبه: النبذةُ والعملُ والخبرةُ والتخصّصاتُ والاعتمادُ
     والدوراتُ السابقة ومن درّب، وما يدرّسه من كتالوجنا وما اقترحه؛
   · ومجلّدُ كلٍّ بسيرته (`cv`) وشهاداته (`certificate`) كما رفعها.

   ═══ وما ليس فيها ═══

   لا بريدَ ولا هاتفَ ولا روابطَ حسابات، ولا تقييماتٍ ولا ملاحظاتٍ داخليّة: ما يُكتب في البطاقة
   خبرتُه لا وسيلةُ الوصول إليه. والسيرةُ نفسُها قد تحمل هاتفا — فالحزمةُ خلف صلاحيّةِ من يقرأ
   الطلباتِ وسيرَها في الشاشة (`trainer.applications.view`)، وكلُّ تنزيلٍ أثرٌ باسم من نزّلها. */

import JSZip from 'jszip'
import type { PrismaClient } from '@prisma/client'
import { readDocumentContent } from './storage.service'
import { recordAudit } from './audit'
import { liveTrainerWhere } from './trainer-visibility'
import { BIO_DRAFTS, PITCH_DRAFTS } from './trainer-suggestion-drafts'
import { safeName } from '../../src/application/trainer/plan-review-bundle'
import { proposalLine, readProposals } from '../../src/application/trainer/teachable-proposals'
import {
  APPLICANT_STATUS, DOMAIN_YEARS, EMPLOYMENT_STATUS, labelOf, TRAINING_YEARS,
} from '../../src/application/trainer/application-options'
import { zonedDay } from '../../src/application/trainer/cohort-period'

/** ما يدخل من وثائقه — السيرةُ والشهادات، كما اختار صاحبُ المنصّة */
export const DRAFTING_DOC_KINDS = ['cv', 'certificate'] as const
/** حدُّ الملفّ الواحد — ما فوقه ليس سيرةً تُقرأ */
export const DRAFTING_FILE_MAX_BYTES = 15 * 1024 * 1024
/** حدُّ الحزمة كلِّها — ذاكرةُ الحاوية، والملفّاتُ تُقرأ قبل الضغط */
export const DRAFTING_TOTAL_MAX_BYTES = 120 * 1024 * 1024

export interface DraftingTrainer {
  profileId: string
  name: string
  status: string
  statusAr: string
  /** له دورةٌ منشورةٌ هذا الفصلَ أو بعده */
  liveCourse: boolean
  headline: string | null
  bioPublic: string | null
  application: {
    bio: string | null
    jobTitle: string | null
    employment: string | null
    domainYears: string | null
    trainingYears: string | null
    specialties: string[]
    accreditation: string | null
    previousCourses: { title: string; org: string; year: string; learners: string }[]
    totalLearners: number | null
    previousOrgs: string | null
    evidenceNotes: string | null
    trainingLanguages: string[]
    targetAudiences: string[]
    teachesFromCatalog: string[]
    proposedCourses: string[]
  }
  /** ملفّاتُه في الحزمة — ومن تُرك منها وسببُه */
  files: { kind: string; path: string | null; originalName: string; skippedAr: string | null }[]
}

export interface DraftingBundle {
  fileName: string
  zip: Buffer
  trainers: DraftingTrainer[]
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const orNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)
const mb = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`

/** الدوراتُ السابقةُ كما كتبها — `Json?` يقبل أيَّ شكل، فيُقرأ بفحص */
function readPreviousCourses(raw: unknown): DraftingTrainer['application']['previousCourses'] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map((c) => ({ title: str(c.title), org: str(c.org), year: str(c.year), learners: str(c.learnersCount) }))
    .filter((c) => c.title)
}

export class TrainerDraftingBundleService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  async build(actorId: string, now = new Date()): Promise<DraftingBundle> {
    const drafted = new Set([...Object.keys(PITCH_DRAFTS), ...Object.keys(BIO_DRAFTS)])
    const profiles = await this.prisma.trainerProfile.findMany({
      where: { id: { notIn: [...drafted] }, textSuggestions: { none: { status: { not: 'withdrawn' } } } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, headline: true, bioPublic: true,
        application: {
          select: {
            fullName: true, status: true, bio: true, jobTitle: true, employmentStatus: true,
            domainYears: true, trainingYears: true, hasAccreditation: true, accreditationDetails: true,
            previousCourses: true, totalLearners: true, previousOrgs: true, evidenceNotes: true,
            trainingLanguages: true, targetAudiences: true, teachableCourseIds: true, teachableProposals: true,
            specialties: { select: { specialty: true } },
            documents: {
              where: { kind: { in: [...DRAFTING_DOC_KINDS] } }, orderBy: { uploadedAt: 'asc' },
              select: { kind: true, storageKey: true, originalName: true, sizeBytes: true },
            },
          },
        },
      },
    })
    const live = new Set((await this.prisma.trainerProfile.findMany({
      where: { id: { in: profiles.map((p) => p.id) }, AND: [liveTrainerWhere(now)] }, select: { id: true },
    })).map((r) => r.id))
    const courseIds = [...new Set(profiles.flatMap((p) => p.application.teachableCourseIds))]
    const titleOf = new Map((await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { titleAr: true } } },
    })).map((c) => [c.id, c.versions[0]?.titleAr || c.id]))

    const zip = new JSZip()
    let used = 0
    const trainers: DraftingTrainer[] = []
    let n = 0
    for (const p of profiles) {
      n += 1
      const a = p.application
      const folder = `${String(n).padStart(2, '0')}. ${safeName(a.fullName, 60)}`
      const files: DraftingTrainer['files'] = []
      const perKind = new Map<string, number>()
      for (const d of a.documents) {
        const k = (perKind.get(d.kind) ?? 0) + 1
        perKind.set(d.kind, k)
        const path = `${folder}/${d.kind}-${k} — ${safeName(d.originalName, 70)}`
        let skippedAr: string | null = null
        if (d.sizeBytes > DRAFTING_FILE_MAX_BYTES) skippedAr = `حجمه ${mb(d.sizeBytes)} — أكبر من ${mb(DRAFTING_FILE_MAX_BYTES)}`
        else {
          const body = await readDocumentContent(this.prisma, d.storageKey).catch(() => null)
          if (!body) skippedAr = 'غير موجود في المخزن'
          else if (body.length > DRAFTING_FILE_MAX_BYTES) skippedAr = `حجمه ${mb(body.length)} — أكبر من ${mb(DRAFTING_FILE_MAX_BYTES)}`
          else if (used + body.length > DRAFTING_TOTAL_MAX_BYTES) skippedAr = `امتلأت الحزمة (${mb(DRAFTING_TOTAL_MAX_BYTES)})`
          else {
            used += body.length
            zip.file(path, body)
          }
        }
        files.push({ kind: d.kind, path: skippedAr ? null : path, originalName: d.originalName, skippedAr })
      }
      trainers.push({
        profileId: p.id,
        name: a.fullName,
        status: a.status,
        statusAr: APPLICANT_STATUS[a.status]?.label ?? a.status,
        liveCourse: live.has(p.id),
        headline: orNull(p.headline),
        bioPublic: orNull(p.bioPublic),
        application: {
          bio: orNull(a.bio),
          jobTitle: orNull(a.jobTitle),
          employment: a.employmentStatus ? labelOf(EMPLOYMENT_STATUS, a.employmentStatus) : null,
          domainYears: a.domainYears ? labelOf(DOMAIN_YEARS, a.domainYears) : null,
          trainingYears: a.trainingYears ? labelOf(TRAINING_YEARS, a.trainingYears) : null,
          specialties: a.specialties.map((s) => s.specialty),
          accreditation: a.hasAccreditation ? orNull(a.accreditationDetails) ?? 'أشار إلى اعتماد بلا تفصيل' : null,
          previousCourses: readPreviousCourses(a.previousCourses),
          totalLearners: a.totalLearners,
          previousOrgs: orNull(a.previousOrgs),
          evidenceNotes: orNull(a.evidenceNotes),
          trainingLanguages: a.trainingLanguages,
          targetAudiences: a.targetAudiences,
          teachesFromCatalog: a.teachableCourseIds.map((id) => titleOf.get(id) ?? id),
          proposedCourses: readProposals(a.teachableProposals).map(proposalLine),
        },
        files,
      })
    }

    zip.file('المدربون.md', draftingMarkdown(trainers, now))
    zip.file('trainers.json', JSON.stringify(trainers, null, 2))
    for (const t of trainers) {
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.drafting_bundle.download', entityType: 'trainer_profile', entityId: t.profileId,
        meta: { files: t.files.filter((f) => f.path).length },
      })
    }
    return {
      fileName: `ملفات-المدربين-للاقتراحات-${zonedDay(now)}.zip`,
      zip: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'UNIX' }),
      trainers,
    }
  }
}

/** الملفُّ المقروء — كلُّ مدرّبٍ بحاله وما كتبه، وملفّاتُه وما تُرك منها */
export function draftingMarkdown(trainers: readonly DraftingTrainer[], now: Date): string {
  const out: string[] = [`# ملفات المدربين لكتابة الاقتراحات — ${zonedDay(now)}`, '']
  if (trainers.length === 0) out.push('لكل مدرب مسودة أو اقتراح أرسل له. لا أحد ينتظر.')
  else out.push(`${trainers.length} مدربا بلا مسودة ولا اقتراح. ومن له دورة منشورة هذا الفصل أو بعده موسوم بـ«منشورة».`, '')
  const line = (k: string, v: string | null | undefined) => { if (v && v.trim()) out.push(`- **${k}:** ${v.trim()}`) }
  trainers.forEach((t, i) => {
    out.push(`## ${i + 1}. ${t.name}`, '')
    line('الحالة', `${t.statusAr}${t.liveCourse ? ' · منشورة' : ''}`)
    line('العنوان العام', t.headline)
    line('النبذة العامة', t.bioPublic)
    const a = t.application
    line('نبذته في الطلب', a.bio)
    line('عمله', [a.jobTitle, a.employment].filter(Boolean).join(' · '))
    line('خبرته', [a.domainYears && `${a.domainYears} في المجال`, a.trainingYears].filter(Boolean).join(' · '))
    line('تخصصاته', a.specialties.join(' · '))
    line('اعتماده', a.accreditation)
    if (a.previousCourses.length) {
      out.push('- **دورات سابقة:**')
      for (const c of a.previousCourses) {
        out.push(`  - ${[c.title, c.org, c.year, c.learners && `${c.learners} متدربا`].filter(Boolean).join(' · ')}`)
      }
    }
    line('عدد من درّبهم', a.totalLearners != null ? String(a.totalLearners) : null)
    line('جهات عمل معها', a.previousOrgs)
    line('ما يثبت خبرته', a.evidenceNotes)
    line('لغات التدريب', a.trainingLanguages.join(' · '))
    line('يدرّس من كتالوجنا', a.teachesFromCatalog.join(' · '))
    line('دورات اقترحها', a.proposedCourses.join(' · '))
    for (const f of t.files) {
      out.push(f.path ? `- 📎 \`${f.path}\`` : `- ⚠️ ${f.kind} «${f.originalName}» لم يدخل: ${f.skippedAr}`)
    }
    if (t.files.length === 0) out.push('- لا سيرة ولا شهادة مرفوعة')
    out.push('')
  })
  return `${out.join('\n')}\n`
}
