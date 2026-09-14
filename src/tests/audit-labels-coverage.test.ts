/* معجمُ أسماء الأثر يغطّي كلَّ فعلٍ في الخادم — في المسار السريع.

   ── لماذا هنا، وقد كان في `server/tests/audit/entity-timeline.test.ts` ──

   هذا الفحصُ **نصّيٌّ محض**: يقرأ ملفّاتِ `server/` ويطابق ما فيها بالمعجم.
   لا قاعدةَ بيانات، ولا خادما، ولا بذرَ أدوار. زمنُه أجزاءٌ من الثانية.

   وكان ساكنا في ملفٍّ يُقلع Postgres ويبذر الصلاحيّات ويستورد الكتالوج ويبني
   التطبيق (`beforeAll` بمهلة ٢٤٠ ثانية)، داخل حزمةٍ زمنُها ٧٢٠ ثانية. فصار
   فحصٌ يُقاس بالملّيثانية محبوسا خلف بوّابةٍ من اثنتي عشرة دقيقة.

   وأثرُ ذلك مقيسٌ لا متوقَّع: في ٦ سبتمبر أُضيف الفعلُ `auth.founder.promoted`
   بلا اسمٍ عربيّ. شُغّلت `server/tests/auth` — ولم تُشغَّل `server/tests/audit`
   لأنّ ثمنَها اثنتا عشرة دقيقة. فوصل الخطأُ إلى `main` واحمرّت البوّابةُ
   ثلاثَ دفعاتٍ متتالية.

   **والدرسُ أنّ حارسا لا يُشغَّل ليس حارسا.** فما لا يحتاج قاعدةً يُنقل إلى
   حيث يُشغَّل في كلّ تغيير — والمسارُ السريع (`src/`) زمنُه خمسٌ وعشرون ثانية.

   ولا يبقى منه أثرٌ هناك: حارسان على قاعدةٍ واحدةٍ يتنازعان، فحُدَّ بملفّه. */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditActionAr, entityTypeAr } from '@/application/audit/labels'
import { auditWeightOf } from '@/application/audit/weight'
import { NOTIFICATION_CATEGORIES } from '@/application/notifications/categories'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** كلُّ ملفّات `server/` عدا اختباراتِها — منها تُقرأ الأفعال */
function serverFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name !== 'tests' && name !== 'node_modules') walk(full)
      } else if (name.endsWith('.ts')) out.push(full)
    }
  }
  walk(join(root, 'server'))
  return out
}

/* ═══ ولمَ يُقرأ الفعلُ من موضع `recordAudit` لا من كلّ `action:` ═══

   كان المسحُ يلتقط كلَّ `action: '…'` في `server/`. وهي صيغةٌ تكتبها أشياءُ
   ليست أثرا: `orderBy: { _count: { action: 'desc' } }` ترتيبُ استعلام،
   و`catalogVersionEvent` سجلُّ إصدارٍ آخر، و`action: 'approve' | 'reject'`
   وسمُ Zod لمُدخَل.

   **فحُشرت في المعجم أسماءٌ لأشياءَ لا وجودَ لها**: `'desc': 'تعديلُ وصف'` —
   واسمُها في الحقيقة اتّجاهُ فرزٍ في SQL. اختُلقت عبارةٌ عربيّةٌ لتُسكِت
   حارسا يقرأ الموضعَ الخطأ. وذلك أسوأُ من ثغرة: معجمٌ يكذب.

   فصار المسحُ على نافذةِ نداءِ `recordAudit` وحدَها. */
const CALL_WINDOW = 420

/** نوافذُ نداءات `recordAudit` — ما بعد كلِّ نداءٍ بمقدارٍ يسع حمولتَه */
function auditWindows(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/recordAudit\(/g)) {
    out.push(src.slice(m.index!, m.index! + CALL_WINDOW))
  }
  return out
}

/* ═══ وأفعالٌ تُبنى ولا تُكتب حرفا ═══

   منها ما يُركَّب بقالبٍ نصّيّ (`action: \`submission.${'${action}'}\``) ومنها ما
   يُنتقى بشرط (`action: ok ? 'a' : 'b'`). والمسحُ الحرفيُّ أعمى عنهما —
   فمرّت **خمسةَ عشرَ فعلا بلا اسمٍ عربيّ** تُعرض مفاتيحَ لاتينيّةً في سجلٍّ
   عربيّ، ولم يحمرّ شيء.

   والقوالبُ تُسمَّى توسّعاتُها هنا صراحةً — على مثال
   `notification-category-coverage.test.ts`، وهو الحارسُ الذي حلّ هذه
   المسألةَ قبلنا. فمن أضاف قالبا جديدا تحمرّ عنده البوّابةُ وتقول له ماذا
   يكتب، ولا يمرّ صامتا. */
const DYNAMIC: Record<string, readonly string[]> = {
  'session.reschedule.@input.action@': ['session.reschedule.approve', 'session.reschedule.reject'],
  'submission.@action@': [
    'submission.start_review', 'submission.request_resubmit',
    'submission.accept', 'submission.reject',
  ],
  /* `advisor-request.service.ts:165` — «approved» لا «approve» */
  'advisor.request.@decision@': ['advisor.request.approved', 'advisor.request.rejected'],
  /* `learner-request.service.ts:247` */
  'learner.request.@status@': [
    'learner.request.in_review', 'learner.request.fulfilled', 'learner.request.declined',
  ],
  /* `cohort.service.ts:1284` */
  'content.@status@': ['content.active', 'content.archived', 'content.disabled'],
  /* `admin-users.routes.ts:124` */
  'admin.permission.@body.effect@': [
    'admin.permission.grant', 'admin.permission.deny', 'admin.permission.clear',
  ],
  /* مفاتيحُ وظائف العامل الثمانية — `worker/jobs.ts` */
  'worker.@key@': [
    'worker.calendly_interview_sync', 'worker.cleanup_expired', 'worker.cohort_status_sync',
    'worker.dispatch_notifications', 'worker.enforce_retention', 'worker.publish_scheduled_changes',
    'worker.reclaim_abandoned_orders', 'worker.session_reminders',
  ],
}

/* ما يمرّ عبر غلافٍ فيصل `action` متغيّرا — تُسمَّى قيمُه حيث تُكتب.
   والغلافُ يُحرَس بوجوده: لو زال ولم تزل القائمةُ حمِرَت. */
const WRAPPED: Record<string, readonly string[]> = {
  'server/services/earnings.service.ts': [
    'trainer_payout.approve', 'trainer_payout.pay', 'trainer_payout.cancel',
  ],
}

describe('معجمُ الأثر يغطّي ما تكتبه الخدمات', () => {
  /** كلُّ فعلٍ يُكتب في الأثر فعلا — حرفا كان أو قالبا أو شرطا */
  const collect = () => {
    const actions = new Set<string>()
    const templates = new Set<string>()
    for (const f of serverFiles()) {
      for (const w of auditWindows(readFileSync(f, 'utf8'))) {
        for (const m of w.matchAll(/action: '([a-z0-9._]+)'/g)) actions.add(m[1])
        /* الشرطُ: فرعاه كلاهما فعلٌ يُكتب */
        for (const m of w.matchAll(/action: [^,\n]*?\?\s*'([a-z0-9._]+)'\s*:\s*'([a-z0-9._]+)'/g)) {
          actions.add(m[1]); actions.add(m[2])
        }
        for (const m of w.matchAll(/action: `([^`]+)`/g)) {
          templates.add(m[1].replace(/\$\{([^}]+)\}/g, '@$1@'))
        }
      }
    }
    for (const [, keys] of Object.entries(WRAPPED)) for (const k of keys) actions.add(k)
    for (const t of templates) for (const k of DYNAMIC[t] ?? []) actions.add(k)
    return { actions, templates }
  }

  it('المسحُ يقرأ فعلا — وإلّا كان الحارسُ يخضرّ على فراغ', () => {
    const { actions } = collect()
    expect(actions.size, 'لم يُقرأ أيُّ فعلٍ من الشيفرة — تعطّل المسحُ نفسُه').toBeGreaterThan(100)
  })

  it('وكلُّ قالبٍ مبنيٍّ تُسمَّى توسّعاتُه — فلا يمرّ فعلٌ بلا اسم', () => {
    const { templates } = collect()
    const unnamed = [...templates].filter((t) => !DYNAMIC[t])
    expect(
      unnamed,
      `قوالبُ أفعالٍ بلا توسّعاتٍ مسمّاة: ${unnamed.join('، ')} — اكتبها في \`DYNAMIC\``,
    ).toEqual([])
    /* ولا اسمَ ميّتٍ يوسّع الثغرة: قالبٌ زال وبقي في القائمة */
    const stale = Object.keys(DYNAMIC).filter((t) => !templates.has(t))
    expect(stale, `قوالبُ في \`DYNAMIC\` لا وجودَ لها في الشيفرة: ${stale.join('، ')}`).toEqual([])
  })

  it('والغلافُ الذي يمرّر الفعلَ متغيّرا ما زال قائما', () => {
    for (const f of Object.keys(WRAPPED)) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(src, `${f} لم يعد يمرّر فعلا متغيّرا — راجِع \`WRAPPED\``).toMatch(/recordAudit\([\s\S]{0,200}?\baction,/)
    }
  })

  it('كلُّ فعلٍ في شيفرة الخادم له اسمٌ عربيّ', () => {
    /* سجلُّ الأثر يُعرض لصاحب المنصّة في `/admin/audit`. ومفتاحٌ لاتينيٌّ فيه
       يجعله سجلَّ مبرمجٍ لا سجلَّ عمل — وهو عطبٌ لا يُحمّر شيئا: الصفحةُ
       تعمل، والفعلُ يُكتب، ولا يفهمه قارئُه. */
    const { actions } = collect()
    const untranslated = [...actions].filter((a) => auditActionAr(a) === a)
    expect(untranslated, `أفعالٌ بلا اسمٍ عربيّ: ${untranslated.join(', ')}`).toEqual([])
  })

  /* ═══ ولكلِّ فعلٍ وزنُه — ي-١ ═══

     القائمةُ إلى جانب المعجم تُنسى: يُضاف الفعلُ الحادي والأربعون بعد
     المئتين **فلا يُرسل لأحد**، ولا شيءَ يُنبّه. فالوزنُ صفةٌ في الفعل،
     وهذا الحارسُ يقرأ الأفعالَ من الشيفرة نفسِها — **بالمِسحة نفسِها التي
     يقرأ بها الأسماء**، فلا يكون لـ«ما الأفعالُ القائمة؟» صاحبان. */
  it('ولكلِّ فعلٍ وزنٌ مُعلَن — فلا يُضاف فعلٌ لا يعرف أحدٌ أيصل صاحبَه أم لا', () => {
    const { actions } = collect()
    const unweighted = [...actions].filter((a) => auditWeightOf(a) === null)
    expect(
      unweighted,
      `أفعالٌ بلا وزن: ${unweighted.join('، ')} — صنِّفها في `
      + '`src/application/audit/weight.ts`: `high` لما يمسّ وصولَه أو مالَه أو سجلَّه، '
      + '`medium` لما يُرسَل ويحترم تفضيلاتِه، و`low` لما يغيّر النظامَ لا الإنسان.',
    ).toEqual([])
  })

  /* ═══ ولا وزنٌ يناقض ما قرّرته المنصّةُ قبله ═══

     `medium` معناه «يُرسَل ويحترم تفضيلاتِه». وفي الإشعارات أصنافٌ
     `silenceable: false` — لا يملك صاحبُها كتمَها، ولكلٍّ سببٌ مكتوب.

     فلو وُزن فعلٌ من صنفٍ لا يُكتم بـ`medium` لَشُحن تناقض: طبقةٌ تقول
     «اكتمه إن شئت» وأخرى تقول «لا تملك ذلك». وقد وقع فعلا في أوّل صياغةِ
     الأوزان — صُنّف التصحيحُ وعملُ الموظّف متوسّطَين، وكلاهما لا يُكتم. */
  it('وما لا يملك صاحبُه كتمَه لا يُوزن متوسّطا', () => {
    const { actions } = collect()
    const locked = new Set(
      NOTIFICATION_CATEGORIES.filter((c) => !c.silenceable).flatMap((c) => c.templateKeys),
    )
    const clash = [...actions].filter((a) => locked.has(a) && auditWeightOf(a) === 'medium')
    expect(
      clash,
      `أفعالٌ صنفُها لا يُكتم ووزنُها متوسّط: ${clash.join('، ')} — ارفعها إلى \`high\``,
    ).toEqual([])
  })

  it('وكلُّ نوعِ كيانٍ كذلك', () => {
    for (const t of ['user', 'cohort', 'enrollment', 'refund', 'trainer_application', 'support_ticket']) {
      expect(entityTypeAr(t), t).not.toBe(t)
    }
  })
})
