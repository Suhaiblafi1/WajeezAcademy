/* هويّةُ الرسالة وروابطُها — حارسُ شكوى ١٧ سبتمبر ٢٠٢٦.

   قال صاحبُ المنصّة عن الرسائل الخارجة: «أشعر أنّها تفقد هويّتنا كأكاديمية
   وجيز، والروابطُ فيها مفتوحةٌ بدل هايبرلينك في كلمة، وأيضا عدمُ وجود
   اللوقو الخاصّ فينا».

   وثلاثةُ هذه شيءٌ واحدٌ في الجذر: **الرسالةُ تُقرأ قبل أن تُقرأ**. عينُ
   القارئ تأخذ الترويسةَ والشكلَ في جزءٍ من ثانيةٍ فتحكم: أهذه من جهةٍ
   يعرفها أم من مُرسِلٍ مجهول؟ وعنوانٌ خامٌّ من ثمانين محرفا في وسط الجملة
   يقول «آليٌّ مشبوه» قبل أن يُقرأ حرفٌ من متنها.

   ═══ ولماذا تُفحص المخرجاتُ لا الملفّ ═══

   حارسٌ يطابق نصّا في القالب يخضرّ على تعليقٍ ذكر الكلمة (وقد وقع ذلك في
   هذه المنصّة ثلاثَ مرّات). فالفحصُ هنا على **الرسالة المصيَّرة**: يُبنى
   وصفٌ فيه ما يُختبَر، ثمّ يُقرأ الخارجُ منه — ترميزا ونصّا خامّا.

   ═══ والنصُّ الخامُّ ليس نسخةً ناقصة ═══

   أكثرُ الشروط هنا «لا يُكتب العنوانُ في المتن»، وهذا في الـHTML وحدَه:
   في النصّ الخامّ لا زرَّ يُضغط ولا كلمةَ تحمل رابطا، فالعنوانُ المكتوبُ
   هناك هو الطريقُ الوحيد. فلكلِّ صيغةٍ شرطُها المعاكس، ويُفحصان معا حتّى
   لا يُصلَح أحدُهما بكسر الآخر. */

import { describe, expect, it } from 'vitest'
import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderMail } from '../../../server/services/mail-template'

/** رسالةٌ فيها زرٌّ برمزٍ طويل — وهي الحالةُ التي شُكي منها بعينها */
const VERIFY_LINK = 'https://wajeez.test/join-trainer/verify?ref=WJ-TR-2026-00019&token=MEB-dzgL-6tN-XSlH6XDtdlINq1AhvJnBbg8mOfAaIs'

const sample = () => renderMail({
  greetingName: 'سهيب',
  heading: 'وصلنا طلبك للانضمام',
  blocks: [
    { kind: 'p', text: 'وقبل أن نبدأ مراجعته نحتاج أن نتأكّد أنّ هذا البريد يصلك.' },
    { kind: 'cta', label: 'وثّق بريدك', href: VERIFY_LINK },
    { kind: 'list', items: [
      ['بالدخول إلى ', { text: 'صفحة الدخول', href: 'https://wajeez.test/auth' }, ' ببريدك هذا.'],
    ] },
    { kind: 'note', text: 'إن لم تكن أنت من قدّم الطلب فتجاهل هذه الرسالة.' },
  ],
})

/** ما يقرؤه الإنسانُ في الرسالة: الوسومُ تُنزَع ويبقى ما تحمله */
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ')

describe('هويّةُ الرسالة — علامةٌ تُرى قبل أن يُقرأ حرف', () => {
  it('⚠️ العلامةُ في الترويسة صورةً بعنوانٍ مطلق — لا اسمٌ مجرّدٌ في شريط', () => {
    const { html } = sample()
    const img = /<img[^>]*>/.exec(html)
    expect(img, 'لا صورةَ علامةٍ في الرسالة أصلا').not.toBeNull()
    expect(img![0], 'مصدرٌ غيرُ علامة وجيز').toMatch(/src="https?:\/\/[^"]+\/logo-mark\.png"/)
    /* ونسبيٌّ لا يعمل في بريد: لا أصلَ عند العميل يُبنى عليه */
    expect(img![0], 'مصدرٌ نسبيٌّ — لا يُحمَّل في عميل بريدٍ أصلا').not.toMatch(/src="\//)
  })

  it('⚠️ ومن حجب الصورَ يقرأ الاسمَ — فلا تصله رسالةٌ بلا هويّة', () => {
    /* الصورُ محجوبةٌ افتراضيّا في Gmail وOutlook. فلو كانت الهويّةُ صورةً
       وحدَها لوصلت أكثرُ الرسائل بلا هويّةٍ أصلا — وهو أسوأُ ممّا شُكي منه. */
    const { html } = sample()
    const img = /<img[^>]*>/.exec(html)![0]
    expect(img, 'صورةٌ بلا نصٍّ بديل').toMatch(/alt="[^"]*أكاديمية وجيز[^"]*"/)
    /* والاسمُ مكتوبٌ في الترويسة نصّا، لا في `alt` وحدَه */
    const header = html.slice(html.indexOf('<img'), html.indexOf('</table>', html.indexOf('<img')))
    expect(visibleText(header), 'الاسمُ في الصورة وحدَها').toContain('أكاديمية وجيز')
  })

  it('⚠️ ولونُ العلامة يصل قبل أيّ صورة — شريطٌ لا يُحجب', () => {
    /* أرضيّةٌ ملوّنةٌ في وسمٍ تصل حيث لا تصل الصور، فالهويّةُ لا تتعلّق
       بإذنٍ يعطيه القارئُ لصور المرسِلين.

       ولا يكفي أن يُبحَث عن اللون: `bgcolor` نفسُه على زرّ الدعوة، فحارسٌ
       يطلب اللونَ وحدَه يخضرّ وقد زال الشريطُ كلُّه — وقد وقع ذلك هنا
       فعلا لمّا كُتب. فالمطلوبُ **شريطٌ**: خليّةٌ ملوّنةٌ ارتفاعُها معلَنٌ
       رفيع، وموضعُها قبل متن الرسالة. */
    const { html } = sample()
    const stripe = /<td bgcolor="#12343B"[^>]*style="height:(\d+)px;/.exec(html)
    expect(stripe, 'لا شريطَ لونٍ فوق البطاقة').not.toBeNull()
    expect(Number(stripe![1]), 'كتلةٌ لا شريط').toBeLessThanOrEqual(8)
    expect(stripe!.index, 'الشريطُ تحت المتن لا فوقه').toBeLessThan(html.indexOf('<h1'))
  })
})

describe('روابطُ الرسالة — على كلماتٍ لا عناوينَ عاريةً في المتن', () => {
  it('⚠️ لا يُقرأ عنوانٌ خامٌّ في متن الرسالة — لا تحت الزرّ ولا في جملة', () => {
    /* وهذا هو الحارسُ الأصليُّ للشكوى: ما يراه الإنسانُ بعد نزع الوسوم. */
    const { html } = sample()
    expect(visibleText(html), 'عنوانٌ خامٌّ يُقرأ في متن الرسالة').not.toMatch(/https?:\/\//)
  })

  it('⚠️ والوجهةُ باقيةٌ في وسم الرابط — الكلمةُ تُضغط ولا تُزيَّن', () => {
    const { html } = sample()
    expect(html, 'ذهب العنوانُ مع النصّ المكتوب فصارت كلمةٌ لا تُضغط')
      .toContain(`href="${VERIFY_LINK.replace(/&/g, '&amp;')}"`)
    expect(html, 'لا مخرجَ لمن لم يعمل عنده الزرّ').toMatch(/لم يعمل الزرّ؟/)
  })

  it('⚠️ والرابطُ في وسط الجملة يخرج وسمَ رابطٍ على كلماته', () => {
    const { html } = sample()
    expect(html, 'كلمةٌ بلا رابط — فالنصُّ الغنيُّ لا يُصيَّر').toMatch(
      /<a href="https:\/\/wajeez\.test\/auth"[^>]*>صفحة الدخول<\/a>/,
    )
  })

  it('⚠️ والنصُّ الخامُّ يحمل العنوانَ كاملا — إذ لا كلمةَ تُضغط فيه', () => {
    /* ولولا هذا لكان «إخفاءُ العناوين» سلبا لطريق من قرأ بنصٍّ خامّ. */
    const { text } = sample()
    expect(text, 'ضاع رابطُ التوثيق على من يقرأ نصّا خامّا').toContain(VERIFY_LINK)
    expect(text, 'رابطُ الكلمةِ في الجملة لا عنوانَ له في النصّ الخامّ')
      .toContain('صفحة الدخول (https://wajeez.test/auth)')
  })

  it('وما جاء من بشرٍ يُهرَّب — في النصّ الغنيّ كما في المجرّد', () => {
    const { html } = renderMail({
      heading: 'عنوان',
      blocks: [{ kind: 'p', text: ['قال ', { text: '<script>alert(1)</script>', href: 'https://x.test/?a=1&b=2' }, ' ثمّ مضى'] }],
    })
    expect(html, 'وسمٌ من نصِّ مستخدمٍ دخل الرسالة').not.toContain('<script>')
    expect(html, 'عنوانٌ بلا تهريبٍ يكسر الوسمَ عند `&`').toContain('href="https://x.test/?a=1&amp;b=2"')
  })
})

/* ═══ والقاعدةُ تُحرَس عند مَن يكتب الرسائل لا عند القالب وحدَه ═══

   القالبُ لا يصنع عنوانا خامّا من نفسه: يصنعه قالبُ رسالةٍ يكتب
   `${site}/auth` داخلَ جملة. والحارسُ أعلاه يمسك ذلك لو صُيّرت تلك الرسالةُ
   هنا، ولا تُصيَّر: أكثرُها يحتاج قاعدةً وصفَّ إرسال.

   فيُقرأ المصدر: كلُّ كتلةِ نصٍّ في ملفّات الرسائل — `text:` أو `items:` —
   إن حملت عنوانا أو متغيّرَ عنوانٍ ولم يكن معها `href` فهي عنوانٌ عارٍ في
   جملة. */
describe('ولا يُكتب عنوانٌ خامٌّ في قوالب الرسائل', () => {
  const MAIL_FILES = [
    'server/services/account-mail.ts',
    'server/services/notification-mail.ts',
    'server/services/trainer-application.service.ts',
    'server/services/trainer-review.service.ts',
    'server/services/trainer-dossier-link.service.ts',
    'server/services/cohort-plan.service.ts',
    'server/services/trainer-dossier.service.ts',
  ]
  const code = (p: string) =>
    readFileSync(join(process.cwd(), p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⚠️ كلُّ عنوانٍ في نصِّ رسالةٍ محمولٌ على كلمة', () => {
    const offenders: string[] = []
    for (const f of MAIL_FILES) {
      const src = code(f)
      expect(src, `${f}: لم يُقرأ الملفّ — تحرّك اسمُه`).toContain('renderMail')
      for (const m of src.matchAll(/\b(text|items):\s*(`[^`]*`|\[[^\]]*\])/g)) {
        const body = m[2]
        const carriesUrl = /https?:\/\/|\$\{site\}|\$\{publicSiteUrl\(\)\}|Url\}/.test(body)
        if (carriesUrl && !body.includes('href')) offenders.push(`${f}: ${m[0].slice(0, 90)}`)
      }
    }
    expect(offenders, 'عنوانٌ خامٌّ في متن رسالة — يُحمَل على كلمة:\n' + offenders.join('\n')).toEqual([])
  })
})

/* ═══ وهيئةُ الرسالة لا تُتخطّى من باب خلفيّ ═══

   القالبُ يضمن الهويّةَ لمن مرّ عليه. ومن نادى `sendEmail` بـ`text` وحدَه
   خرجت رسالتُه عاريةً: بلا علامةٍ ولا ترويسةٍ ولا تذييل — وهو ما كان في
   بريد ملفّ المتقدّم وفي البريد التجريبيّ، ولم يمسكه شيء.

   والفحصُ بنيويّ: كلُّ نداءِ إرسالٍ يحمل `subject` هو رسالةٌ تُؤلَّف هنا،
   فيلزمها `html` أو نشرُ وصفٍ مصيَّرٍ (`...renderMail({…})` وأخواتها). */
describe('ولا تخرج رسالةٌ من خارج القالب', () => {
  const SENDERS = /\bsend(?:Direct)?Email\(/g

  /** نصُّ النداء كاملا — بعدِّ الأقواس، فلا يُقطع عند سطرٍ ولا يمتدّ إلى ما بعده */
  const callText = (src: string, from: number): string => {
    let depth = 0
    for (let i = from; i < src.length; i += 1) {
      if (src[i] === '(') depth += 1
      else if (src[i] === ')') {
        depth -= 1
        if (depth === 0) return src.slice(from, i + 1)
      }
    }
    return src.slice(from)
  }

  it('⚠️ كلُّ رسالةٍ تُؤلَّف في الخادم تخرج بترميزٍ لا بنصٍّ خامّ وحدَه', () => {
    const files = [
      ...globSync('server/services/**/*.ts'),
      ...globSync('server/http/routes/**/*.ts'),
      ...globSync('server/worker/**/*.ts'),
    ].filter((f) => !f.includes('/tests/'))
    expect(files.length, 'لم تُقرأ ملفّاتُ الخادم').toBeGreaterThan(20)

    const bare: string[] = []
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      for (const m of src.matchAll(SENDERS)) {
        const call = callText(src, m.index! + m[0].length - 1)
        /* ما لا `subject` فيه تمريرٌ لا تأليف: `sendEmail(config, input)` */
        if (!/\bsubject\s*:/.test(call)) continue
        if (/\bhtml\b/.test(call) || /\.\.\./.test(call)) continue
        bare.push(`${f}: ${call.slice(0, 70).replace(/\s+/g, ' ')}…`)
      }
    }
    expect(bare, 'رسالةٌ تخرج بلا هيئةٍ ولا علامة:\n' + bare.join('\n')).toEqual([])
  })
})
