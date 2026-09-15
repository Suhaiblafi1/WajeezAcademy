/* من أين تُقرأ أفعالُ الأثر — مالكٌ واحدٌ لمسحٍ يقرؤه حارسان.

   ═══ لمَ ملفٌّ مشترك ═══

   حارسُ الأسماء (`audit-labels-coverage`) وحارسُ الوصول
   (`audit-high-reaches-person`) يسألان السؤالَ نفسَه أوّلا: **ما الأفعالُ
   التي تكتبها الخدماتُ فعلا، وأين؟** ونسختان من هذا الجواب تنحرف إحداهما
   عن الأخرى بلا أن يقول ذلك أحد — وهو بعينه العطبُ الذي كتب هذا المسحَ
   أوّلَ مرّة: معجمٌ يُسأل من موضعٍ ويُجاب من موضعٍ آخر.

   ═══ ولمَ يُقرأ الفعلُ من نافذة `recordAudit` لا من كلّ `action:` ═══

   كان المسحُ يلتقط كلَّ `action: '…'` في `server/`. وهي صيغةٌ تكتبها أشياءُ
   ليست أثرا: `orderBy: { _count: { action: 'desc' } }` ترتيبُ استعلام،
   و`catalogVersionEvent` سجلُّ إصدارٍ آخر، و`action: 'approve' | 'reject'`
   وسمُ Zod لمُدخَل. **فحُشرت في المعجم أسماءٌ لأشياءَ لا وجودَ لها**:
   `'desc': 'تعديلُ وصف'` — واسمُها في الحقيقة اتّجاهُ فرزٍ في SQL. */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

/** كلُّ ملفّات `server/` عدا اختباراتِها — منها تُقرأ الأفعال */
export function serverFiles(): string[] {
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

/** ما يسع حمولةَ نداءِ `recordAudit` الواحد */
export const CALL_WINDOW = 420

/** نوافذُ نداءات `recordAudit` — ما بعد كلِّ نداءٍ بمقدارٍ يسع حمولتَه */
export function auditWindows(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/recordAudit\(/g)) {
    out.push(src.slice(m.index!, m.index! + CALL_WINDOW))
  }
  return out
}

/* ═══ وأفعالٌ تُبنى ولا تُكتب حرفا ═══

   منها ما يُركَّب بقالبٍ نصّيّ ومنها ما يُنتقى بشرط. والمسحُ الحرفيُّ أعمى
   عنهما — فمرّت **خمسةَ عشرَ فعلا بلا اسمٍ عربيّ** تُعرض مفاتيحَ لاتينيّةً
   في سجلٍّ عربيّ، ولم يحمرّ شيء. فتُسمَّى توسّعاتُ القوالب هنا صراحةً. */
export const DYNAMIC: Record<string, readonly string[]> = {
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
export const WRAPPED: Record<string, readonly string[]> = {
  'server/services/earnings.service.ts': [
    'trainer_payout.approve', 'trainer_payout.pay', 'trainer_payout.cancel',
  ],
}

/** موضعُ كتابةِ فعلٍ في الأثر — الملفُّ ومكانُ النداء فيه */
export interface AuditSite {
  action: string
  /** مسارٌ من جذر المستودع */
  file: string
  /** فهرسُ `recordAudit(` في نصّ الملفّ */
  at: number
}

/** كلُّ موضعٍ يُكتب فيه فعلُ أثر — حرفا كان أو قالبا أو شرطا أو غلافا */
export function auditSites(): AuditSite[] {
  const out: AuditSite[] = []
  for (const full of serverFiles()) {
    const file = full.slice(root.length + 1)
    const src = readFileSync(full, 'utf8')
    for (const m of src.matchAll(/recordAudit\(/g)) {
      const at = m.index!
      const w = src.slice(at, at + CALL_WINDOW)
      const push = (action: string) => out.push({ action, file, at })
      for (const x of w.matchAll(/action: '([a-z0-9._]+)'/g)) push(x[1])
      /* الشرطُ: فرعاه كلاهما فعلٌ يُكتب */
      for (const x of w.matchAll(/action: [^,\n]*?\?\s*'([a-z0-9._]+)'\s*:\s*'([a-z0-9._]+)'/g)) {
        push(x[1]); push(x[2])
      }
      for (const x of w.matchAll(/action: `([^`]+)`/g)) {
        const key = x[1].replace(/\$\{([^}]+)\}/g, '@$1@')
        for (const a of DYNAMIC[key] ?? []) push(a)
      }
      if (/action,/.test(w)) for (const a of WRAPPED[file] ?? []) push(a)
    }
  }
  return out
}

/** نصُّ ملفٍّ من موضعٍ مسجَّل */
export function sourceOf(file: string): string {
  return readFileSync(join(root, file), 'utf8')
}

/* ═══ حدودُ المعالِج — ولمَ ليست مسافةً بالحروف ═══

   «أيُخبَر صاحبُه؟» سؤالٌ عن **المعالِج** الذي كتب الأثر، لا عن جِوارٍ
   بالحروف ولا عن الملفّ كلِّه. وقد جُرّب الطرفان فكذبا:

   • الملفُّ كلُّه: `admin-users.routes.ts` يرسل دعوةَ حسابٍ جديدٍ في معالِجٍ
     أوّل، فيمرّ **إيقافُ الحساب** في معالِجٍ آخرَ خضراءَ وهو صامتٌ تماما.
   • الجِوارُ بالحروف: يقطع المعالِجَ الطويلَ نصفَين فيُحمّر ما ليس بعطب.

   والحدُّ هنا بنيويّ: أوّلُ طريقٍ (`app.post(`) أو دالّةٍ أو طريقةِ صفٍّ
   قبل الموضع، وأوّلُ ما بعده. */
const BOUNDARY = /\bapp\.(?:get|post|put|patch|delete)\(|^\s{2}(?:private\s+)?(?:async\s+)?[a-zA-Z_]\w*\s*\(|^export\s+(?:async\s+)?function\s+\w+\s*\(/gm

/* ═══ والغلافُ المحلّيُّ يُتبَع، ولا يُحكَم عليه باسمه ═══

   `cohort-plan.service.ts` يُخبر المدرّبَ بقرارِ خطّته جرسا وبريدا — في
   دالّةٍ اسمُها `tellTrainer`. وكان الحارسُ يقرأ **أسماءَ** المُرسِلين، فلم
   تطابق، فحُسب قرارُ الخطّة صامتا وهو أبلغُ ما يُرسَل.

   والعلاجُ الذي يُغري: أن يُعاد تسميتُها `notifyTrainer` فتطابق. وذلك بعينه
   ما يمنعه عرفُ المستودَع — اختراعُ اسمٍ ليَسكُت حارسٌ يقرأ الموضعَ الخطأ،
   كما اختُلق «تعديلُ وصف» اسما عربيّا لاتّجاه فرزٍ في SQL.

   فالحارسُ يُصلَح لا الشيفرة: يُتبَع النداءُ إلى تعريفه في الملفّ نفسِه،
   ودرجةً واحدةً فقط — فمن نادى غلافا يُرسل فقد أرسل. */
export function localCallees(src: string, segment: string): string[] {
  const names = new Set(
    [...segment.matchAll(/(?:this\.)?\b([a-zA-Z_]\w*)\s*\(/g)].map((m) => m[1]),
  )
  const bodies: string[] = []
  for (const name of names) {
    const decl = new RegExp(
      `^\\s{2}(?:private\\s+)?(?:async\\s+)?${name}\\s*\\(`
      + `|^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`
      + `|^(?:export\\s+)?const\\s+${name}\\s*=`,
      'm',
    )
    const hit = decl.exec(src)
    if (hit) bodies.push(handlerAround(src, hit.index + 1))
  }
  return bodies
}

/** جسمُ المعالِج الذي يحوي موضعا — من حدِّه إلى الحدِّ الذي يليه */
export function handlerAround(src: string, at: number): string {
  let start = 0
  let end = src.length
  for (const m of src.matchAll(BOUNDARY)) {
    const i = m.index!
    if (i <= at) start = Math.max(start, i)
    else { end = i; break }
  }
  return src.slice(start, end)
}
