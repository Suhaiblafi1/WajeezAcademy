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

import type { Prisma } from '@prisma/client'

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
      reasonAr: `التسجيل في ${term.titleAr} يبدأ ${term.registrationOpensAt.toLocaleDateString('ar-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' })}`,
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
