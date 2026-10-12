/* ═══ شكلُ ملفّ التعديلات المقترحة — ما يُرفع على بطاقة المراجعة (٨ أكتوبر ٢٠٢٦) ═══

   الملفُّ يكتبه من يراجع الخطّة (والأوّلُ منه كُتب من تقارير المراجعة)، فشكلُه يُفحص
   هنا قبل أن يُقرأ: نوعٌ مخترَعٌ أو حقلٌ زائدٌ يُردّ باسمه، لا يُحفظ فيظهر للمدرّب
   بندا لا يقع. والحدودُ حدودُ حفظ المدرّب نفسِه (`plan-limits.ts` و`MAX_BODY_CHARS`)
   — فلا يُقترح عليه ما يردّه حفظُه. وما يُعرف من الخطّة (محورٌ قائم؟ مصدرٌ بعنوانه؟)
   يُفحص في الخدمة على الخطّة نفسِها.

   مثال:
   { "format": "wajeez.plan-edits/1", "planId": "…",
     "items": [
       { "kind": "resource_add", "required": true, "reasonAr": "المحور 3 بلا مصدر",
         "resource": { "title": "…", "url": "https://…", "moduleId": "C-…-M3", "noteAr": "…" } },
       { "kind": "module", "moduleId": "C-…-M6", "reasonAr": "…", "set": { "artifactAr": "…" } } ] } */

import { z } from 'zod'
import { MAX_BODY_CHARS } from '../services/module-authoring.service'
import { PLAN_MAX, PLAN_TITLE_MIN } from '../../src/application/trainer/plan-limits'
import { RESOURCE_CATEGORIES, RESOURCE_KINDS } from '../../src/application/trainer/plan-overlay'
import { PLAN_EDITS_MAX } from '../../src/application/trainer/plan-edits'

const text = (max: number) => z.string().max(max).nullable()
const moduleId = z.string().trim().min(1).max(64)
const instant = z.string().datetime({ offset: true })

const meta = {
  required: z.boolean().optional(),
  reasonAr: z.string().trim().min(2).max(1000),
}

const resource = z.object({
  title: z.string().trim().min(PLAN_TITLE_MIN).max(PLAN_MAX.resourceTitle),
  url: z.string().trim().max(PLAN_MAX.resourceUrl).nullish(),
  kind: z.enum(RESOURCE_KINDS).nullish(),
  category: z.enum(RESOURCE_CATEGORIES).nullish(),
  noteAr: z.string().max(500).nullish(),
  moduleId: moduleId.nullish(),
  preReading: z.boolean().nullish(),
}).strict()

const match = z.object({
  title: z.string().trim().min(1).max(PLAN_MAX.resourceTitle),
  url: z.string().trim().max(PLAN_MAX.resourceUrl).nullish(),
  moduleId: moduleId.nullish(),
}).strict()

const task = z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(['assignment', 'quiz', 'project']),
  moduleId: moduleId.nullish(),
  briefAr: z.string().max(4000).nullish(),
  maxScore: z.number().int().min(1).nullish(),
  dueAt: instant.nullish(),
}).strict()

const nonEmpty = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict().refine((o) => Object.keys(o).length > 0, { message: 'لا حقل يعدّل' })

export const planEditItem = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('module'), moduleId, ...meta,
    set: nonEmpty({
      titleAr: z.string().trim().min(PLAN_TITLE_MIN).max(PLAN_MAX.moduleTitle).optional(),
      outcomeAr: text(PLAN_MAX.outcomeAr).optional(),
      activityAr: text(PLAN_MAX.activityAr).optional(),
      artifactAr: text(PLAN_MAX.artifactAr).optional(),
      bodyAr: text(MAX_BODY_CHARS).optional(),
    }),
  }).strict(),
  z.object({
    kind: z.literal('plan'), ...meta,
    set: nonEmpty({ summaryAr: text(PLAN_MAX.summaryAr).optional(), liveNoteAr: text(2000).optional() }),
  }).strict(),
  z.object({ kind: z.literal('resource_add'), ...meta, resource }).strict(),
  z.object({
    kind: z.literal('resource_change'), ...meta, match,
    set: nonEmpty({
      title: z.string().trim().min(PLAN_TITLE_MIN).max(PLAN_MAX.resourceTitle).optional(),
      url: z.string().trim().max(PLAN_MAX.resourceUrl).nullable().optional(),
      kind: z.enum(RESOURCE_KINDS).optional(),
      category: z.enum(RESOURCE_CATEGORIES).optional(),
      noteAr: z.string().max(500).nullable().optional(),
      moduleId: moduleId.nullable().optional(),
      preReading: z.boolean().optional(),
    }),
  }).strict(),
  z.object({ kind: z.literal('resource_remove'), ...meta, match }).strict(),
  z.object({ kind: z.literal('task_add'), ...meta, task }).strict(),
  z.object({
    kind: z.literal('task_change'), assessmentId: z.string().uuid(), ...meta,
    set: nonEmpty({
      title: z.string().trim().min(3).max(200).optional(),
      type: z.enum(['assignment', 'quiz', 'project']).optional(),
      briefAr: z.string().max(4000).nullable().optional(),
      dueAt: instant.nullable().optional(),
      moduleId: moduleId.nullable().optional(),
      maxScore: z.number().int().min(1).optional(),
    }),
  }).strict(),
  z.object({ kind: z.literal('session_move'), sessionId: z.string().uuid(), startsAt: instant, endsAt: instant, ...meta }).strict(),
  z.object({ kind: z.literal('session_remove'), sessionId: z.string().uuid(), ...meta }).strict(),
  /* وما كان يُطلب من المدرّب أن يعمله بنفسه — بطاقاتٌ «قبل/بعد» (١٢ أكتوبر ٢٠٢٦، `plan-edits.ts`) */
  z.object({ kind: z.literal('cohort_title'), titleAr: z.string().trim().min(3).max(200), ...meta }).strict(),
  z.object({ kind: z.literal('task_remove'), assessmentId: z.string().uuid(), ...meta }).strict(),
  z.object({
    kind: z.literal('session_add'), ...meta,
    session: z.object({
      title: z.string().trim().min(2).max(200),
      startsAt: instant, endsAt: instant,
      moduleIds: z.array(moduleId).max(8).nullish(),
      noteAr: z.string().max(2000).nullish(),
    }).strict(),
  }).strict(),
  z.object({
    kind: z.literal('session_change'), sessionId: z.string().uuid(), ...meta,
    set: nonEmpty({
      title: z.string().trim().min(2).max(200).optional(),
      noteAr: z.string().max(2000).nullable().optional(),
    }),
  }).strict(),
  /* وجدولٌ كاملٌ بسلسلته (١١ أكتوبر ٢٠٢٦): لقاءاتٌ تُنقل معا ومواعيدُ المهامّ التي تتبعها — يُقبل كلُّه أو يُرفض */
  z.object({
    kind: z.literal('schedule'), ...meta,
    weekday: z.number().int().min(0).max(6),
    clock: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    moves: z.array(z.object({ sessionId: z.string().uuid(), startsAt: instant, endsAt: instant }).strict()).min(1).max(40),
    tasks: z.array(z.object({ assessmentId: z.string().uuid(), dueAt: instant }).strict()).max(40),
  }).strict(),
])

export const planEditsFile = z.object({
  format: z.literal('wajeez.plan-edits/1').optional(),
  planId: z.string().uuid().optional(),
  /** للقارئ وحدَه — اسمُ الدورة والمدرّب، لا يُقرأ */
  titleAr: z.string().max(300).optional(),
  items: z.array(planEditItem).min(1).max(PLAN_EDITS_MAX),
}).strict()
