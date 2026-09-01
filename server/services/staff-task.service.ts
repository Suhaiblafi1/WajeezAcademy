/* المهامّ والإشعارات — تكليفٌ يعلم به صاحبُه.

   قرارُ صاحب المنصّة: «يحقّ للسوبر إعطاء مهام للمستخدمين وإرسال إشعارات
   لهم». ولم يكن في القاعدة نموذجُ «مهمّة» إطلاقا — إلّا `AdvisorTask`، وهي
   مربوطةٌ بحالة عميلٍ بعينها فلا تصلح لتكليفٍ عامّ.

   وثلاثةُ قراراتٍ في هذه الخدمة:

   ١) **التكليفُ يُشعِر دائما.** تكليفٌ لا يعلم به صاحبُه ليس تكليفا — يبقى
      صفّا في جدولٍ ويُحاسَب عليه من لم يره. فالإشعارُ جزءٌ من الفعل لا
      خطوةٌ تُنسى بعده.

   ٢) **ولا يُكلَّف من هو أعلى رتبة.** «مهمّة» من أدنى إلى أعلى إمّا أن تكون
      بلا معنى وإمّا أن تكون أداةَ إزعاج. والقيدُ نفسُه الذي يحكم تعيينَ
      الأدوار (`refuseRoleAssignment`) يحكم هنا.

   ٣) **ويُغلقها مكلَّفُها أو مكلِّفُها لا غيرُهما.** ومن أغلقها يُسجَّل: من
      يقرأ «أُنجزت» يستحقّ أن يعرف من قال ذلك.

   الحارس: server/tests/rbac/staff-tasks.test.ts */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { safeNotify } from './notification.service'
import { rankOf } from '../auth/permissions'

export interface Assigner {
  userId: string
  roles: string[]
}

export class StaffTaskService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** رتبةُ المستهدَف — ولا يُكلَّف ولا يُنبَّه من هو أعلى */
  private async assertNotAbove(actor: Assigner, targetId: string, verbAr: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId }, include: { roles: true },
    })
    if (!target) throw new AuthError('not_found', 'الحساب غير موجود', 404)
    if (target.status !== 'active') throw new AuthError('inactive', 'هذا الحساب موقوف', 409)
    if (rankOf(target.roles.map((r) => r.roleId)) > rankOf(actor.roles)) {
      throw new AuthError('rank_exceeded', `لا ${verbAr} من هو أعلى رتبةً منك`, 403)
    }
    return target
  }

  async assign(actor: Assigner, input: {
    assigneeId: string; title: string; bodyAr?: string; dueAt?: Date; priority?: 'normal' | 'high'
  }) {
    const assignee = await this.assertNotAbove(actor, input.assigneeId, 'تكلّف')
    const task = await this.prisma.staffTask.create({
      data: {
        assigneeId: input.assigneeId, assignedBy: actor.userId,
        title: input.title, bodyAr: input.bodyAr ?? null,
        dueAt: input.dueAt ?? null, priority: input.priority ?? 'normal',
      },
    })
    /* الإشعارُ جزءٌ من التكليف لا خطوةٌ بعده */
    await safeNotify(this.prisma, {
      userId: assignee.id, audience: 'staff', channel: 'in_app',
      title: input.priority === 'high' ? `مهمّة عاجلة: ${input.title}` : `مهمّة جديدة: ${input.title}`,
      body: [
        input.bodyAr?.trim(),
        input.dueAt ? `الموعد: ${input.dueAt.toISOString().slice(0, 10)}` : null,
      ].filter(Boolean).join('\n') || 'افتح «مهامّي» لتفاصيلها.',
      templateKey: 'staff.task.assigned',
      data: { taskId: task.id },
    })
    await recordAudit(this.prisma, {
      actorId: actor.userId, action: 'staff.task.assign', entityType: 'staff_task', entityId: task.id,
      meta: { assigneeId: input.assigneeId, title: input.title, priority: task.priority },
    })
    return task
  }

  /** مهامّي — ما كُلّفت به */
  async mine(userId: string, status?: 'open' | 'done') {
    return this.prisma.staffTask.findMany({
      where: { assigneeId: userId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })
  }

  /** ما كلّفتُ به غيري — للمتابعة */
  async assignedByMe(userId: string) {
    return this.prisma.staffTask.findMany({
      where: { assignedBy: userId },
      include: { assignee: { select: { id: true, displayName: true, email: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })
  }

  /* الإغلاقُ لمكلَّفها أو مكلِّفها — ولا ثالثَ لهما.

     ولا يكفي `staff.task.assign`: من يملك التكليفَ لا يملك أن يُغلق مهمّةَ
     غيره فيمحو أثرَ تقصيرٍ أو يُنهي عملا لم يُنجَز. */
  async complete(userId: string, taskId: string, noteAr?: string) {
    const task = await this.prisma.staffTask.findUnique({ where: { id: taskId } })
    if (!task) throw new AuthError('not_found', 'المهمّة غير موجودة', 404)
    if (task.assigneeId !== userId && task.assignedBy !== userId) {
      throw new AuthError('not_yours', 'هذه المهمّة ليست لك ولم تكلّف بها', 403)
    }
    if (task.status !== 'open') throw new AuthError('bad_state', 'أُغلقت هذه المهمّة من قبل', 409)

    const done = await this.prisma.staffTask.update({
      where: { id: taskId },
      data: { status: 'done', doneAt: new Date(), doneNoteAr: noteAr?.trim() || null },
    })
    /* من كلّف يُعلَم بالإنجاز — إلّا أن يكون هو من أغلقها */
    if (task.assignedBy !== userId) {
      await safeNotify(this.prisma, {
        userId: task.assignedBy, audience: 'staff', channel: 'in_app',
        title: `أُنجزت مهمّة: ${task.title}`,
        body: noteAr?.trim() || 'بلا ملاحظة.',
        templateKey: 'staff.task.done',
        data: { taskId },
      })
    }
    await recordAudit(this.prisma, {
      actorId: userId, action: 'staff.task.complete', entityType: 'staff_task', entityId: taskId,
      meta: { byAssignee: task.assigneeId === userId },
    })
    return done
  }

  /* إشعارٌ بلا مهمّة — إعلانٌ يصل ولا يُتابَع ولا يُغلَق.

     وحبّتُه منفصلة عن التكليف: من يبثّ الإعلانات ليس بالضرورة من يوزّع
     المهامّ، وجمعُهما يجعل منحَ إحداهما منحا للأخرى. */
  async notify(actor: Assigner, input: { userIds: string[]; title: string; bodyAr: string }) {
    const unique = [...new Set(input.userIds)]
    if (unique.length === 0) throw new AuthError('no_recipients', 'لا مستقبِل للإشعار', 400)
    for (const id of unique) await this.assertNotAbove(actor, id, 'تُشعر')

    for (const userId of unique) {
      await safeNotify(this.prisma, {
        userId, audience: 'staff', channel: 'in_app',
        title: input.title, body: input.bodyAr,
        templateKey: 'staff.announce',
        data: { from: actor.userId },
      })
    }
    await recordAudit(this.prisma, {
      actorId: actor.userId, action: 'staff.notify', entityType: 'user', entityId: unique[0],
      meta: { recipients: unique.length, title: input.title },
    })
    return { sent: unique.length }
  }
}
