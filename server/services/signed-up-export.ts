/* من أنشأ حسابَه ولم يسجّل في شعبةٍ بعد — في ملفّ Excel كملفّ المنحة (٩ نوفمبر ٢٠٢٦).

   طلبُ صاحب المنصّة: «I just need to download them as i do with grants». فاللوحُ («الطلبة») يعرضهم بطاقات، وهذا
   ينزّلهم كلَّهم ليُتواصل معهم خارج المنصّة. والجمهورُ نفسُه الذي يُلحقه اللوحُ (`LearnersService.list`): دورُه «متعلّم»
   وحدَه، غيرُ مؤرشف، ولا تسجيلَ له إلّا منسحبا — بلا حدّ الخمسمئة الذي في اللوح، لأنّ الملفّ للكلّ.

   ومعه ما يعين على التواصل: هاتفُه إن كتبه في ملفّه، وتوثيقُ بريده، ومصدرُه، وموافقتُه على رسائل التسويق — فمن لم
   يوافق يُعرف قبل أن يُراسَل. */

import type { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import { zonedClock, zonedDay } from '../../src/application/trainer/cohort-period'
import { sourceLabelAr, storedSource } from '../../src/application/marketing/signup-source'

const stamp = (d: Date | null | undefined) => (d ? `${zonedDay(d)} ${zonedClock(d)}` : '')

/** من لم يسجّل بعد — الأحدثُ أوّلا */
export async function signedUpNotEnrolled(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    where: {
      roles: { some: { roleId: 'learner' }, every: { roleId: 'learner' } },
      status: { not: 'archived' },
      enrollments: { none: { status: { not: 'dropped' } } },
    },
    select: {
      id: true, email: true, displayName: true, status: true, createdAt: true, emailVerifiedAt: true,
      learnerProfile: { select: { phone: true, country: true } },
      signupSource: true,
      consentRecords: { where: { kind: 'marketing', revokedAt: null }, select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })
  return users.map((u) => {
    const src = sourceLabelAr(storedSource(u.signupSource ?? null))
    return {
      id: u.id,
      name: u.displayName,
      email: u.email,
      phone: u.learnerProfile?.phone ?? null,
      country: u.learnerProfile?.country ?? null,
      verified: u.emailVerifiedAt !== null,
      active: u.status === 'active',
      marketing: u.consentRecords.length > 0,
      createdAt: u.createdAt,
      sourceAr: src.labelAr,
      sourceDetailAr: src.detailAr,
    }
  })
}

export async function signedUpXlsx(prisma: PrismaClient): Promise<Buffer> {
  const rows = await signedUpNotEnrolled(prisma)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('لم يسجلوا في شعبة')
  ws.columns = [
    { header: 'الاسم', key: 'name', width: 26 },
    { header: 'البريد', key: 'email', width: 32 },
    { header: 'الهاتف', key: 'phone', width: 18 },
    { header: 'الدولة', key: 'country', width: 14 },
    { header: 'أنشأ حسابه', key: 'created', width: 18 },
    { header: 'البريد موثق', key: 'verified', width: 12 },
    { header: 'يقبل رسائل التسويق', key: 'marketing', width: 16 },
    { header: 'المصدر', key: 'source', width: 22 },
    { header: 'تفصيل المصدر', key: 'sourceDetail', width: 36 },
    { header: 'الحساب', key: 'state', width: 10 },
  ]
  for (const r of rows) {
    ws.addRow({
      name: r.name, email: r.email, phone: r.phone ?? '', country: r.country ?? '',
      created: stamp(r.createdAt), verified: r.verified ? 'نعم' : 'لا', marketing: r.marketing ? 'نعم' : 'لا',
      source: r.sourceAr, sourceDetail: r.sourceDetailAr ?? '', state: r.active ? 'نشط' : 'موقوف',
    })
  }
  ws.getRow(1).font = { bold: true }
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
