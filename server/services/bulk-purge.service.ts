/* حذفُ الحسابات جملةً — معاينةٌ ثمّ تنفيذ (القسم ل).

   ═══ بابان لا واحد ═══

   وهو نمطُ «إعادة ضبط الحسابات» نفسُه في هذه المنصّة: معاينةٌ تُقرأ، ثمّ
   تنفيذٌ يشترط أن يُكتب ما قُرئ. والسببُ أنّ الفعلَ لا رجعةَ فيه.

   ═══ ولا يُمحى سجلٌّ من هنا ═══

   للحذف بابان: `حذفُ حسابٍ نهائيّا` و`محوُ حسابٍ بسجلّه كلّه`. والجملةُ
   للأوّل وحدَه (ل-٤): محوُ التاريخ يُتلف تسجيلاتٍ وطلباتٍ وفواتيرَ قد
   تُطلَب بعد سنة، فيبقى حسابا حسابا — بطيئا بقصد، وبسببٍ يُكتب.

   فما يحمل شيئا يُردّ هنا ولا يُحذف قسرا مهما كانت رتبةُ الضاغط. */

import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { accountFootprint, footprintBlockersAr } from './account-purge.service'
import {
  decideBulk, deletableIds, bulkExecuteBlockerAr, MAX_BULK_PURGE, TOP_ROLE,
  type BulkDecision,
} from '../../src/application/admin/bulk-purge'

export interface BulkPreviewRow {
  id: string
  email: string
  displayName: string
  roles: string[]
  deletable: boolean
  whyAr: string | null
}

export class BulkPurgeService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ما تحمله هذه الحسابات، وما يُحذف منها وما لا — قبل أن يقع شيء */
  async preview(actorId: string, ids: readonly string[]): Promise<{
    rows: BulkPreviewRow[]; deletable: number; refused: number
  }> {
    const unique = [...new Set(ids)]
    if (unique.length === 0) throw new AuthError('empty', 'لم يُختر حساب', 400)
    if (unique.length > MAX_BULK_PURGE) {
      throw new AuthError('too_many', `لا تزيد الدفعةُ على ${MAX_BULK_PURGE} حسابا`, 400)
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, email: true, displayName: true, roles: { select: { roleId: true } } },
    })

    /* ما يحمله كلُّ حسابٍ — وهو ما يُكلّف، فيُجمع مرّةً */
    const footprints = await Promise.all(
      users.map(async (u) => ({ id: u.id, blockers: footprintBlockersAr(await accountFootprint(this.prisma, u.id)) })),
    )
    const blockersOf = new Map(footprints.map((f) => [f.id, f.blockers]))

    const topAdminsBefore = await this.prisma.userRole.count({ where: { roleId: TOP_ROLE } })
    const decisions = decideBulk(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        roles: u.roles.map((r) => r.roleId),
        blockers: blockersOf.get(u.id) ?? [],
      })),
      { actorId, topAdminsBefore },
    )
    const byId = new Map(decisions.map((d) => [d.id, d]))

    const rows: BulkPreviewRow[] = users.map((u) => {
      const d = byId.get(u.id)!
      return {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        roles: u.roles.map((r) => r.roleId),
        deletable: d.deletable,
        whyAr: d.whyAr,
      }
    })
    return {
      rows,
      deletable: rows.filter((r) => r.deletable).length,
      refused: rows.filter((r) => !r.deletable).length,
    }
  }

  /* ═══ التنفيذُ يُعيد الحسابَ لا يثق بالمعاينة ═══

     بين المعاينة والضغط دقائقُ يشتري فيها أحدُهم دورةً أو تصل شهادة. فلو
     نُفِّذ على ما قُرئ لَمُحي حسابٌ صار له سجلٌّ بعد أن قُرئ فارغا. فالقرارُ
     يُعاد بناؤه هنا، والمعاينةُ للقارئ لا للآلة. */
  async execute(actorId: string, ids: readonly string[], typedCount: string) {
    const view = await this.preview(actorId, ids)
    const decisions: BulkDecision[] = view.rows.map((r) => ({
      id: r.id, deletable: r.deletable, whyAr: r.whyAr,
    }))

    const blocker = bulkExecuteBlockerAr(decisions, typedCount)
    if (blocker) throw new AuthError('not_confirmed', blocker, 409)

    const targets = deletableIds(decisions)
    const rowById = new Map(view.rows.map((r) => [r.id, r]))

    /* ═══ مرجعٌ واحدٌ للدفعة (ل-٦) ═══

       كلُّ حذفٍ يكتب صفَّ أثرٍ له. وبلا مرجعٍ مشترك يُقرأ السجلُّ بعد ستّة
       أشهر «واحدا وثلاثين حذفا غيرَ مفسَّرٍ يتلو بعضُه بعضا في ثانية» — لا
       «عمليّةً واحدةً مقصودةً على واحدٍ وثلاثين حسابا». */
    const batchId = randomUUID()
    let purged = 0
    for (const id of targets) {
      const row = rowById.get(id)!
      /* الأثرُ قبل المحو: بعده لا يبقى ما يُشار إليه */
      await recordAudit(this.prisma, {
        actorId, action: 'admin.user.purge', entityType: 'user', entityId: id,
        meta: { email: row.email, displayName: row.displayName, roles: row.roles, batchId, batchSize: targets.length },
      })
      await this.prisma.user.delete({ where: { id } })
      purged += 1
    }

    await recordAudit(this.prisma, {
      actorId, action: 'admin.users.purge_bulk', entityType: 'user', entityId: batchId,
      meta: { batchId, purged, refused: view.refused, requested: [...new Set(ids)].length },
    })
    return { batchId, purged, refused: view.refused }
  }
}
