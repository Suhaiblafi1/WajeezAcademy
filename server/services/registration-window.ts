/* نافذةُ التسجيل — موضعٌ واحدٌ يُقرأ لا ستّةٌ تتفرّق (البند ٥١).

   ─────────── ما كان ───────────

   التسجيلُ **قيمةٌ منطقيّةٌ بلا تواريخ**: `Cohort.registrationOpen`. فمتى
   فُتحت شعبةٌ صارت الدعوةُ مفتوحةً **إلى الأبد** — لا موعدَ يُعلَن ولا موعدَ
   يُنتظَر، والتسويقُ بلا نافذةٍ دعوةٌ دائمةٌ لا حملة.

   **وستّةُ مواضعَ في الخادم تقرأ تلك القيمةَ وحدَها**: السلّة، والتسجيل،
   والتحويل بين الشعب، وإنشاءُ الطلب، وشعبُ الخطّة، والكتالوجُ العامّ.
   وإضافةُ شرطٍ زمنيٍّ في ستّة مواضعَ يعني ستّةَ نسخٍ تفترق عند أوّل تعديل.

   ─────────── فالشرطُ هنا وحدَه ───────────

   وهو شرطان لا واحد:

   ١) **علمُ الشعبة**: `registrationOpen` — قرارُ من يديرها.
   ٢) **ونافذةُ فصلها**: إن كانت لها فصلٌ ذو نافذة.

   ─────────── وثلاثةُ حدودٍ تُقال صراحةً ───────────

   · **شعبةٌ بلا فصل** لا تُمنَع: شعبُ ما قبل هذا النظام، والمسوّداتُ التي
     تُنشأ قبل أن يُقرَّر فصلُها. الجديدُ لا يُبطل القائم.
   · **فصلٌ بلا نافذةٍ محدَّدة** لا يمنع: `null` تعني «لم تُحدَّد» لا «مغلقة».
     ولا يُسكَت متعلّمٌ عن الشراء لأنّ إداريّا لم يملأ حقلا.
   · **والسببُ يُقال**: من رُدَّ يعرف أَقَبْلَ الموعد جاء أم بعده — «يبدأ
     التسجيل في…» غيرُ «أُغلق التسجيل». */

import type { Prisma, PrismaClient } from '@prisma/client'
import { fmtDateLong } from '../../src/application/text/format-ar'
import { AuthError } from './auth.service'

/** حالةُ نافذة الفصل — تُقرأ من صفّه لا تُشتقّ من تواريخ الشعب */
export interface TermWindow {
  titleAr: string
  registrationOpensAt: Date | null
  registrationClosesAt: Date | null
}

export type WindowVerdict =
  | { open: true }
  | { open: false; reasonAr: string; code: 'not_yet' | 'closed' }

/** أنافذةُ هذا الفصل مفتوحةٌ الآن؟ — والفارغةُ لا تمنع */
export function termWindowVerdict(term: TermWindow | null, now = new Date()): WindowVerdict {
  if (!term) return { open: true }
  if (term.registrationOpensAt && now < term.registrationOpensAt) {
    return {
      open: false, code: 'not_yet',
      reasonAr: `التسجيل في ${term.titleAr} يبدأ ${fmtDateLong(term.registrationOpensAt)}`,
    }
  }
  if (term.registrationClosesAt && now > term.registrationClosesAt) {
    return {
      open: false, code: 'closed',
      reasonAr: `أُغلق التسجيل في ${term.titleAr} — وتُعلَن شعبُ الفصل التالي في موعدها`,
    }
  }
  return { open: true }
}

export type CohortVerdict =
  | { open: true }
  | { open: false; reasonAr: string; code: 'not_yet' | 'closed' | 'flag_off' }

/** الشعبةُ تقبل تسجيلا الآن؟ — العلمُ والنافذةُ معا، والسببُ يُقال.

    والعنوانُ يُذكَر إن عُرف: من يشتري ثلاثَ شعبٍ في سلّةٍ واحدة يحتاج أن
    يعرف **أيَّتُها** رُدَّت، لا أنّ «شعبةً» رُدَّت. */
export function cohortAcceptsRegistration(
  cohort: { registrationOpen: boolean; title?: string; term?: TermWindow | null },
  now = new Date(),
): CohortVerdict {
  if (!cohort.registrationOpen) {
    return {
      open: false, code: 'flag_off',
      reasonAr: cohort.title ? `التسجيل مغلق في «${cohort.title}»` : 'التسجيل في هذه الشعبة غير مفتوح',
    }
  }
  return termWindowVerdict(cohort.term ?? null, now)
}

/* ─────────── الشرطُ نفسُه في لغة الاستعلام ───────────

   المواضعُ التي **تسرد** الشعبَ (شعبُ الخطّة، والكتالوجُ العامّ) لا تفحص
   صفّا صفّا بل تُرشِّح في الاستعلام. فيلزم أن يكون الشرطُ واحدا في اللغتين —
   وإلّا عرض الكتالوجُ شعبةً يردّها التسجيل. */
export function openRegistrationWhere(now = new Date()): Prisma.CohortWhereInput {
  return {
    registrationOpen: true,
    OR: [
      /* بلا فصل: القائمُ قبل هذا النظام لا يُبطَل */
      { termId: null },
      {
        term: {
          AND: [
            { OR: [{ registrationOpensAt: null }, { registrationOpensAt: { lte: now } }] },
            { OR: [{ registrationClosesAt: null }, { registrationClosesAt: { gte: now } }] },
          ],
        },
      },
    ],
  }
}

/** حمولةُ القراءة التي يحتاجها الفحصُ — تُستعمل في `include` فلا يُنسى حقل */
export const TERM_WINDOW_SELECT = {
  select: { titleAr: true, registrationOpensAt: true, registrationClosesAt: true },
} as const

/* ═══════════ بابُ الموسم: قفلٌ فوق القفلَين ═══════════

   قرارُ صاحب المنصّة (١٨ سبتمبر ٢٠٢٦): «أوقف أيَّ عمليّة تسجيلٍ الآن، ومن
   ينقر الدفعَ يُقال له إنّ بابَ التسجيل لموسم الشتاء لم يُفتح بعد، ويُطلَب
   بريدُه لنُبلغه حين يُفتح».

   ─────────── ولمَ قفلٌ ثالثٌ وفوقُ قفلان ───────────

   وهذا السؤالُ يجب أن يُجاب لا أن يُمَرّ، فثلاثةُ أقفالٍ على بابٍ واحدٍ تُغري
   بالخلط. وكلٌّ منها يجيب سؤالا غيرَ سؤال أخيه:

   · `registrationOpen` — **أهذه الشعبةُ بعينها تقبل؟** قرارُ من يديرها.
   · نافذةُ الفصل — **أفي وقتها؟** تاريخان يُعلَنان ويُنتظران.
   · وهذا — **أالمنصّةُ كلُّها تبيع الآن؟** قرارٌ واحدٌ يعلو الاثنَين.

   ولو أُنزل هذا القرارُ إلى أحدهما لَاحتاج لمسَ **كلِّ** شعبةٍ أو **كلِّ**
   فصل: إغلاقُ التسجيل بإطفاء مئةِ علمٍ عمليّةٌ لا يُعرف بعدها ما كان مطفأً
   قبلها — ففتحُها ثانيةً يفتح ما لم يكن مفتوحا. والقرارُ الواحدُ يُرفع
   بنقرةٍ واحدةٍ ولا يدهس تحته شيئا.

   ─────────── وصفٌّ في القاعدة لا ثابتٌ في الشيفرة ───────────

   يومَ يُفتح البابُ لا يُنتظَر بناءٌ ولا دمجٌ ولا نشرُ خادم: يُقلب الصفُّ من
   شاشة الفصول فيتبعه كلُّ ما يقرؤه. والثابتُ في الشيفرة كان يجعل «افتح
   غدا» طلبَ نشرٍ — وهو أبطأُ ما يكون حين يكون الموسمُ قد بدأ.

   ─────────── والافتراضُ «مفتوح» عند غياب الصفّ ───────────

   لا صفَّ يعني «لم يُقرَّر شيء»، ولا يصحّ أن يُغلَق بابُ منصّةٍ لأنّ قاعدةً
   جديدةً لم تُبذَر. والإغلاقُ الحاليُّ صفٌّ يكتبه الترحيلُ صراحةً — فعلٌ
   مقصودٌ مكتوب، لا صمتٌ يُؤوَّل. */

type Db = PrismaClient | Prisma.TransactionClient

/** مفتاحُ الصفّ في `SystemSetting` — يُقرأ في الخادم ويُكتب من شاشة الفصول */
export const SEASON_GATE_KEY = 'registration.season'

export interface SeasonGate {
  /** أتبيع المنصّةُ الآن؟ */
  open: boolean
  /** رمزُ الموسم المنتظَر — من `TRAINING_SEASONS` (`nov_jan` وأخواتُها) */
  seasonKey: string
  /** اسمُه كما يُقرأ: «موسم الشتاء» */
  seasonAr: string
  /** ما يُقال لمن نقر الدفعَ — يُكتب من الشاشة فلا يُنشَر خادمٌ لتغيير جملة */
  messageAr: string
}

/** ما يُفترَض حين لا صفَّ أصلا: البابُ مفتوحٌ كما كان قبل هذا القفل */
export const OPEN_SEASON: SeasonGate = { open: true, seasonKey: '', seasonAr: '', messageAr: '' }

/** جملةُ الردّ حين يُغلَق البابُ بلا نصٍّ مكتوب — ولا يُترك المشتري بلا سبب */
export const SEASON_CLOSED_FALLBACK_AR = 'لم يفتح باب التسجيل بعد'

/** يقرأ الصفَّ كما هو ويردّه إلى شكلٍ موثوق — والمشوَّهُ لا يُغلق بابا.

    فقيمةٌ عطبتْ يدُ محرِّرٍ في JSON لا يصحّ أن تُوقف بيعَ منصّةٍ صامتةً: ما
    لا يقول `open: false` صراحةً يُقرأ مفتوحا. */
export function parseSeasonGate(value: unknown): SeasonGate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return OPEN_SEASON
  const v = value as Record<string, unknown>
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string).trim() : '')
  const seasonKey = str('seasonKey')
  const seasonAr = str('seasonAr')
  /* الموسمُ يبقى مكتوبا بعد الفتح، ولا يُمحى بفتحه.

     ولولا ذلك لَضاع **لأيّ موسمٍ ينتظر المنتظرون** في اللحظة التي يُفتح فيها
     البابُ — وهي اللحظةُ التي يُبلَّغون فيها بعينها. فالفتحُ يُبدّل `open`
     وحدَه، والاسمُ يبقى حتّى يُبدَّل بموسمٍ آخر. */
  if (v.open !== false) return { open: true, seasonKey, seasonAr, messageAr: '' }
  return {
    open: false,
    seasonKey,
    seasonAr,
    messageAr: str('messageAr') || (seasonAr ? `لم يفتح باب التسجيل ل${seasonAr} بعد` : SEASON_CLOSED_FALLBACK_AR),
  }
}

/** حالةُ البابِ الآن — قراءةٌ واحدةٌ يبني عليها كلُّ مسارٍ يحرّك مالا */
export async function readSeasonGate(db: Db): Promise<SeasonGate> {
  const row = await db.systemSetting.findUnique({ where: { key: SEASON_GATE_KEY } })
  return parseSeasonGate(row?.value)
}

/** يكتب حالةَ الباب — ويعيد ما استقرّ عليه الصفُّ لا ما أُرسل */
export async function writeSeasonGate(db: Db, next: SeasonGate, actorId: string): Promise<SeasonGate> {
  const value = {
    open: next.open,
    seasonKey: next.seasonKey,
    seasonAr: next.seasonAr,
    /* والجملةُ تُحفظ مفتوحا كان البابُ أو مغلقا: من فتح ثمّ أغلق بعد شهرٍ
       يجد جملتَه كما كتبها، ولا يُعيد كتابتَها في كلّ مرّة. */
    messageAr: next.messageAr.trim() || (next.open ? '' : SEASON_CLOSED_FALLBACK_AR),
  }
  const row = await db.systemSetting.upsert({
    where: { key: SEASON_GATE_KEY },
    update: { value, updatedBy: actorId },
    create: { key: SEASON_GATE_KEY, value, updatedBy: actorId },
  })
  return parseSeasonGate(row.value)
}

/** يرمي إن كان البابُ مغلقا — والرسالةُ رسالةُ صاحب المنصّة لا رسالةُ نظام.

    ورمزُه `season_closed` لا `closed`: الثاني سببُ استبعادِ **شعبةٍ** تُعرض
    شارتُه في لوح الشراء («التسجيل مغلق»)، وهذا حالُ المنصّة كلِّها — ومن
    يخلط بينهما يعرض شارةَ شعبةٍ على قفلِ موسم. */
export function assertSeasonOpen(gate: SeasonGate): void {
  if (gate.open) return
  throw new AuthError('season_closed', gate.messageAr || SEASON_CLOSED_FALLBACK_AR, 409)
}
