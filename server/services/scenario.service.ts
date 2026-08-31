/* خدمة سيناريو القرار المتفرّع (البند ح-٥) — تسجيل مسار قرارات المتعلم وتأمله.

   ⚠ ليست تقييما ولا تدخل في قياس. لا درجة، ولا وزن في الترشيح، ولا كتابة في
   متجه المهارات. القيمة في أن المتعلم يتخذ القرار ويرى أثره ثم يكتب تأمله —
   والسجل ليعود إليه بعد حين ويجرّب قرارا آخر. ولذلك تُسمح جولات متعددة:
   إعادة القرار هي الفائدة عينها لا تحايلا يُمنع.

   والمسار يُتحقَّق قبل الحفظ على السيناريو المنشور نفسه: خطوة إلى عقدة غير
   موجودة أو خيار خارج الحدود تُرفض، فلا يُخزَّن مسار لا يمكن إعادة عرضه. */

import { readableVersionOf } from '../catalog/module-version-visibility'
import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { parseScenario, replayPath, type ScenarioStep } from '../../src/application/content/scenario'

const MAX_STEPS = 24

export class ScenarioService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private async myCourseIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId, status: { notIn: ['dropped'] } },
      select: { cohort: { select: { courseId: true } } },
    })
    return new Set(rows.map((r) => r.cohort.courseId))
  }

  /** سيناريو الوحدة من أحدث إصدارٍ **منشور** — المصدر نفسه الذي يراه المتعلم، لا المسوّدة */
  private async scenarioOf(moduleId: string) {
    const mod = await this.prisma.courseModule.findUnique({ where: { id: moduleId } })
    if (!mod) throw new AuthError('not_found', 'الوحدة غير موجودة', 404)
    const version = await this.prisma.courseModuleVersion.findFirst(readableVersionOf(moduleId))
    const parsed = parseScenario(version?.scenarioAr)
    return { courseId: mod.courseId, scenario: parsed.scenario, errorsAr: parsed.errorsAr }
  }

  /** جولاتي في وحدة — الأحدث أولا، فيقرأ المتعلم قراره القديم ويقارن */
  async myRuns(userId: string, moduleId: string) {
    const rows = await this.prisma.scenarioRun.findMany({
      where: { userId, moduleId }, orderBy: { startedAt: 'desc' }, take: 20,
    })
    return rows.map((r) => ({
      id: r.id,
      moduleId: r.moduleId,
      path: r.path as unknown as ScenarioStep[],
      reflectionAr: r.reflectionAr,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt?.toISOString() ?? null,
    }))
  }

  /**
   * يحفظ جولة مكتملة: المسار والتأمل. الحفظ عند النهاية لا عند كل خيار —
   * القرار في الشاشة سريع، ولا نُثقل كل نقرة بنداء شبكة.
   */
  async saveRun(userId: string, moduleId: string, path: ScenarioStep[], reflectionAr: string | null) {
    if (path.length > MAX_STEPS) throw new AuthError('bad_path', 'مسار أطول من المعقول', 400)
    const { courseId, scenario } = await this.scenarioOf(moduleId)
    const mine = await this.myCourseIds(userId)
    if (!mine.has(courseId)) throw new AuthError('forbidden', 'هذه الوحدة ليست في دورة مسجَّل فيها', 403)
    if (!scenario) throw new AuthError('no_scenario', 'لا سيناريو في هذه الوحدة', 400)

    const replay = replayPath(scenario, path)
    if (!replay.valid) throw new AuthError('bad_path', 'مسار لا يطابق السيناريو المنشور', 400)
    const last = replay.nodes.at(-1)
    if (!last || last.options.length > 0) {
      throw new AuthError('not_ended', 'الجولة لم تبلغ نهاية — تُحفَظ عند النهاية', 400)
    }

    const now = new Date()
    const row = await this.prisma.scenarioRun.create({
      data: {
        userId, moduleId,
        path: path as unknown as object,
        reflectionAr: reflectionAr?.trim() ? reflectionAr.trim() : null,
        endedAt: now,
      },
    })
    return {
      id: row.id,
      moduleId,
      endNode: last.titleAr,
      steps: path.length,
      savedReflection: row.reflectionAr !== null,
    }
  }

  /** يكتب التأمل على جولة محفوظة — لمن أنهى ثم أراد أن يكتب بعد تفكير */
  async setReflection(userId: string, runId: string, reflectionAr: string) {
    const row = await this.prisma.scenarioRun.findUnique({ where: { id: runId } })
    if (!row) throw new AuthError('not_found', 'الجولة غير موجودة', 404)
    if (row.userId !== userId) throw new AuthError('forbidden', 'هذه الجولة ليست لك', 403)
    const updated = await this.prisma.scenarioRun.update({
      where: { id: runId },
      data: { reflectionAr: reflectionAr.trim() ? reflectionAr.trim() : null },
    })
    return { id: updated.id, savedReflection: updated.reflectionAr !== null }
  }
}
