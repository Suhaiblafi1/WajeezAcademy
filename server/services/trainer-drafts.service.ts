/* ═══ مسوّداتُ ما نقترحه على بطاقة المدرّب — تُرفع من الشاشة (٢٦ أكتوبر ٢٠٢٦) ═══

   كانت مسوّداتُ «لماذا نفتخر به» والنبذةِ ثابتةً في `trainer-suggestion-drafts.ts`: يُنزَّل ملفُّ المدرّبين من
   «المدربون» (`trainer-drafting-bundle.service.ts`)، ويكتب Claude المسوّدات، ثمّ تُكتب في الشيفرة وتُنشر — فكلُّ
   جولةٍ نشرُ شيفرة. وقرارُ صاحب المنصّة في المرحلة الخامسة: «تُرفع من الشاشة بلا نشر». فالجولةُ تنزيلٌ ورفعٌ كمراجعة
   الخطط: ملفٌّ واحد (`DRAFTS_FORMAT`) يُرفع من «ارفع المسوّدات» بجانب «نزّل ملفات المدربين للاقتراحات».

   ── ما يُرفع ──

   ① **الملفُّ كلُّه أو لا شيء** — كملفّ التعديلات: يُفحص كلُّ مدرّبٍ فيه بقواعد البطاقة نفسِها (`pitch.ts`)،
      فإن سقط واحدٌ رُدّ الملفُّ بأسمائه وأسبابها ولم يُحفظ شيء. فلا تصل الشاشةَ مسوّدةٌ لا تُرسَل.
   ② **ونصُّه بلا تشكيلٍ إعرابيّ** (`plainAr`) — نصٌّ يُعرض للناس بقرار «اللغة البيضاء» (١١ أكتوبر ٢٠٢٦).
   ③ **والأحدثُ لكلّ مدرّبٍ ونوعٍ مكانَ ما قبله** — وما كان هو نفسَه يُعدّ ولا يُكتب، فالملفُّ نفسُه يُرفع مرّتين بلا أثر.

   ── ومن أين تُقرأ ──

   `drafts()` ما في الشيفرة وفوقه ما رُفع: المرفوعُ أحدثُ فهو الغالب. ومنها يقرأ الثلاثة: الإرسالُ (`sendAllDrafts`)،
   وبطاقةُ المدرّب في «المدربون» (`pitchDraft` و`bioDraft`)، وملفُّ المدرّبين الذي لا يُدخل من له مسوّدة. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { bioSuggestionProblemAr, cleanPitchLines, pitchProblemAr } from '../../src/application/trainer/pitch'
import { plainAr } from '../../src/application/text/plain-ar'
import { DRAFTS_FORMAT, type DraftsUploaded } from '../../src/application/trainer/text-drafts'
import { BIO_DRAFTS, PITCH_DRAFTS } from './trainer-suggestion-drafts'

export { DRAFTS_FORMAT }

export type Drafts = { pitch: Record<string, readonly string[]>; bio: Record<string, string> }

/** الملفُّ كما يُرفع: لكلّ معرّفِ ملفِّ مدرّبٍ سطورُ «لماذا نفتخر به»، أو نبذتُه نصّا واحدا */
export interface DraftsFile { format?: string; pitch?: Record<string, readonly string[]>; bio?: Record<string, string> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class TrainerDraftsService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) { this.prisma = prisma }

  /** ما في الشيفرة وفوقه ما رُفع — المرفوعُ أحدث */
  async drafts(): Promise<Drafts> {
    const rows = await this.prisma.trainerTextDraft.findMany({ select: { profileId: true, kind: true, lines: true } })
    const pitch: Record<string, readonly string[]> = { ...PITCH_DRAFTS }
    const bio: Record<string, string> = { ...BIO_DRAFTS }
    for (const r of rows) {
      if (r.kind === 'pitch') pitch[r.profileId] = r.lines
      else if (r.kind === 'bio' && r.lines[0]) bio[r.profileId] = r.lines[0]
    }
    return { pitch, bio }
  }

  async upload(actorId: string, file: DraftsFile): Promise<DraftsUploaded> {
    /* وملفٌّ بصيغةٍ أخرى — ملفُّ تعديلات خطّةٍ رُفع هنا خطأً — يُقال باسمه لا بخطأ حقل */
    if (file.format !== undefined && file.format !== DRAFTS_FORMAT) {
      throw new AuthError('wrong_format', `هذا ليس ملف مسوّدات (صيغته ${file.format}) — ارفعه من موضعه`, 422)
    }
    const entries = [
      ...Object.entries(file.pitch ?? {}).map(([profileId, raw]) => ({ profileId, kind: 'pitch' as const, raw: [...raw] })),
      ...Object.entries(file.bio ?? {}).map(([profileId, raw]) => ({ profileId, kind: 'bio' as const, raw: [raw] })),
    ]
    if (entries.length === 0) throw new AuthError('bad_drafts', 'الملف بلا مسوّدات', 422)
    const ids = [...new Set(entries.map((e) => e.profileId))].filter((id) => UUID.test(id))
    const profiles = new Map((await this.prisma.trainerProfile.findMany({
      where: { id: { in: ids } }, select: { id: true, application: { select: { fullName: true } } },
    })).map((p) => [p.id, p.application.fullName]))

    /* ① يُفحص كلُّه قبل أن يُحفظ شيء — بقواعد البطاقة نفسِها، بعد أن يُردّ نصُّه بلا تشكيل (②) */
    const problems: string[] = []
    const clean = entries.map((e) => {
      const name = profiles.get(e.profileId)
      if (!name) { problems.push(`${e.profileId}: لا مدرب بهذا المعرّف`); return null }
      const kindAr = e.kind === 'pitch' ? '«لماذا نفتخر به»' : 'النبذة'
      if (e.kind === 'bio') {
        const text = plainAr(e.raw[0] ?? '').trim().replace(/[ \t]+/g, ' ')
        const problem = bioSuggestionProblemAr(text)
        if (problem) { problems.push(`${name} — ${kindAr}: ${problem}`); return null }
        return { ...e, lines: [text] }
      }
      const lines = cleanPitchLines(e.raw.map(plainAr))
      const problem = pitchProblemAr(lines)
      if (problem) { problems.push(`${name} — ${kindAr}: ${problem}`); return null }
      return { ...e, lines }
    })
    if (problems.length) throw new AuthError('bad_drafts', `لم يرفع شيء — في الملف ما لا يصلح:\n${problems.join('\n')}`, 422)

    /* ③ وما كان هو نفسَه لا يُكتب — المقابلةُ بما يُقرأ الآن: المرفوعُ قبلُ أو ما في الشيفرة */
    const now = await this.drafts()
    const fresh = clean.filter((e): e is NonNullable<typeof e> => {
      if (!e) return false
      const before = e.kind === 'pitch' ? now.pitch[e.profileId] : now.bio[e.profileId] !== undefined ? [now.bio[e.profileId]!] : undefined
      return !before || before.join('\n') !== e.lines.join('\n')
    })
    if (fresh.length > 0) {
      await this.prisma.$transaction(fresh.map((e) => this.prisma.trainerTextDraft.upsert({
        where: { profileId_kind: { profileId: e.profileId, kind: e.kind } },
        create: { profileId: e.profileId, kind: e.kind, lines: e.lines, uploadedBy: actorId },
        update: { lines: e.lines, uploadedBy: actorId, uploadedAt: new Date() },
      })))
    }
    const counts = {
      pitch: fresh.filter((e) => e.kind === 'pitch').length,
      bio: fresh.filter((e) => e.kind === 'bio').length,
      repeated: entries.length - fresh.length,
    }
    /* ويُكتب في أثر كلِّ مدرّبٍ ما رُفع له — كما يُكتب تنزيلُ ملفّه (`trainer.drafting_bundle.download`) */
    for (const profileId of new Set(fresh.map((e) => e.profileId))) {
      await recordAudit(this.prisma, {
        actorId, action: 'trainer.drafts.upload', entityType: 'trainer_profile', entityId: profileId,
        meta: { kinds: fresh.filter((e) => e.profileId === profileId).map((e) => e.kind) },
      })
    }
    return counts
  }
}
