/* طابورُ البريد الخارج — الجدولُ الوحيدُ الذي يبقى بعد من يُخبِره (ي-٦).

   ═══ العقدةُ التي يفكّها ═══

   دفعةُ محوٍ تُخبر كلَّ من تمحوه. وحدُّ المزوّد القياسيُّ **طلبان في
   الثانية**، وحدُّ الدفعة مئتا حساب — فدفعةٌ مُمَهَّلةٌ كما ينبغي تحتاج نحوَ
   **مئةِ ثانيةٍ داخلَ طلبٍ واحد**، ولا يصلح ذلك في مسار HTTP. وبلا مهلةٍ
   يردّ المزوّدُ ٤٢٩ على ما زاد، **فتُبتلع رسائلُ ناسٍ حقيقيّين** ويُحذف
   حسابُهم على كلّ حال.

   فالدفعةُ تكتب هنا وتعود في حينها، ويُفرّغ العاملُ مُمَهَّلا.

   ═══ ولمَ جدولٌ ثانٍ وفي المنصّة طابورُ إشعاراتٍ قائم ═══

   وهذا السؤالُ يجب أن يُجاب لا أن يُمَرّ: طابوران للبريد في منصّةٍ واحدةٍ
   مخالفةٌ لعُرفها («مالكٌ واحدٌ لكلّ قاعدة»)، ولا تصحّ إلّا بسببٍ بنيويّ.

   والسببُ أنّ `Notification.userId` معلَّقٌ بصاحبه بـ`onDelete: Cascade`.
   ورسالةُ المحو تخرج إلى **من يُمحى صفُّه بعد ثانية** — فصفٌّ في ذلك الطابور
   يُحذف مع صاحبه قبل أن يقرأه العامل. أي أنّ الطابورَ القائمَ لا يصلح لهذه
   الرسالة بعينها، لا أنّه لا يُعجبنا.

   فالحدُّ بين الطابورَين حدٌّ في المعنى لا في الذوق:
   · `Notification` — ما يصل **صاحبَ حسابٍ قائم**، وله جرسٌ في المنصّة.
   · `OutboxMail`  — ما يصل **عنوانا** بلا حسابٍ يبقى خلفه.

   ═══ وما يبقى منه بعد الإرسال ═══

   متنُ الرسالة يُمحى ساعةَ تخرج. فمن مُحي حسابُه بسجلّه كلِّه لا يبقى نصُّ
   رسالته في قاعدتنا أسابيع: يبقى **أنّه أُخبِر ومتى**، وهو ما يُسأل عنه، لا
   ما كُتب له. وقد وعدناه بمحوٍ كامل، فلا نُبقي منه أكثرَ ممّا يلزم للوفاء
   بالوعد الآخر — أن يُخبَر. */

import type { PrismaClient, Prisma } from '@prisma/client'
import { sendDirectEmail, type DirectMailResult } from './notification.service'

type Db = PrismaClient | Prisma.TransactionClient

/** أقصى ما يُحاوَل لصفٍّ واحد — ثمّ يُترك `failed` يُقرأ ويُعاد باليد */
export const OUTBOX_MAX_ATTEMPTS = 3

/* ═══ المهلةُ بين رسالتَين ═══

   حدُّ Resend القياسيُّ طلبان في الثانية. وخمسُ مئةِ ميلي ثانيةٍ تقف على
   الحدّ تماما، فيكفي جيتَرُ الشبكة لتجاوزه. فستُّ مئةٍ: نحوُ ١٫٦ في الثانية،
   تحت الحدّ بهامشٍ يُحتمل.

   وهي هنا لا في مسار الطلب — وذاك كلُّ الفرق: ثانيتان في العامل لا يشعر
   بهما أحد، وثانيتان في طلبٍ ينتظره موظّفٌ أمام شاشةٍ عطبٌ. */
export const OUTBOX_GAP_MS = 600

const sleep = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms) })

export interface OutboxEntry {
  to: string
  subject: string
  text: string
  html?: string
  /** لأيّ شيءٍ كُتبت — `account.erased.purge` ونحوُه */
  purpose?: string
  /** مرجعُ الدفعة (ل-٦): تُقرأ رسائلُ عمليّةٍ واحدةٍ معا */
  batchId?: string
}

/** يكتب رسالةً في الطابور — يُستعمل داخل المعاملة وخارجَها */
export async function enqueueMail(db: Db, entry: OutboxEntry): Promise<void> {
  await db.outboxMail.create({
    data: {
      to: entry.to, subject: entry.subject, text: entry.text, html: entry.html ?? null,
      purpose: entry.purpose ?? null, batchId: entry.batchId ?? null,
    },
  })
}

export interface OutboxRun {
  sent: number
  failed: number
  /** ما بقي في الطابور بعد هذه الدورة */
  remaining: number
}

/* ═══ تفريغُ الطابور — دورةٌ واحدة ═══

   والمُنادي (العامل) يسأل عن القناة قبل أن يُنادي: صفٌّ يُحاوَل وقناتُه
   مغلقةٌ يرفع عدّادَه ويقترب من حدّ المحاولات بلا أن يكون أحدٌ حاول إرسالَه
   — وهو عرفُ `dispatchQueuedNotifications` نفسُه. */
/* ═══ ولمَ المُرسِلُ يُحقَن ═══

   بوّابةُ `MAIL_LIVE` تردّ كلَّ إرسالٍ في غير الإنتاج — بحقّ، فهي تمنع أن
   يصل بريدٌ حقيقيٌّ من جهاز أحد. وأثرُها أنّ **فرعَ النجاح في هذه الدالّة
   لا يُبلَغ في اختبارٍ أبدا**: ما يقع عنده — تعليمُ الصفّ `sent` ومحوُ متنه —
   لا يُفحَص.

   وقد كُتب له حارسٌ أوّلَ مرّةٍ يكتب التبديلَ بيده ثمّ يقرؤه، فمرّ أخضرَ وهو
   يفحص القاعدةَ لا الشيفرة: نُزع محوُ المتن من الدالّة فبقي أخضر. فالمُرسِلُ
   يُحقَن، وافتراضُه المُرسِلُ الحقيقيّ — والعاملُ لا يمرّر شيئا. */
export type OutboxSender = (to: string, subject: string, text: string, html?: string) => Promise<DirectMailResult>

export async function drainOutbox(
  prisma: PrismaClient,
  opts: { limit: number; gapMs?: number; send?: OutboxSender },
): Promise<OutboxRun> {
  const gap = opts.gapMs ?? OUTBOX_GAP_MS
  const send: OutboxSender = opts.send
    ?? ((to, subject, text, html) => sendDirectEmail(prisma, { to, subject, text, html }))
  const due = await prisma.outboxMail.findMany({
    where: { status: 'queued', attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
    /* الأقدمُ أوّلا — الوعدُ الأقدمُ أحقُّ بالوفاء */
    orderBy: { createdAt: 'asc' },
    take: opts.limit,
  })

  let sent = 0
  let failed = 0
  for (const [i, row] of due.entries()) {
    /* المهلةُ **بين** الرسائل لا قبل أولاها: دورةٌ فيها رسالةٌ واحدةٌ لا تنام */
    if (i > 0 && gap > 0) await sleep(gap)

    const out = await send(row.to, row.subject, row.text ?? '', row.html ?? undefined)

    if (out.status === 'sent') {
      await prisma.outboxMail.update({
        where: { id: row.id },
        /* والمتنُ يُمحى هنا: أُدّي الغرضُ، وما بقي يُسأل عنه «أأُخبر ومتى» */
        data: {
          status: 'sent', sentAt: new Date(), attempts: { increment: 1 },
          lastError: null, text: null, html: null,
        },
      })
      sent += 1
      continue
    }

    /* `not_configured` ليس سقوطا ولا يرفع العدّاد: لا قناةَ أصلا. ولا يقع
       هنا عادةً لأنّ المُنادي يسأل عن القناة قبل الدورة — ويُحرَس على كلّ
       حالٍ، فحارسٌ في مكانَين أرخصُ من صفٍّ يُحرَق. */
    if (out.status === 'not_configured') continue

    const attempts = row.attempts + 1
    await prisma.outboxMail.update({
      where: { id: row.id },
      data: {
        attempts,
        lastError: out.error ?? 'سقط الإرسال',
        /* يبقى `queued` ما دام في العمر محاولة، ويصير `failed` عند الحدّ —
           فما يُقرأ في الشاشة «فشل» هو ما لا محاولةَ له بعد. */
        status: attempts >= OUTBOX_MAX_ATTEMPTS ? 'failed' : 'queued',
      },
    })
    failed += 1
  }

  const remaining = await prisma.outboxMail.count({
    where: { status: 'queued', attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
  })
  return { sent, failed, remaining }
}
