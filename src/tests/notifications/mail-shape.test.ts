/* رسائلُ الإشعارات تخرج على القالب، وبزرٍّ يذهب إلى الخبر (ط-١).

   ═══ ما يُحرَس ═══

   ① **لا وجهةَ مخترَعة** — كلُّ مسارٍ في `destinations.ts` موجودٌ في
      `App.tsx`. وهذا ليس تنظيرا: في هذه الجلسة نفسِها كتبتُ ثلاثةَ مساراتٍ
      لا وجودَ لها (`/trainer/cohorts` و`/admin/orders` و`/student/courses`)
      ومررتُ عليها في فحصٍ يدويٍّ بلا أن يمسكها شيء. وزرٌّ في بريدٍ يفتح
      صفحةَ «غير موجود» أسوأُ من رسالةٍ بلا زرّ.
   ② **وكلُّ مفتاحٍ مسجَّلٍ له وجهةٌ أو عذر** — وإلّا خرج نصفُ التيّار بزرٍّ
      ونصفُه بلا زرّ بلا أن يقرّر ذلك أحد.
   ③ **والمزوّدُ يمرّ على القالب فعلا** — الفحصُ على `html` المسلَّمة إلى
      `sendEmail`، لا على ورودِ اسمِ الملفّ في السطور.
   ④ **ورابطُ التفضيلات على ما يُكتَم وحدَه** — ولمن يبلغ الشاشة. ومن لا
      يملك الكتمَ لا يُعرض له بابٌ إلى قفل.
   ⑤ **والجمهورُ يفرّق الوجهة** — `session.reminder` يصل الاثنين ولا تصلح
      وجهةٌ واحدةٌ لهما. */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  allDestinationPaths, destinationFor, type MailAudience,
} from '../../application/notifications/destinations'
import { NOTIFICATION_CATEGORIES, isSilenceable } from '../../application/notifications/categories'
import { notificationMailDoc, renderNotificationMail } from '../../../server/services/notification-mail'
import { renderMail } from '../../../server/services/mail-template'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const AUDIENCES: MailAudience[] = ['learner', 'trainer', 'staff']

/** مفاتيحُ بلا وجهةٍ بقصد — ومعها سببُها، فالخلوُّ قرارٌ لا سهو */
const NO_DESTINATION: Record<string, string> = {
  /* ي-٣ — خبرُ الحساب ووصولِه: من أُوقف أو أُرشف لا يفتح شيئا، ومن أُعيد
     يدخل من حيث يعرف. والبوّابةُ التي تخصّه تتبع دورَه لا مفتاحَ الرسالة،
     فزرٌّ إلى بوّابةٍ لا نعرف أيَّها بوّابتُه اختراعٌ — والقاعدةُ في
     `destinations.ts`: «وزرٌّ لا يُخترَع». */
  'account.suspended': 'حسابٌ موقوف — لا شاشةَ تُفتح له',
  'account.archived': 'حسابٌ مؤرشَف — لا شاشةَ تُفتح له',
  'account.reinstated': 'عاد وصولُه، وبوّابتُه تتبع دورَه لا هذا المفتاح',
  'account.unarchived': 'عاد وصولُه، وبوّابتُه تتبع دورَه لا هذا المفتاح',
  'account.roles_changed': 'الأدوارُ تفتح بوّاباتٍ شتّى — ولا واحدةَ منها وجهةُ الخبر',
  'account.permission_changed': 'الصلاحيّةُ تُبدّل ما يُفتح في بوّابته، ولا شاشةَ تعرضها له',
  /* ي-٤ — وخبرٌ عن شيءٍ زال: الوجهةُ يجب أن تحمل الخبر، وهذا لا تحمله
     شاشةٌ لأنّ موضوعَه لم يعد له صفٌّ يُعرض. */
  'order.cancelled_abandoned': 'الطلبُ أُلغي — ولا صفَّ له في «الفواتير» يُفتح',
  /* ═══ ي-٥ — ولمَ لا وجهةَ لتذكير التوثيق، وهو أحوجُ الرسائل إلى زرّ ═══

     لأنّ وجهتَه **ليست مسارا**: التوثيقُ يقع بـ`‎/auth/verify?token=…`، ورمزٌ
     لكلِّ إنسانٍ يُسَكّ عند الإرسال ويموت بعد ثمانٍ وأربعين ساعة. وجدولُ
     الوجهات يحمل مساراتٍ ثابتةً بحسب المفتاح والجمهور — فوضعُ الرمز فيه
     مستحيلٌ بنيةً، ووضعُ `‎/auth/verify` بلا رمزٍ زرٌّ يفتح صفحةَ خطأ.

     والزرُّ الحقيقيُّ في البريد نفسِه (`sendVerifyReminderEmail`) حيث الرمزُ
     في اليد. وهذا الصفُّ جرسٌ في المنصّة لمن يدخلها، وخبرُه تامٌّ بلا زرّ:
     «أرسلنا رابطا إلى بريدك». */
  'account.verify.reminder.1': 'الرمزُ في البريد لا في مسارٍ ثابت — والزرُّ هناك',
  'account.verify.reminder.2': 'الرمزُ في البريد لا في مسارٍ ثابت — والزرُّ هناك',
}

describe('ط-١ · رسالةُ الإشعار', () => {
  it('① لا وجهةَ مخترَعة — كلُّ مسارٍ موجودٌ في `App.tsx`', () => {
    const app = read('src/App.tsx')
    const real = new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]))
    expect(real.size, 'تعطّلت قراءةُ المسارات نفسُها').toBeGreaterThan(40)

    const invented = allDestinationPaths().filter((p) => !real.has(p))
    expect(
      invented,
      'وجهةُ بريدٍ لا مسارَ لها — يفتح الزرُّ صفحةَ «غير موجود»:\n' + invented.join('\n'),
    ).toEqual([])
  })

  it('② وكلُّ مفتاحٍ مسجَّلٍ له وجهةٌ لجمهورٍ ما — أو عذرٌ مكتوب', () => {
    const keys = NOTIFICATION_CATEGORIES.flatMap((c) => c.templateKeys)
    expect(keys.length, 'تعطّل سجلُّ الأصناف').toBeGreaterThan(20)

    const orphans = keys.filter((k) =>
      !AUDIENCES.some((a) => destinationFor(k, a)) && !(k in NO_DESTINATION))
    expect(
      orphans,
      'مفتاحٌ مسجَّلٌ بلا وجهةٍ لأيّ جمهور — تخرج رسالتُه بلا زرّ:\n' + orphans.join('\n'),
    ).toEqual([])
  })

  it('③ والمزوّدُ يسلّم `html` إلى `sendEmail` — لا نصّا خامّا', () => {
    const svc = code('server/services/notification.service.ts')
    const from = svc.indexOf('class ResendEmailProvider')
    const to = svc.indexOf('export type DirectMailStatus')
    /* ═══ وحدّا القصّ يُثبَت وجودُهما ═══

       الحدّان اسمان في ملفٍّ يتغيّر. فلو نُقل `DirectMailStatus` أو أُعيدت
       تسميةُ المزوّد، عادت `indexOf` بـ`-1` وصارت الشريحةُ فارغةً أو الملفَّ
       كلَّه — **ويخضرّ الحارسُ على فراغ**. فيُسأل عنهما أوّلا. */
    expect(from, 'لم يُعثر على `class ResendEmailProvider` — حدُّ القصّ زال').toBeGreaterThan(-1)
    expect(to, 'لم يُعثر على `export type DirectMailStatus` — حدُّ القصّ زال').toBeGreaterThan(from)
    const cls = svc.slice(from, to)
    expect(cls, 'المزوّدُ لا يمرّ على القالب').toContain('renderNotificationMail(')
    /* والفحصُ على ما يُسلَّم فعلا: `text, html` معا لا `text` وحدَه */
    expect(cls, 'يُرسل بلا `html` — وهو عينُ ما كان').toMatch(/sendEmail\(this\.config,\s*\{[^}]*html\s*\}/)
  })

  it('④ ورابطُ التفضيلات على ما يُكتَم وحدَه', () => {
    const prefs = /student\/notifications/
    /* يُكتَم: تذكيرُ جلسةٍ للمتعلّم */
    const silenceable = notificationMailDoc({
      title: 'تذكيرُ جلسة', body: 'جلستُك غدا', templateKey: 'session.reminder.24h',
      audience: 'learner', siteUrl: 'https://x.test',
    })
    expect(isSilenceable('session.reminder.24h')).toBe(true)
    expect(JSON.stringify(silenceable.blocks), 'لا بابَ إلى التفضيلات على ما يُكتَم').toMatch(prefs)

    /* ولا يُكتَم: إيصالُ دفع — فلا يُعرض له بابٌ يجده مقفلا */
    const locked = notificationMailDoc({
      title: 'وصل دفعُك', body: 'شكرا', templateKey: 'payment.succeeded',
      audience: 'learner', siteUrl: 'https://x.test',
    })
    expect(isSilenceable('payment.succeeded')).toBe(false)
    expect(JSON.stringify(locked.blocks), 'وُعِد بقفلٍ لا يملكه').not.toMatch(prefs)

    /* ولا يُوعَد به من لا يبلغ الشاشة: التفضيلاتُ في بوّابة المتعلّم وحدَها */
    const staff = notificationMailDoc({
      title: 'إعلان', body: 'خبر', templateKey: 'staff.announce',
      audience: 'staff', siteUrl: 'https://x.test',
    })
    expect(JSON.stringify(staff.blocks), 'أُحيل موظّفٌ إلى شاشةِ متعلّم').not.toMatch(prefs)
  })

  /* ═══ ط-٥ · والقالبُ لا يدسُّه من تحتُ ═══

     الشروطُ الثلاثةُ أعلاه كلُّها في `notificationMailDoc`، وانجرافٌ واحدٌ
     يتخطّاها جميعا: ذيلٌ يُضاف في `mail-template` نفسِه — «هيئةٌ واحدةٌ
     ترثها كلُّ رسالة»، فلمَ لا ذيلٌ واحد؟

     لأنّ «كلَّ رسالة» تشمل ما ليس من هذا التيّار: بريدَ استعادةِ كلمة المرور
     (ومن لا يستطيع الدخولَ لا تنفعه شاشةُ تفضيلات)، و**بريدَ المحو** الذي
     يقول بنصّه «وهذه آخرُ رسالةٍ تصلك منّا على هذا العنوان». ورابطُ
     تفضيلاتٍ تحت ذلك السطر يقرؤه صاحبُه سخريةً منه.

     فالدعوى على القالب: وصفٌ لم يطلب السطرَ لا يُصيَّر به — نصّا وترميزا. */
  it('④ب ووصفٌ لم يطلب رابطَ التفضيلات لا يُصيَّر به — فلا ذيلَ مشتركٌ يدسُّه', () => {
    const prefs = /student\/notifications/
    const bare = renderMail({
      heading: 'استعادةُ كلمة المرور',
      blocks: [
        { kind: 'p', text: 'اضغط الزرَّ لتعيين كلمةٍ جديدة.' },
        { kind: 'cta', label: 'عيّن كلمةً جديدة', href: 'https://x.test/auth/reset?token=t' },
      ],
    })
    expect(bare.html, 'القالبُ يدسّ رابطَ تفضيلاتٍ في كلِّ رسالةٍ تخرج').not.toMatch(prefs)
    expect(bare.text, 'القالبُ يدسّ رابطَ تفضيلاتٍ في النصّ الخامّ').not.toMatch(prefs)
  })

  it('⑤ والجمهورُ يفرّق الوجهة — لا يُرسَل مدرّبٌ إلى بوّابةِ متعلّم', () => {
    /* والجلسةُ الواحدةُ تُذكِّر الاثنين بمفتاحَين مختلفَين — وهو ما كشفه
       الحارسُ ②: كنتُ أعطي المدرّبَ مفتاحَ المتعلّم فلا يصله شيء. */
    const l = destinationFor('session.reminder.24h', 'learner')
    const t = destinationFor('session.reminder.trainer.24h', 'trainer')
    expect(l?.path, 'لا وجهةَ لتذكير المتعلّم').toMatch(/^\/student\//)
    expect(t?.path, 'لا وجهةَ لتذكير المدرّب').toMatch(/^\/trainer\//)
    expect(l?.path, 'وجهةٌ واحدةٌ لجمهورَين').not.toBe(t?.path)
    /* ولا يُعطى المدرّبُ مفتاحَ المتعلّم: سطرٌ ميّتٌ يوهم أنّ الأمرَ مغطّى */
    expect(destinationFor('session.reminder.24h', 'trainer'), 'مفتاحُ متعلّمٍ في جدول المدرّب').toBeNull()
  })

  it('والزرُّ يحمل العنوانَ المطلقَ لا المسارَ وحدَه', () => {
    const doc = notificationMailDoc({
      title: 'صدرت شهادتُك', body: 'مبارك', templateKey: 'certificate.issued',
      audience: 'learner', siteUrl: 'https://wajeez.test',
    })
    const cta = doc.blocks.find((b) => b.kind === 'cta')
    expect(cta, 'لا زرَّ على شهادةٍ صدرت').toBeTruthy()
    expect(cta && 'href' in cta ? cta.href : '').toBe('https://wajeez.test/student/certificates')
  })

  it('وما لا وجهةَ له يخرج بلا زرٍّ — لا بزرٍّ يفتح شاشةً لا خبرَ فيها', () => {
    const doc = notificationMailDoc({
      title: 'خبرٌ لا مفتاحَ له', body: 'متن', templateKey: 'مفتاح.لا.وجود.له',
      audience: 'learner', siteUrl: 'https://x.test',
    })
    expect(doc.blocks.some((b) => b.kind === 'cta'), 'اختُرعت وجهةٌ عند الجهل').toBe(false)
  })

  it('ومتنٌ بأسطرٍ يبقى فقراتٍ — لا كتلةً واحدةً ملتصقة', () => {
    const doc = notificationMailDoc({
      title: 'ت', body: 'الفقرةُ الأولى.\n\nوالفقرةُ الثانية.', audience: 'learner',
      siteUrl: 'https://x.test',
    })
    expect(doc.blocks.filter((b) => b.kind === 'p').length).toBe(2)
  })

  it('وسطرُ المعاينة يحمل الخبرَ لا التحيّة — فأنفعُ سطرٍ في الصندوق لا يُهدَر', () => {
    const { html } = renderNotificationMail({
      title: 'صدرت شهادتُك', body: 'أنهيتَ متطلّباتِ الدورة كاملةً.', templateKey: 'certificate.issued',
      audience: 'learner', siteUrl: 'https://x.test', greetingName: 'سامي',
    })
    const pre = html.slice(html.indexOf('display:none;max-height:0'), html.indexOf('<table role="presentation"'))
    expect(pre, 'لا سطرَ معاينةٍ أصلا').toContain('أنهيتَ متطلّباتِ الدورة')
    expect(pre, 'المعاينةُ تحيّةٌ لا خبر').not.toContain('مرحبا')
    /* ومخفيٌّ فعلا: `display:none` وحدَه لا يكفي في Outlook */
    expect(pre).toContain('mso-hide:all')
  })

  it('ورابطُ التفضيلات يُضغَط — لا عنوانٌ يُنسخ باليد', () => {
    const { html, text } = renderNotificationMail({
      title: 'تذكيرُ جلسة', body: 'غدا', templateKey: 'session.reminder.24h',
      audience: 'learner', siteUrl: 'https://x.test',
    })
    expect(html, 'العنوانُ نصٌّ لا رابط').toMatch(/<a href="https:\/\/x\.test\/student\/notifications"/)
    /* وفي النصّ الخامّ يبقى عنوانا مكتوبا — إذ لا ضغطَ فيه */
    expect(text).toContain('https://x.test/student/notifications')
  })

  it('ومتنٌ فارغٌ لا يُخرج رسالةً جوفاء', () => {
    const doc = notificationMailDoc({ title: 'عنوانٌ وحدَه', body: '   ', audience: 'learner', siteUrl: 'https://x.test' })
    expect(doc.blocks.filter((b) => b.kind === 'p').length).toBeGreaterThan(0)
  })
})
