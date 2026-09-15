/* إعادةُ ضبط الحسابات — البند ٦٦.

   ─────────── ما هي ───────────

   محوُ **حسابات الناس ومعاملاتِهم** استعدادا للإطلاق، وإبقاءُ **أصول
   المنتج** كما هي: الكتالوجُ كلُّه، ومحرّكُ التشخيص، وبنيةُ الشعب، والأدوارُ
   والصلاحيّات، ومسارُ اعتماد المحتوى — **وسجلُّ الأثر، لا يُحذف أبدا**.

   ─────────── ولماذا لم توجد قبل اليوم ───────────

   لم يكن في المنصّة محوٌ جماعيٌّ من أيّ نوع: البحثُ في الخادم والسكربتات لا
   يجد شيئا. وكان الموجودُ محوَ **حسابٍ واحد** — وفيه عطبٌ يُجهض المعاملةَ
   على أوّل شهادة (البند ٦٤، أُصلح). **وكلُّ مسحٍ جماعيٍّ يُبنى عليه كان
   سيرث ذلك العطب**، فيقف في منتصفه ولا يتمّ ولا يرتدّ.

   ─────────── وخمسةُ حرّاسٍ لا يُتجاوَز واحدٌ منها ───────────

   ١) **إثباتُ استرجاعٍ حديث** (البند ٦٥). محوٌ لا رجعةَ فيه فوق نسخةٍ لم
      يُثبت أنّها تُسترجَع ليس محوا بل مقامرة. والفحصُ آليٌّ لا تذكيرٌ في
      وثيقة: `backup-attestation`.
   ٢) **المؤسِّسون لا يُمَسّون.** الحمايةُ في الخدمة لا في الشاشة، ومصدرُها
      `FOUNDER_EMAILS` — قائمةٌ في الشيفرة يراجعها Git، لا ثابتٌ مخفيّ.
      ومعهم **الفاعلُ نفسُه**: من يمحو لا يمحو نفسَه فيفقد بابَه.
   ٣) **معاينةٌ أوّلا** — أعدادٌ لكلّ جدول. وهي عقدُ المنصّة القائم في
      «افتح الفصل» ومزامنةِ الحالات: لا زرَّ ينفّذ قبل أن يُعرض ما سيقع.
   ٤) **تأكيدٌ مزدوج**: يُكتب **عددُ الحسابات** كما عُرض (فمن لم يقرأ المعاينةَ
      لا يعرفه)، **وسببٌ لا يقلّ عن عشرين حرفا**.
   ٥) **الأثرُ يُكتب قبل المحو** — لأنّ الكيانَ بعده لا وجودَ له.

   ─────────── ووضعان ───────────

   · `purge`   — محوٌ الآن. لبيانات التجربة قبل الإطلاق.
   · `archive` — إيقافٌ وتعميةُ هويّة: يبقى الصفُّ ويسقط الدخول. لِما بعد
     الإطلاق، حيث للمحو تبعاتٌ محاسبيّةٌ وقانونيّة.

   ─────────── وما بعده ───────────

   مسحُ المسجَّلين يترك شعبا «مكتملةً» بصفر تسجيل. فتُعاد مزامنةُ الحالات
   بالتواريخ — بالدالّة القائمة نفسِها لا بنسخةٍ ثانية. */

import type { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { AuthError } from './auth.service'
import { recordAudit } from './audit'
import { accountErasedMail } from './account-mail'
import { enqueueMail } from './outbox.service'
import { FOUNDER_EMAILS } from '../auth/founders'
import { attestationState, type AttestationState } from './backup-attestation'
import { purgeAccountWithHistory } from './account-purge.service'
import { CohortService } from './cohort.service'

export type ResetMode = 'purge' | 'archive'

export const MIN_REASON_LENGTH = 20

export interface ResetPreview {
  mode: ResetMode
  /** الحساباتُ التي ستُمسّ — عددا وعيّنةً تُقرأ */
  targets: number
  sample: { email: string; displayName: string }[]
  /** المحميّون ولماذا */
  protectedAccounts: { email: string; reasonAr: string }[]
  /** أعدادُ ما يذهب معهم — الجدولُ الذي يقرؤه صاحبُ المنصّة قبل أن يكتب العدد */
  counts: Record<string, number>
  /** حالةُ إثبات الاسترجاع — ولا تنفيذَ بلا `ok` */
  backup: AttestationState
  /** ما لا يُمَسّ — يُقال صراحةً كي لا يُظنّ أنّ المحوَ يبلغه */
  keepsAr: string[]
  notesAr: string[]
}

/** بريدُ من لا يُمَسّ — بحروفٍ صغيرة، كما يُخزَّن */
function protectedEmails(actorEmail: string | null): Set<string> {
  const set = new Set(FOUNDER_EMAILS.map((e) => e.trim().toLowerCase()))
  if (actorEmail) set.add(actorEmail.trim().toLowerCase())
  return set
}

export class AccountResetService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** ماذا سيقع لو نُفّذ — بلا أن يقع شيء */
  async preview(actorId: string, mode: ResetMode = 'purge', now = new Date()): Promise<ResetPreview> {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { email: true } })
    const keep = protectedEmails(actor?.email ?? null)

    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, displayName: true },
      orderBy: { createdAt: 'asc' },
    })
    const targets = users.filter((u) => !keep.has(u.email.trim().toLowerCase()))
    const targetIds = targets.map((t) => t.id)

    const [enrollments, orders, certificates, tickets, ratings, advisorCases, trainerProfiles] =
      await Promise.all([
        this.prisma.enrollment.count({ where: { userId: { in: targetIds } } }),
        this.prisma.order.count({ where: { userId: { in: targetIds } } }),
        this.prisma.certificate.count({ where: { enrollment: { userId: { in: targetIds } } } }),
        this.prisma.supportTicket.count({ where: { userId: { in: targetIds } } }),
        this.prisma.rating.count({ where: { raterId: { in: targetIds } } }),
        this.prisma.advisorCase.count({ where: { clientId: { in: targetIds } } }),
        this.prisma.trainerProfile.count({ where: { userId: { in: targetIds } } }),
      ])

    return {
      mode,
      targets: targets.length,
      sample: targets.slice(0, 10).map((t) => ({ email: t.email, displayName: t.displayName })),
      protectedAccounts: users
        .filter((u) => keep.has(u.email.trim().toLowerCase()))
        .map((u) => ({
          email: u.email,
          reasonAr: u.id === actorId ? 'أنت — من ينفّذ لا يمحو نفسَه' : 'مؤسِّسٌ في FOUNDER_EMAILS',
        })),
      counts: {
        الحسابات: targets.length,
        التسجيلات: enrollments,
        الطلبات: orders,
        الشهادات: certificates,
        'تذاكر الدعم': tickets,
        التقييمات: ratings,
        'حالات الاستشارة': advisorCases,
        'ملفّات المدرّبين': trainerProfiles,
      },
      backup: await attestationState(this.prisma, now),
      keepsAr: [
        'الكتالوج كلُّه — المسارات والدورات والوحدات والمهارات والمشاريع',
        'محرّك التشخيص كلُّه — الأسئلة والخيارات والملفّات',
        'بنية الشعب وجدولتها — تبقى، وتُعاد مزامنةُ حالاتها بعد المحو',
        'الأدوار والصلاحيّات وإعدادات التكامل',
        'سجلّ الأثر — لا يُحذف أبدا، وهو مصمَّمٌ ليبقى بلا مفتاحٍ يربطه بالمستخدم',
      ],
      notesAr: [
        'تسعون عمودا في المخطَّط تحمل معرّفَ فاعلٍ بلا مفتاحٍ خارجيّ («أنشأه» · «نشره» · «اعتمده») — فبعد المحو تُعرض معرّفاتٌ خامٌّ أو فراغ. مقبولٌ ومقصود.',
        mode === 'archive'
          ? 'الأرشفة: يبقى الصفُّ وتسقط إمكانيّةُ الدخول ويُعمّى البريدُ والاسم — للمُحاسَبة بعد الإطلاق.'
          : 'المحو: لا رجعةَ فيه. وما يذهب يذهب بمعاملةٍ لكلّ حساب — إمّا كلٌّ أو لا شيء.',
      ],
    }
  }

  /** التنفيذ — وخمسةُ حرّاسٍ قبل أوّل حذف */
  async execute(
    actorId: string,
    input: { mode: ResetMode; expectedCount: number; reason: string },
    now = new Date(),
  ) {
    const reason = input.reason?.trim() ?? ''
    if (reason.length < MIN_REASON_LENGTH) {
      throw new AuthError(
        'reason_required',
        `اكتب سببَ إعادة الضبط — ${MIN_REASON_LENGTH} حرفا على الأقلّ. يبقى في الأثر بعد أن تذهب الحسابات.`,
        400,
      )
    }

    const preview = await this.preview(actorId, input.mode, now)

    /* ١) إثباتُ الاسترجاع — قبل كلّ شيء، فبدونه لا معنى لبقيّة الحرّاس */
    if (!preview.backup.ok) {
      throw new AuthError('backup_unverified', preview.backup.reasonAr ?? 'لا نسخةَ مُثبَتة', 409)
    }

    /* ٢) العددُ يُكتب كما عُرض — فمن لم يقرأ المعاينةَ لا يعرفه.
          ولا يُقبل تقريبٌ ولا «كلّها»: العددُ نفسُه أو لا شيء. */
    if (input.expectedCount !== preview.targets) {
      throw new AuthError(
        'count_mismatch',
        `العددُ المكتوب ${input.expectedCount} والمعروضُ ${preview.targets}. راجع المعاينةَ — وقد تكون تغيّرت بين قراءتك وتنفيذك.`,
        409,
      )
    }

    if (preview.targets === 0) {
      throw new AuthError('nothing_to_do', 'لا حساباتٍ تُمسّ — كلُّها محميّة', 409)
    }

    /* ٣) الأثرُ قبل المحو: بعده لا يبقى ما يُشار إليه */
    await recordAudit(this.prisma, {
      actorId,
      action: input.mode === 'archive' ? 'accounts.reset_archive' : 'accounts.reset_purge',
      entityType: 'platform',
      entityId: 'accounts',
      reason,
      meta: {
        mode: input.mode,
        targets: preview.targets,
        counts: preview.counts,
        protectedAccounts: preview.protectedAccounts.map((p) => p.email),
        backupVerifiedAt: preview.backup.attestation?.at ?? null,
      },
    })

    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { email: true } })
    const keep = protectedEmails(actor?.email ?? null)
    const users = await this.prisma.user.findMany({ select: { id: true, email: true } })
    const targets = users.filter((u) => !keep.has(u.email.trim().toLowerCase()))

    const done: string[] = []
    const failed: { email: string; errorAr: string }[] = []
    /* ═══ والرسائلُ تُكتب في الطابور لا تخرج من هنا (ي-٦) ═══

       كان نداءُ الإرسال يقع في هذه الحلقة، **وجوابُه يُهمَل**: الدالّةُ تردّ
       حالَها ولا ترمي، فلا يلتقطها `catch` أدناه. ومزوّدٌ يردّ ٤٢٩ أو عنوانٌ
       يرتدّ يمرّ صامتا ويُمحى الحسابُ على كلّ حال.

       وهو هنا أوقعُ منه في المحو الجُمليّ: الساحةُ **كلُّ من في المنصّة**
       إلّا المستثنَين — فمئاتُ نداءاتٍ في حلقةٍ واحدةٍ على حدٍّ هو طلبان في
       الثانية. فتُكتب في `OutboxMail` ويُفرّغها العاملُ مُمَهَّلا.

       ومرجعُ الدفعة يجمعها: تُقرأ رسائلُ إعادةِ ضبطٍ واحدةٍ معا لا متفرّقة. */
    const batchId = randomUUID()

    for (const t of targets) {
      try {
        if (input.mode === 'archive') await this.archiveOne(t.id, t.email, reason, batchId)
        else {
          /* ═══ والبريدُ قبل المحو كالأثر (ي-٤) ═══

             الصفُّ يذهب كلُّه ومعه جرسُه، فالبريدُ هو الحامل. ومكتوبٌ في
             `account-mail.ts` لمَ، ولمَ يتقدّم الفعلَ على عرف الأثر. */
          await enqueueMail(this.prisma, {
            to: t.email,
            ...accountErasedMail({ to: t.email, reasonAr: reason, kind: 'reset_purge' }),
            purpose: 'account.erased.reset_purge',
            batchId,
          })
          await purgeAccountWithHistory(this.prisma, t.id)
        }
        done.push(t.email)
      } catch (e) {
        /* حسابٌ يتعثّر لا يوقف البقيّة: كلُّ حسابٍ معاملتُه وحدَه، فالمتعثّرُ
           يبقى كما كان ويُسمّى في الجواب. والبديلُ — إسقاطُ الكلّ لواحد — هو
           عينُ العطب الذي أُصلح في البند ٦٤. */
        failed.push({ email: t.email, errorAr: e instanceof Error ? e.message : 'خطأٌ غيرُ معروف' })
      }
    }

    /* ٤) ما بعده: الشعبُ تبقى، وحالاتُها تُعاد مزامنتُها بالتواريخ */
    let cohortsResynced = 0
    try {
      const res = await new CohortService(this.prisma).syncStatusesByDate(null, { apply: true, now })
      cohortsResynced = res.changed
    } catch {
      /* المزامنةُ تحسينٌ بعديّ لا شرطُ صحّة — لا تُسقط نتيجةَ المحو */
    }

    return { mode: input.mode, purged: done.length, failed, cohortsResynced, batchId }
  }

  /** الأرشفة: يبقى الصفُّ ويسقط الدخول وتُعمّى الهويّة */
  private async archiveOne(userId: string, email: string, reasonAr: string | undefined, batchId: string): Promise<void> {
    /* ═══ والبريدُ قبل المعاملة لا بعدها (ي-٤) ═══

       المعاملةُ أدناه تُعمّي العنوانَ إلى `archived+<id>@wajeez.invalid` —
       وهو مقصودٌ («ولا يُترك كما هو فيُراسَل بعد الأرشفة»). فبعدها لا عنوانَ
       في القاعدة يُبلَّغ به، والجرسُ لا يُقرأ لأنّ الدخولَ يُمنع على غير
       `active`. فالرسالةُ الأخيرةُ تخرج الآن، على العنوان الذي وصل به.

       و`reasonAr` يُمرَّر من الحلقة: لم يكن يصل هذه الطريقةَ أصلا، فكان
       السببُ يُلزَم به الموظّفُ ثمّ يُخفى عمّن يمسّه.

       ═══ وتُكتب في الطابور لا تخرج من هنا (ي-٦) ═══

       وهذه الطريقةُ تُنادى من حلقة إعادة الضبط نفسِها — أي أنّها **دفعةٌ**
       كالمحو سواءً بسواء، وإن بدت في قراءتها حسابا واحدا. فلو بقيت تُرسل
       مباشرةً لَبقي نصفُ الساحة على العطب الذي أُصلح في نصفها الآخر.

       والعنوانُ يُلتقط هنا قبل التعمية، ويبقى في الطابور — فما يُرسَل بعد
       دقائقَ يُرسَل إلى من كان، لا إلى `archived+…@wajeez.invalid`. */
    await enqueueMail(this.prisma, {
      to: email,
      ...accountErasedMail({ to: email, reasonAr, kind: 'reset_archive' }),
      purpose: 'account.erased.reset_archive',
      batchId,
    })
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId } })
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'archived',
          /* البريدُ يُعمّى ويبقى فريدا — ولا يُترك كما هو فيُراسَل بعد الأرشفة */
          email: `archived+${userId}@wajeez.invalid`,
          displayName: 'حسابٌ مؤرشَف',
          passwordHash: 'x'.repeat(60),
          emailVerifiedAt: null,
        },
      })
      await recordAudit(tx as unknown as PrismaClient, {
        actorId: null,
        action: 'accounts.reset_archive',
        entityType: 'user',
        entityId: userId,
        meta: { previousEmail: email },
      })
    })
  }
}
