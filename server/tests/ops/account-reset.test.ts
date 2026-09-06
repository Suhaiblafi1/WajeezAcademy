/* إعادةُ ضبط الحسابات — خمسةُ حرّاسٍ لا يُتجاوَز واحدٌ منها (البندان ٦٥ · ٦٦).

   هذا أخطرُ ما في المنصّة: محوُ حسابات الناس ومعاملاتِهم كلِّها بلا رجعة.
   فما يُحرَس هنا ليس «أنّه يعمل» — بل **أنّه يمتنع**:

   ١) بلا استرجاعٍ مُثبَتٍ حديثٍ لا يقع شيء (البند ٦٥). وهذا هو الحارسُ
      الذي يجعل «شرطٌ لا يُتجاوَز» شرطا تفرضه الآلةُ لا وعدا في وثيقة.
   ٢) والمؤسِّسون لا يُمَسّون، ولا الفاعلُ نفسُه.
   ٣) والعددُ يُكتب كما عُرض — فمن لم يقرأ المعاينةَ لا يعرفه.
   ٤) والسببُ عشرون حرفا فأكثر.
   ٥) والأثرُ يُكتب **قبل** المحو، لأنّ الكيانَ بعده لا وجودَ له. */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { setupTestDb, testPrisma } from '../helpers/db'
import { AuthService } from '../../services/auth.service'
import { AccountResetService, MIN_REASON_LENGTH } from '../../services/account-reset.service'
import { ATTESTATION_KEY, MAX_AGE_DAYS } from '../../services/backup-attestation'
import { FOUNDER_EMAILS } from '../../auth/founders'

let prisma: PrismaClient
let auth: AuthService
let reset: AccountResetService
let adminId = ''
const STAMP = Date.now()

/** يكتب إثباتَ استرجاعٍ بعمرٍ محدَّد — كما يكتبه `deploy/backup.sh --verify` */
async function attest(ageDays: number) {
  await prisma.systemSetting.upsert({
    where: { key: ATTESTATION_KEY },
    create: {
      key: ATTESTATION_KEY,
      value: { at: new Date(Date.now() - ageDays * 86_400_000).toISOString(), file: 'x.sql.gz', users: 12, orders: 3 },
    },
    update: {
      value: { at: new Date(Date.now() - ageDays * 86_400_000).toISOString(), file: 'x.sql.gz', users: 12, orders: 3 },
    },
  })
}
const clearAttestation = () => prisma.systemSetting.deleteMany({ where: { key: ATTESTATION_KEY } })

let seq = 0
async function learner() {
  seq += 1
  const { userId } = await auth.register(`reset-${seq}-${STAMP}@test.local`, 'Learner#12345', `متعلّم ${seq}`)
  return userId
}

beforeAll(async () => {
  await setupTestDb()
  prisma = await testPrisma()
  auth = new AuthService(prisma)
  reset = new AccountResetService(prisma)
  const a = await auth.register(`reset-admin-${STAMP}@test.local`, 'Admin#123456', 'المدير الأعلى')
  adminId = a.userId
  await auth.setRoles(adminId, ['super_admin'])
}, 240_000)

beforeEach(async () => { await clearAttestation() })

describe('٦٥ · لا محوَ بلا استرجاعٍ مُثبَت', () => {
  it('بلا إثباتٍ إطلاقا: يمتنع، ويقول الأمرَ الذي يُشغَّل', async () => {
    await learner()
    const preview = await reset.preview(adminId)
    expect(preview.backup.ok).toBe(false)
    expect(preview.backup.reasonAr).toContain('backup.sh --verify')

    await expect(
      reset.execute(adminId, { mode: 'purge', expectedCount: preview.targets, reason: 'تنظيفُ بيانات التجربة قبل الإطلاق' }),
    ).rejects.toMatchObject({ code: 'backup_unverified' })
  })

  it('وبإثباتٍ شاخَ: يمتنع كذلك — نسخةُ يناير لا تقول شيئا عن قاعدة مارس', async () => {
    await learner()
    await attest(MAX_AGE_DAYS + 1)
    const preview = await reset.preview(adminId)
    expect(preview.backup.ok).toBe(false)
    await expect(
      reset.execute(adminId, { mode: 'purge', expectedCount: preview.targets, reason: 'تنظيفُ بيانات التجربة قبل الإطلاق' }),
    ).rejects.toMatchObject({ code: 'backup_unverified' })
  })

  it('وبإثباتٍ حديث: يُفتح الباب', async () => {
    await attest(1)
    const preview = await reset.preview(adminId)
    expect(preview.backup.ok).toBe(true)
    expect(preview.backup.attestation?.users).toBe(12)
  })
})

describe('٦٦ · التأكيدُ المزدوج', () => {
  it('سببٌ أقصرُ من عشرين حرفا يُردّ — قبل أيّ فحصٍ آخر', async () => {
    await attest(1)
    await expect(
      reset.execute(adminId, { mode: 'purge', expectedCount: 1, reason: 'تنظيف' }),
    ).rejects.toMatchObject({ code: 'reason_required' })
    expect(MIN_REASON_LENGTH).toBe(20)
  })

  it('وعددٌ لا يطابق المعروضَ يُردّ — فمن لم يقرأ المعاينةَ لا يعرفه', async () => {
    await learner()
    await attest(1)
    const preview = await reset.preview(adminId)
    await expect(
      reset.execute(adminId, { mode: 'purge', expectedCount: preview.targets + 1, reason: 'تنظيفُ بيانات التجربة قبل الإطلاق' }),
    ).rejects.toMatchObject({ code: 'count_mismatch' })
    /* ولا حسابَ ذهب: الردُّ قبل أوّل حذف */
    expect(await prisma.user.count()).toBeGreaterThan(1)
  })
})

describe('٦٦ · من لا يُمَسّ', () => {
  it('المؤسِّسُ والفاعلُ نفسُه خارج المحو — والحمايةُ في الخدمة لا في الشاشة', async () => {
    const founderEmail = FOUNDER_EMAILS[0]
    const founder = await auth.register(founderEmail, 'Founder#12345', 'المؤسِّس')
    const victim = await learner()
    await attest(1)

    const preview = await reset.preview(adminId)
    const kept = preview.protectedAccounts.map((p) => p.email.toLowerCase())
    expect(kept, 'المؤسِّسُ غيرُ محميّ').toContain(founderEmail.toLowerCase())
    expect(preview.sample.map((s) => s.email)).not.toContain(founderEmail)

    await reset.execute(adminId, {
      mode: 'purge', expectedCount: preview.targets, reason: 'تنظيفُ بيانات التجربة قبل الإطلاق',
    })

    expect(await prisma.user.findUnique({ where: { id: founder.userId } }), 'مُحي المؤسِّس').not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: adminId } }), 'مُحي الفاعلُ نفسُه').not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: victim } })).toBeNull()
  })
})

describe('٦٦ · الأثرُ يُكتب قبل المحو', () => {
  it('لأنّ الكيانَ بعده لا وجودَ له — ويحمل الأعدادَ والسببَ وإثباتَ النسخة', async () => {
    await learner()
    await attest(2)
    const preview = await reset.preview(adminId)
    const reason = 'محوُ حسابات التجربة استعدادا للإطلاق العامّ'

    await reset.execute(adminId, { mode: 'purge', expectedCount: preview.targets, reason })

    const entry = await prisma.auditEvent.findFirst({
      where: { action: 'accounts.reset_purge', entityType: 'platform' },
      orderBy: { createdAt: 'desc' },
    })
    expect(entry, 'لا أثرَ كُتب').not.toBeNull()
    expect(entry?.reason).toBe(reason)
    const meta = entry?.meta as { targets?: number; backupVerifiedAt?: string | null }
    expect(meta.targets).toBe(preview.targets)
    expect(meta.backupVerifiedAt, 'الأثرُ لا يحمل إثباتَ النسخة').toBeTruthy()
  })
})

describe('٦٦ · الأرشفة: يبقى الصفُّ ويسقط الدخول', () => {
  it('تُعمّى الهويّةُ ولا يُحذف السجلّ — لِما بعد الإطلاق', async () => {
    const u = await learner()
    await attest(1)
    const preview = await reset.preview(adminId, 'archive')

    await reset.execute(adminId, {
      mode: 'archive', expectedCount: preview.targets, reason: 'أرشفةُ حسابات التجربة بعد الإطلاق',
    })

    const after = await prisma.user.findUnique({ where: { id: u } })
    expect(after, 'حُذف الصفُّ في وضع الأرشفة').not.toBeNull()
    expect(after?.status).toBe('archived')
    expect(after?.email).toContain('@wajeez.invalid')
    expect(await prisma.session.count({ where: { userId: u } })).toBe(0)
  })
})

describe('وما لا يُمَسّ يُقال صراحةً', () => {
  it('الكتالوجُ وسجلُّ الأثر في قائمة «يبقى» — لا يُترك للظنّ', async () => {
    await attest(1)
    const preview = await reset.preview(adminId)
    const keeps = preview.keepsAr.join(' · ')
    expect(keeps).toContain('الكتالوج')
    expect(keeps).toContain('سجلّ الأثر')
    expect(keeps).toContain('التشخيص')
  })
})
