/* روابطُ المتقدّم — يُقبل ما يُكتب كيفما كُتب، ويُضاف إليه ما نقص.

   ═══ ما طُلب (٢٢ سبتمبر ٢٠٢٦) ═══

   قال صاحبُ المنصّة، وأمامه نموذجٌ مملوءٌ بأربعة روابطَ تامّةٍ وتحته «بقي
   ١ بند»: «مازلت تعقّد أمرَ الأدلّة في طلب المدرّبين — أصلح الأمرَ ليقبل
   أيَّ نوع رابطٍ مهما كان».

   وكان هذا الملفُّ قبلَه يردُّ أربعةَ أشكالٍ بحجّة أنّها «لا تُفتح»: مضيفٌ
   بلا نقطة، وفراغٌ داخلَ الرابط، واسمُ مستخدمٍ قبل الموقع، وكلُّ مخطَّطٍ
   سوى http/https. وثلاثةٌ منها ردٌّ في غير موضعه: من كتب رابطَه أدرى به،
   والرابطُ الميّتُ يراه المراجعُ ويحكم — أمّا أن يُمنع المتقدّمُ من
   الإرسال أصلا فهو حاجزٌ لا فائدةَ منه.

   ═══ فصار الحكمُ اثنين لا غير ═══

   ① **مخطَّطٌ يُنفَّذ ولا يُفتح** — `javascript:` و`data:` و`vbscript:`
      و`file:`. وهذا وحدَه يبقى، وليس تضييقا: الرابطُ يُكتب في `href` في
      ملفّ المتقدّم عند المراجع (`ApplicationDossier`)، والنموذجُ يقول
      لكاتبه إنّ روابطَه «أوّلُ ما يقرؤه المراجع» — فما فيها يُنقَر بحكم
      التصميم. ومن كتب `javascript:` لم ينسَ «https» ليست عنده.
   ② **وما لا يُقرأ عنوانا أصلا** — `https://` وحدَها، أو جملةٌ فيها فراغٌ
      بلا مسار. وهذه يردُّها محلّلُ العناوين نفسُه، فلا حكمَ لنا فيها.

   وما عدا ذلك يمرّ: `linkedin` بلا نقطة، و`linkedin.com/in/ اسمي` بفراغه
   (يُرمَّز)، و`a@evil.com` (يُحذف اسمُ المستخدم فتنكشف وجهتُه).

   ═══ ويُعاد كما كُتب ═══

   `url.toString()` يُرقّم العربيّةَ (`%D9%88…`) ويُعجّم المضيفَ (`xn--`)،
   والمعادُ يُكتب في الحقل أمام صاحبه — فمن رأى ما كتبه مسخا ظنّ أنّه فسد.
   فالمعادُ نصُّه هو، ولا يُرقَّم إلّا إن حمل حرفا يُفسد اقتباسَه في صفحة. */

export type LinkCheck =
  | { ok: true; url: string }
  | { ok: false; messageAr: string }

/** ما يُنفَّذ في جلسة من يقرؤه — ولا يكون رابطَ صفحةٍ بحال */
const EXECUTABLE_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'filesystem:']

/** أثمّة مخطَّطٌ مكتوبٌ في أوّله؟ — `scheme:` بحروفٍ وأرقامٍ لا غير */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** ما يحذفه محلّلُ العناوين من نفسه — فلا يُردُّ رابطٌ لأجله */
const SILENTLY_DROPPED = /[\t\n\r]/g

/** ما يُفسد اقتباسَ الرابط في صفحةٍ أو يُرمَّز في العنوان — عندها يُرقَّم كلُّه */
const NEEDS_ENCODING = /["'<>`\s\\]/

/**
 * يُطبّع رابطَ متقدّمٍ، أو يقول لماذا لا يُقرأ رابطا.
 *
 * والفارغُ يمرّ فارغا: الحقولُ اختياريّةٌ في نفسها، والاشتراطُ على مجموعها
 * («رابطٌ واحدٌ على الأقلّ») حكمٌ آخرُ في موضعٍ آخر — `evidence-links.ts`.
 */
export function normalizeApplicantLink(input: string): LinkCheck {
  const raw = input.trim().replace(SILENTLY_DROPPED, '')
  if (!raw) return { ok: true, url: '' }

  /* المخطَّطُ يُقرأ إن كُتب، ويُضاف إن لم يُكتب. و«Https://» بحرفٍ كبير
     تُصغَّر لتُقرأ كما تُقرأ أختُها — وقد وقعت فعلا في نموذجٍ مُرسَل. */
  const candidate = HAS_SCHEME.test(raw)
    ? raw.replace(HAS_SCHEME, (s) => s.toLowerCase())
    /* `//host` تعني «مخطَّطُ الصفحة» في المتصفّح، ولا معنى لها هنا */
    : `https://${raw.replace(/^\/+/, '')}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return {
      ok: false,
      messageAr: 'لم يُقرأ هذا عنوانا — الصقه كما يظهر في شريط العنوان، مثل: linkedin.com/in/اسمك',
    }
  }

  if (EXECUTABLE_SCHEMES.includes(url.protocol)) {
    return {
      ok: false,
      messageAr: `«${url.protocol}» ليس عنوانَ صفحةٍ تُفتح — ضع عنوانَ صفحتك كما هو، مثل: linkedin.com/in/اسمك`,
    }
  }

  /* اسمُ المستخدمِ قبل الموقع (`https://linkedin.com@evil.com`): صورتُه
     تُقرأ «linkedin.com» والوجهةُ `evil.com`. وكان يُردّ، فصار يُحذف —
     فالوجهةُ واحدةٌ في الحالين، والحذفُ يُظهر للمراجع إلى أين يذهب فعلا. */
  if (url.username || url.password) {
    url.username = ''
    url.password = ''
    return { ok: true, url: url.toString() }
  }

  return { ok: true, url: NEEDS_ENCODING.test(candidate) ? url.toString() : candidate }
}

/** أصالحٌ هو؟ — للحرّاس التي لا تحتاج النصَّ المطبَّع */
export function isValidApplicantLink(input: string): boolean {
  return normalizeApplicantLink(input).ok
}
