/* اختبار E2E لمنظومة المستشارين والسير الذاتية:
   إرفاق التشخيص بالحساب → عميل محتمل + حالة بلا تكرار → إسناد →
   المسند فقط يرى (غير المسند ممنوع) → تواصل ينقل الحالة → ملاحظات ومهام
   ومتابعات → سيرة بموافقة إلزامية ونوع وحجم مقبولان → قراءة للمالك
   والمستشار المسند فقط وكل مشاهدة مسجلة → حذف وفق السياسة. */

import { beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AdvisorService } from '../../services/advisor.service'
import { CvService } from '../../services/cv.service'

let prisma: PrismaClient
let auth: AuthService
let advisors: AdvisorService
let cvs: CvService
let managerId: string
let advisorId: string
let otherAdvisorId: string
let learnerId: string
let caseId: string

const SNAPSHOT = {
  kind: 'pathway', pathwayId: 'PW-FND-003', confidence: 0.82,
  decision_trace: [{ rule: 'interest_match', value: 'قيادية' }],
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  advisors = new AdvisorService(prisma)
  cvs = new CvService(prisma)

  const m = await auth.register('adv-manager@test.local', 'Manager#12345', 'مدير عمليات')
  managerId = m.userId
  await auth.setRoles(managerId, ['operations_manager'])

  const a = await auth.register('adv-advisor@test.local', 'Advisor#12345', 'مستشار أول')
  advisorId = a.userId
  await auth.setRoles(advisorId, ['advisor'])

  const o = await auth.register('adv-other@test.local', 'Advisor#12345', 'مستشار آخر')
  otherAdvisorId = o.userId
  await auth.setRoles(otherAdvisorId, ['advisor'])

  const l = await auth.register('adv-learner@test.local', 'Learner#12345', 'متعلم التشخيص')
  learnerId = l.userId
}, 240_000)

describe('انتقال التشخيص إلى حساب وحالة مستشار', () => {
  it('1) إرفاق التشخيص ينشئ ملف متعلم وعميلا محتملا وحالة new', async () => {
    const { lead, case: kase } = await advisors.attachDiagnostic(learnerId, SNAPSHOT, '127.0.0.1')
    caseId = kase.id
    expect(kase.status).toBe('new')
    expect(lead.userId).toBe(learnerId)
    const profile = await prisma.learnerProfile.findUnique({ where: { userId: learnerId } })
    expect(profile?.diagnosticSnapshot).toMatchObject({ pathwayId: 'PW-FND-003' })
  })

  it('2) إرفاق ثان لا يكرر الحالة المفتوحة', async () => {
    const again = await advisors.attachDiagnostic(learnerId, SNAPSHOT)
    expect(again.case.id).toBe(caseId)
    const count = await prisma.advisorCase.count({ where: { clientId: learnerId } })
    expect(count).toBe(1)
  })

  it('3) الإسناد لمستشار — وغير المستشار مرفوض', async () => {
    const unassigned = await advisors.listUnassigned()
    expect(unassigned.some((k) => k.id === caseId)).toBe(true)
    await expect(advisors.assign(caseId, learnerId, managerId))
      .rejects.toMatchObject({ code: 'not_advisor' })
    await advisors.assign(caseId, advisorId, managerId)
    const mine = await advisors.myCases(advisorId)
    expect(mine.some((k) => k.id === caseId)).toBe(true)
  })

  it('4) غير المسند ممنوع من ملف الحالة — المسند فقط يرى', async () => {
    await expect(advisors.caseDetail(otherAdvisorId, caseId))
      .rejects.toMatchObject({ code: 'not_assigned' })
    const detail = await advisors.caseDetail(advisorId, caseId)
    expect(detail.client?.email).toBe('adv-learner@test.local')
    expect(detail.diagnosticSnapshot).toMatchObject({ pathwayId: 'PW-FND-003' })
  })

  it('5) أول تواصل ينقل الحالة إلى contacted', async () => {
    await advisors.addContactEvent(advisorId, caseId, { channel: 'whatsapp', summary: 'تواصل تعريفي أول' })
    const kase = await prisma.advisorCase.findUnique({ where: { id: caseId } })
    expect(kase?.status).toBe('contacted')
  })

  it('6) ملاحظة ومهمة ومتابعة وإجراء تالٍ — كلها على الحالة', async () => {
    await advisors.addNote(advisorId, caseId, 'العميل يفضل التواصل مساء')
    const task = await advisors.addTask(advisorId, caseId, 'إرسال عرض المسار', new Date('2026-08-20T10:00:00Z'))
    await advisors.completeTask(advisorId, task.id)
    const fu = await advisors.addFollowUp(advisorId, caseId, { scheduledAt: new Date('2026-08-22T15:00:00Z'), channel: 'whatsapp' })
    await advisors.completeFollowUp(advisorId, fu.id, 'answered', 'اطلع على العرض')
    await advisors.setNextAction(advisorId, caseId, 'تأكيد قرار التسجيل', new Date('2026-08-25T12:00:00Z'))
    await advisors.setStatus(advisorId, caseId, 'follow_up')
    const detail = await advisors.caseDetail(advisorId, caseId)
    expect(detail.status).toBe('follow_up')
    expect(detail.notes.length).toBe(1)
    expect(detail.tasks[0]?.doneAt).not.toBeNull()
    expect(detail.followUps[0]?.outcome).toBe('answered')
    expect(detail.nextAction).toBe('تأكيد قرار التسجيل')
  })
})

describe('السير الذاتية', () => {
  it('7) بلا موافقة صريحة يُرفض الرفع', async () => {
    await expect(cvs.upload(learnerId, { originalName: 'cv.pdf', mime: 'application/pdf', sizeBytes: 1000, consent: false }))
      .rejects.toMatchObject({ code: 'consent_required' })
  })

  it('8) نوع غير مدعوم وحجم فوق 10MB مرفوضان على الخادم', async () => {
    await expect(cvs.upload(learnerId, { originalName: 'x.exe', mime: 'application/x-msdownload', sizeBytes: 1000, consent: true }))
      .rejects.toMatchObject({ code: 'bad_type' })
    await expect(cvs.upload(learnerId, { originalName: 'cv.pdf', mime: 'application/pdf', sizeBytes: 11 * 1024 * 1024, consent: true }))
      .rejects.toMatchObject({ code: 'too_large' })
  })

  let cvId = ''
  it('9) رفع صحيح — سجل موافقة موثق ورابط رفع موقع', async () => {
    const { cv, uploadUrl } = await cvs.upload(learnerId, { originalName: 'سيرتي.pdf', mime: 'application/pdf', sizeBytes: 240_000, consent: true }, '127.0.0.1')
    cvId = cv.id
    expect(uploadUrl).toContain('/api/v1/uploads/')
    const consent = await prisma.consentRecord.findUnique({ where: { id: cv.consentId } })
    expect(consent?.textVersion).toBe('cv-upload-v1')
    expect((await cvs.listMine(learnerId)).length).toBe(1)
  })

  it('10) القراءة: المالك نعم، الغريب لا، المستشار المسند نعم — والمشاهدة مسجلة', async () => {
    await cvs.readUrl(cvId, learnerId, [], '127.0.0.1')
    await expect(cvs.readUrl(cvId, otherAdvisorId, ['cv.view']))
      .rejects.toMatchObject({ code: 'forbidden' })
    const url = await cvs.readUrl(cvId, advisorId, ['cv.view'])
    expect(url).toContain('sig=')
    const ownViews = await prisma.auditEvent.count({ where: { action: 'cv.view_own', entityId: cvId } })
    const advisorViews = await prisma.auditEvent.count({ where: { action: 'cv.view', entityId: cvId } })
    expect(ownViews).toBe(1)
    expect(advisorViews).toBe(1)
  })

  it('11) الحذف وفق السياسة — سبب موثق وحذف منطقي', async () => {
    await cvs.remove(cvId, learnerId, [], 'طلب صاحب السيرة حذفها')
    expect((await cvs.listMine(learnerId)).length).toBe(0)
    const cv = await prisma.cvSubmission.findUnique({ where: { id: cvId } })
    expect(cv?.status).toBe('deleted')
    expect(cv?.deletedAt).not.toBeNull()
  })
})
