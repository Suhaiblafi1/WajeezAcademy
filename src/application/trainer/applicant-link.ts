/* روابطُ المتقدّم — تُقبل كما يكتبها الناسُ، وتُردّ إن كانت فخّا.

   ═══ ما طُلب (٢١ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة: «اسمح للمتقدّم أن يضع الرابطَ بدون `https://` — ضعها
   أنت بنفسك، أو أبلِغه ما الخطأ إذا لم يضعها».

   وهو حقٌّ: من ينسخ حسابَه من شريط العنوان يأتي بـ`linkedin.com/in/x`،
   ومن يكتبه بيده يكتب `www.google.com`. وكان الحاجزُ `z.string().url()`
   يردُّ الاثنين بجملةٍ إنجليزيّةٍ عامّة.

   ═══ وما وُجد تحته ═══

   `z.string().url()` يقبل **كلَّ** ما يقبله `new URL()` — ومنه:

     javascript:alert(1)
     data:text/html,<script>…</script>

   وهذه تُكتب في `href` في ملفّ المتقدّم عند المراجع (`ApplicationDossier`)،
   والنموذجُ يقول للمتقدّم إنّ روابطَه «ما يقرؤه المراجع قبل غيره». فمن وضع
   فيها سطرا نُفِّذ في جلسة من يقرؤه — وهو أوّلُ ما يُنقَر بحكم التصميم.

   فالبابُ يُضيَّق إلى `http` و`https` وحدَهما: ما عداهما لا يكون رابطَ ملفٍّ
   ولا قناةٍ ولا حساب، وإنّما يكون شيئا آخر.

   ═══ وثلاثةٌ تُردّ ولا تُصحَّح ═══

   ① **مخطَّطٌ غيرُ مألوف** — لا يُخمَّن مرادُه: من كتب `javascript:` لم ينسَ
      «https» ليست عنده. فيُقال له ما لا يُقبل، ولا يُبدَّل قولُه.
   ② **اسمُ مستخدمٍ في الرابط** (`https://a:b@evil.com`) — صورتُه تُقرأ
      `a` والوجهةُ `evil.com`. وهي حيلةُ تصيّدٍ معروفة، ولا حاجةَ بها في
      رابط حسابٍ أو قناة.
   ③ **بلا نقطةٍ في المضيف** — `https://linkedin` ليس عنوانا يُفتح. */

export type LinkCheck =
  | { ok: true; url: string }
  | { ok: false; messageAr: string }

/** ما يُقبل — ولا ثالثَ لهما في رابطٍ يُنقر */
const ALLOWED_PROTOCOLS = ['http:', 'https:']

/** أثمّة مخطَّطٌ مكتوبٌ في أوّله؟ — `scheme:` بحروفٍ وأرقامٍ لا غير */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * يُطبّع رابطَ متقدّمٍ، أو يقول لماذا لا يصحّ.
 *
 * والفارغُ يمرّ فارغا: الحقولُ اختياريّةٌ في نفسها، والاشتراطُ على مجموعها
 * («رابطٌ واحدٌ على الأقلّ») حكمٌ آخرُ في موضعٍ آخر.
 */
export function normalizeApplicantLink(input: string): LinkCheck {
  const raw = input.trim()
  if (!raw) return { ok: true, url: '' }

  if (/\s/.test(raw)) {
    return { ok: false, messageAr: 'الرابطُ يحوي فراغا — انسخه كاملا من شريط العنوان.' }
  }

  /* ═══ المخطَّطُ: يُقرأ إن كُتب، ويُضاف إن لم يُكتب ═══

     و«Https://» بحرفٍ كبير: `new URL` تُطبّعه من نفسها، فلا يُردّ من كتبه
     كذلك — وقد وقع فعلا في نموذجٍ مُرسَل. */
  let candidate: string
  if (HAS_SCHEME.test(raw)) {
    candidate = raw
  } else {
    /* `//host` تعني «مخطَّطُ الصفحة» في المتصفّح، ولا معنى لها هنا */
    candidate = `https://${raw.replace(/^\/+/, '')}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, messageAr: 'هذا ليس رابطا صالحا — مثالُه: linkedin.com/in/اسمك' }
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return {
      ok: false,
      messageAr: `لا يُقبل «${url.protocol}» — الرابطُ يبدأ بـhttps:// أو بلا شيءٍ أصلا.`,
    }
  }

  if (url.username || url.password) {
    return {
      ok: false,
      messageAr: 'الرابطُ يحوي اسمَ مستخدمٍ قبل الموقع — انسخ عنوانَ صفحتك كما يظهر في المتصفّح.',
    }
  }

  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) {
    return { ok: false, messageAr: 'اسمُ الموقع ناقص — مثالُه: linkedin.com/in/اسمك' }
  }

  return { ok: true, url: url.toString() }
}

/** أصالحٌ هو؟ — للحرّاس التي لا تحتاج النصَّ المطبَّع */
export function isValidApplicantLink(input: string): boolean {
  return normalizeApplicantLink(input).ok
}
