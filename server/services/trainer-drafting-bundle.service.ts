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
   الطلباتِ وسيرَها في الشاشة (`trainer.applications.view`)، وكلُّ تنزيلٍ أثرٌ باسم من نزّلها.

   ═══ ولمن له دورةٌ معتمدةٌ وحدَه، وأجزاءً تُرفع (٢٠ أكتوبر ٢٠٢٦) ═══

   نزّلها صاحبُ المنصّة فلم تُرفع إلى المحادثة: «الملفُّ كبيرٌ جدّا.. أهو بسبب السير؟» — وهو كذلك، فالنصُّ
   كيلوبايتات والسيرُ والشهاداتُ هي الحجم. ثمّ: «فعّل الخاصّيّة تلقائيّا: يُعتمَد دورةٌ واحدةٌ على الأقلّ لكلّ
   مدرّب». فصارت:
   · **لمن له دورةٌ معتمدةٌ واحدةٌ على الأقلّ** (`TrainerCourseQualification.status = 'qualified'`) — وهو
     شرطُ التفعيل نفسُه (`activateIfQualified`)، فلا يُكتب لمن لن يُرسَل إليه؛
   · **وأجزاءً** لا يجاوز الجزءُ ٢٠MB — يُقسَم المدرّبون بترتيبهم على حجم ملفّاتهم المسجَّل، فلا يُفرَّق
     مدرّبٌ بين جزأين، وكلُّ جزءٍ ZIP مستقلٌّ بفهرسه. وما جاوز الجزءَ وحدَه يُقال ولا يُسكت عنه. */

import JSZip from 'jszip'
import type { PrismaClient } from '@prisma/client'
import { readDocumentContent } from './storage.service'
import { recordAudit } from './audit'
import { AuthError } from './auth.service'
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
/** حدُّ الجزء — ما يُرفع إلى المحادثة ملفّا واحدا */
export const DRAFTING_PART_MAX_BYTES = 20 * 1024 * 1024

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
  part: number
  parts: number
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

  /** من يدخلها، وأجزاؤها — بحجم ملفّاتهم المسجَّل، بلا قراءتها */
  private async plan(partMaxBytes: number) {
    const drafted = new Set([...Object.keys(PITCH_DRAFTS), ...Object.keys(BIO_DRAFTS)])
    const profiles = await this.prisma.trainerProfile.findMany({
      where: {
        id: { notIn: [...drafted] },
        textSuggestions: { none: { status: { not: 'withdrawn' } } },
        qualifications: { some: { status: 'qualified' } },
      },
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
    const sizeOf = (p: (typeof profiles)[number]) => p.application.documents
      .filter((d) => d.sizeBytes <= DRAFTING_FILE_MAX_BYTES).reduce((n, d) => n + d.sizeBytes, 0)
    const parts: (typeof profiles)[] = []
    let used = 0
    for (const p of profiles) {
      const size = sizeOf(p)
      if (parts.length === 0 || (used + size > partMaxBytes && parts[parts.length - 1]!.length > 0)) {
        parts.push([])
        used = 0
      }
      parts[parts.length - 1]!.push(p)
      used += size
    }
    return { profiles, parts }
  }

  /** من ينتظر أن نكتب له — لـ«ما ينتظرك» (`staff-inbox.service.ts`) */
  async waitingNames(): Promise<string[]> {
    const { profiles } = await this.plan(DRAFTING_PART_MAX_BYTES)
    return profiles.map((p) => p.application.fullName)
  }

  /** كم جزءا، ولكم مدرّبا — لأزرار الشاشة */
  async parts(partMaxBytes = DRAFTING_PART_MAX_BYTES): Promise<{ parts: number; trainers: number }> {
    const { profiles, parts } = await this.plan(partMaxBytes)
    return { parts: Math.max(parts.length, 1), trainers: profiles.length }
  }

  async build(actorId: string, part = 1, now = new Date(), partMaxBytes = DRAFTING_PART_MAX_BYTES): Promise<DraftingBundle> {
    const plan = await this.plan(partMaxBytes)
    const total = Math.max(plan.parts.length, 1)
    if (!Number.isInteger(part) || part < 1 || part > total) {
      throw new AuthError('bad_part', `لا جزء ${part} — الأجزاء ${total}`, 400)
    }
    const profiles = plan.parts[part - 1] ?? []
    const offset = plan.parts.slice(0, part - 1).reduce((n, x) => n + x.length, 0)
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
    let n = offset
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
          else if (used + body.length > partMaxBytes) skippedAr = `امتلأ الجزء (${mb(partMaxBytes)})`
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

    zip.file('المدربون.md', draftingMarkdown(trainers, now, { part, parts: total }))
    zip.file('trainers.json', JSON.stringify(trainers, null, 2))
    for (const t of trainers) {
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.drafting_bundle.download', entityType: 'trainer_profile', entityId: t.profileId,
        meta: { files: t.files.filter((f) => f.path).length },
      })
    }
    return {
      fileName: total > 1
        ? `ملفات-المدربين-للاقتراحات-${zonedDay(now)}-الجزء-${part}-من-${total}.zip`
        : `ملفات-المدربين-للاقتراحات-${zonedDay(now)}.zip`,
      zip: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'UNIX' }),
      trainers,
      part,
      parts: total,
    }
  }
}

/** الملفُّ المقروء — كلُّ مدرّبٍ بحاله وما كتبه، وملفّاتُه وما تُرك منها */
export function draftingMarkdown(
  trainers: readonly DraftingTrainer[], now: Date, at: { part: number; parts: number } = { part: 1, parts: 1 },
): string {
  const partAr = at.parts > 1 ? ` — الجزء ${at.part} من ${at.parts}` : ''
  const out: string[] = [`# ملفات المدربين لكتابة الاقتراحات — ${zonedDay(now)}${partAr}`, '']
  if (trainers.length === 0) out.push('لكل مدرب له دورة معتمدة مسودة أو اقتراح أرسل له. لا أحد ينتظر.')
  else out.push(`${trainers.length} مدربا لهم دورة معتمدة، بلا مسودة ولا اقتراح. ومن له دورة منشورة هذا الفصل أو بعده موسوم بـ«منشورة».`, '')
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
