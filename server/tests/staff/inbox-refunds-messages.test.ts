/* «ما ينتظرك»: الاستردادُ الذي ينتظر التنفيذ، ورسالةُ الموقع بلا ردّ (١٠ نوفمبر ٢٠٢٦).

   كانا في شاشتيهما وحدَهما — «المال» و«رسائل الموقع» في الدعم — فلا يراهما إلّا من فتحهما. وقرارُ صاحب المنصّة: «نعم،
   أضفها». فيأتيان في اللوح لمن يملك بابَهما وحدَه، ويفتح كلٌّ شاشةً في قائمته. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { StaffInboxService } from '../../services/staff-inbox.service'
import { ROLE_PERMISSIONS } from '../../auth/permissions'
import { sectionsFor } from '../../../src/pages/admin/nav-map'

let prisma: PrismaClient
let inbox: StaffInboxService
let viewer = ''
const STAMP = Date.now()
const permsOf = (role: string) => ROLE_PERMISSIONS[role] as readonly string[]
const itemFor = async (role: string, key: string) => (await inbox.forStaff(viewer, permsOf(role))).find((i) => i.key === key)

/** دفعةٌ ناجحةٌ على فاتورةٍ جديدة — ومعها ما يُطلب */
async function payment(extra = false) {
  const userId = (await new AuthService(prisma).register(`inbox-pay-${extra}-${STAMP}@test.local`, 'Learner#12345', 'مشتر')).userId
  const order = await prisma.order.create({ data: { userId, status: 'paid', subtotal: 100, total: 100, currency: 'USD' } })
  const invoice = await prisma.invoice.create({ data: { number: `INV-INBOX-${extra}-${STAMP}`, orderId: order.id, amount: 100, currency: 'USD', status: 'paid' } })
  return prisma.payment.create({
    data: {
      invoiceId: invoice.id, provider: 'stripe', amount: 100, currency: 'USD', status: 'succeeded', extra,
      idempotencyKey: `inbox-${extra}-${STAMP}`, succeededAt: new Date(),
    },
  })
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  inbox = new StaffInboxService(prisma)
  viewer = (await new AuthService(prisma).register(`inbox-viewer-${STAMP}@test.local`, 'Staff#12345', 'موظف')).userId
}, 240_000)

describe('رسائل الموقع بلا رد', () => {
  it('⚠️ تظهر للدعم بعددها — وما فات وعد اليوم عاجل، وما رد عليه يخرج', async () => {
    const old = await prisma.contactMessage.create({
      data: { reference: `WJ-C-OLD${STAMP % 1000}`, name: 'سائل قديم', email: 'old@test.local', topic: 'برنامج لجهتنا', message: 'نسأل عن برنامج', createdAt: new Date(Date.now() - 2 * 86_400_000) },
    })
    await prisma.contactMessage.create({
      data: { reference: `WJ-C-NEW${STAMP % 1000}`, name: 'سائل جديد', email: 'new@test.local', topic: 'استرداد', message: 'أريد استردادا' },
    })
    const item = await itemFor('support', 'site_messages')
    expect(item, 'لا بند لرسائل الموقع عند الدعم').toBeTruthy()
    expect(item!.count).toBe(2)
    expect(item!.severity, 'فات وعد يوم العمل ولم يعلم عاجلا').toBe('urgent')
    expect(item!.sample[0]).toBe('برنامج لجهتنا — سائل قديم')

    await prisma.contactMessage.update({ where: { id: old.id }, data: { handledAt: new Date() } })
    expect((await itemFor('support', 'site_messages'))?.count).toBe(1)
    expect(await itemFor('finance', 'site_messages'), 'رأت المالية رسائل الدعم').toBeUndefined()
  })
})

describe('استردادات تنتظر التنفيذ', () => {
  it('⚠️ طلب رد معلق ودفعة زائدة تظهران للمالية — لا للدعم', async () => {
    const p = await payment(false)
    await prisma.refund.create({ data: { paymentId: p.id, amount: 40, reason: 'سبب موثق للرد', requestedBy: viewer } })
    await payment(true)

    const item = await itemFor('finance', 'refunds')
    expect(item, 'لا بند للاستردادات عند المالية').toBeTruthy()
    expect(item!.count, 'طلب الرد والزائدة').toBe(2)
    expect(item!.severity).toBe('urgent')
    expect(item!.href).toBe('/admin/finance?tab=refunds')
    expect(await itemFor('support', 'refunds'), 'رأى الدعم الاستردادات').toBeUndefined()
  })

  it('وكل بند يفتح شاشة في قائمة صاحبه', async () => {
    for (const role of ['finance', 'support', 'super_admin']) {
      const reachable = new Set(sectionsFor(permsOf(role)).flatMap((s) => s.items.map((i) => i.to)))
      for (const item of (await inbox.forStaff(viewer, permsOf(role))).filter((i) => ['refunds', 'site_messages'].includes(i.key))) {
        expect(reachable.has(item.href.split('?')[0]), `${role}: «${item.titleAr}» يفتح ${item.href} وليست في قائمته`).toBe(true)
      }
    }
  })
})
