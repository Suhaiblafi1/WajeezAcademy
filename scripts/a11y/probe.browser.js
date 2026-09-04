/* موجة ٦ · ب — فحوص الإتاحة التي تُنفَّذ داخل الصفحة.

   ⚠ هذا الملف **جافاسكربت متصفح صريح** لا TypeScript، ويُحقَن بـaddInitScript.
   السبب واقعي: تمرير دوالّ TS إلى page.evaluate يفشل بـ«__name is not defined»
   لأن مُحوِّل tsx يلفّ الدوالّ بمساعِدٍ لا وجود له في المتصفح. فحدُّ اللغتين
   صريح: شيفرة المتصفح في ملف متصفح، وشيفرة Node في TypeScript.

   وكل فحص يقيس ما يمنع الاستخدام فعلا لا ما يخالف قاعدة على الورق. */

window.__a11y = {
  /** أسماء العناصر التفاعلية + المناطق + الترتيب + اللغة */
  names: function () {
    var out = []
    function tag(el) {
      var t = el.tagName.toLowerCase()
      var id = el.getAttribute('id')
      var cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 2).join('.')
      return t + (id ? '#' + id : '') + (cls ? '.' + cls : '')
    }
    function accName(el) {
      var aria = (el.getAttribute('aria-label') || '').trim()
      if (aria) return aria
      var by = el.getAttribute('aria-labelledby')
      if (by) {
        var t = by.split(/\s+/).map(function (i) {
          var n = document.getElementById(i)
          return n ? n.textContent || '' : ''
        }).join(' ').trim()
        if (t) return t
      }
      /* النصّ المقروء يستثني ما وُسم aria-hidden: أيقونةٌ أو رمزٌ زخرفي داخل
         الزرّ لا يقوله قارئ الشاشة، فحسابه اسما يُمرّر زرّا بلا اسم فعلي.
         (كُشف بحقن زرّ نصّه «×» داخل span مخفي — كان يمرّ.) */
      var clone = el.cloneNode(true)
      var hiddenKids = clone.querySelectorAll('[aria-hidden="true"]')
      for (var h = 0; h < hiddenKids.length; h++) hiddenKids[h].remove()
      var text = (clone.textContent || '').replace(/\s+/g, ' ').trim()
      if (text) return text
      var title = (el.getAttribute('title') || '').trim()
      if (title) return title
      var img = el.querySelector('img[alt]')
      if (img && (img.getAttribute('alt') || '').trim()) return img.getAttribute('alt').trim()
      var svgTitle = el.querySelector('svg > title')
      if (svgTitle && (svgTitle.textContent || '').trim()) return svgTitle.textContent.trim()
      return ''
    }
    function visible(el) {
      var cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      var r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return false
      return onScreenX(r)
    }
    /* عنصرٌ مدفوعٌ خارجَ الشاشة **أفقيّا** لا يراه أحدٌ ولا يُلمَس: حقلُ الفخّ
       (`left:-9999px`)، وقائمةٌ جانبيّةٌ مطويّة. والشرطُ أفقيٌّ وحدَه عن قصد:
       ما كان أسفلَ الطيّة هدفٌ حقيقيٌّ يُدرَك بالتمرير، فيبقى مقيسا. */
    function onScreenX(r) {
      var vw = window.innerWidth || document.documentElement.clientWidth
      return r.right > 0 && r.left < vw
    }

    var interactive = Array.prototype.slice.call(
      document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="link"]'),
    )
    for (var i = 0; i < interactive.length; i++) {
      var el = interactive[i]
      if (!visible(el)) continue
      if (el.getAttribute('aria-hidden') === 'true') continue
      var t = el.tagName.toLowerCase()
      if (t === 'input' || t === 'textarea' || t === 'select') {
        if (el.type === 'hidden') continue
        var id = el.getAttribute('id')
        var labelled = id ? document.querySelector('label[for="' + id + '"]') : el.closest('label')
        var name = accName(el)
          || (labelled ? (labelled.textContent || '').trim() : '')
          || (el.getAttribute('placeholder') || '').trim()
        if (!name) {
          out.push({ rule: 'name', target: tag(el), impactAr: 'حقل إدخال بلا اسم مقروء — قارئ الشاشة يقول «حقل نصّي» ولا يقول ماذا يُكتب فيه' })
        }
        continue
      }
      if (!accName(el)) {
        out.push({ rule: 'name', target: tag(el), impactAr: 'عنصر تفاعلي بلا اسم مقروء — قارئ الشاشة يقول «زرّ» ولا يقول ماذا يفعل' })
      }
    }

    var tabbed = Array.prototype.slice.call(document.querySelectorAll('[tabindex]'))
    for (var k = 0; k < tabbed.length; k++) {
      var v = Number(tabbed[k].getAttribute('tabindex'))
      if (isFinite(v) && v > 0) {
        out.push({ rule: 'tabindex-positive', target: tag(tabbed[k]), impactAr: 'tabindex=' + v + ' يقلب ترتيب Tab على كل المستخدمين لا على هذا العنصر وحده' })
      }
    }

    var mains = Array.prototype.slice.call(document.querySelectorAll('main, [role="main"]')).filter(visible)
    if (mains.length === 0) {
      out.push({ rule: 'landmark', target: 'document', impactAr: 'لا منطقة main — قارئ الشاشة بلا هدف يقفز إليه، فيقرأ التنقل كاملا قبل المحتوى في كل صفحة' })
    } else if (mains.length > 1) {
      out.push({ rule: 'landmark', target: 'main × ' + mains.length, impactAr: 'أكثر من منطقة main — «اقفز للمحتوى» يصير غامضا' })
    }

    if (!document.documentElement.getAttribute('lang')) {
      out.push({ rule: 'lang', target: 'html', impactAr: 'الصفحة بلا lang — قارئ الشاشة ينطق العربية بلكنة الإنجليزية أو يعجز' })
    }

    var heads = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible)
    var prev = 0
    for (var h = 0; h < heads.length; h++) {
      var lvl = Number(heads[h].tagName[1])
      if (prev > 0 && lvl - prev > 1) {
        out.push({
          rule: 'heading-order',
          target: tag(heads[h]) + ' «' + (heads[h].textContent || '').trim().slice(0, 30) + '»',
          impactAr: 'قفز في العناوين من h' + prev + ' إلى h' + lvl + ' — قارئ الشاشة يتنقّل بالعناوين، فالقفز يوهم بغياب قسم',
        })
      }
      prev = lvl
    }
    return out
  },

  /** بصمة نمط العنصر المركَّز عليه — غياب كل دلائل التركيز يعني لا دليل */
  focusStyle: function () {
    var el = document.activeElement
    if (!el || el === document.body) return null
    var cs = getComputedStyle(el)
    var r = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || '').trim().slice(0, 40),
      outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
      shadow: cs.boxShadow,
      ring: cs.getPropertyValue('--tw-ring-shadow') || '',
      hidden: r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none',
    }
  },

  /** تمرير أفقي على مستوى المستند — معيار الانسياب */
  hasHScroll: function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  },

  /* ─────────── تباينُ النصّ مع أرضيّته ───────────

     المنصّةُ لها مظهران: الداكنُ هو الأساس والفاتحُ اختياريّ. وأكثرُ ألوانِ
     النصّ فيها شفّافةٌ على الأبيض (`text-white/45` وأمثالُها) — وهي مبنيّةٌ
     على أنّ ما خلفها داكن. فأيُّ لونٍ من هذا النوع بقي في المظهر الفاتح صار
     أبيضَ باهتا على ورقٍ فاتح: النصُّ موجودٌ ولا يُقرأ. وقد وقع هذا فعلا في
     زرّ تبديل المظهر نفسِه (انظر تعليقَ `ThemeToggle`)، فالخطرُ مُثبَتٌ لا
     مفترَض.

     والقياسُ هنا كما في WCAG 1.4.3: نسبةُ سطوعٍ ٤٫٥ للنصّ العاديّ و٣ للكبير
     (‏١٨٫٦٦px عريضا أو ٢٤px). والشفافيّةُ تُركَّب على أوّل أرضيّةٍ غيرِ شفّافةٍ
     فوق العنصر — كما يفعل المتصفّح في الرسم لا كما تقول القيمةُ المعلَنة. */
  contrast: function () {
    var out = []

    function parseColor(v) {
      var m = /rgba?\(([^)]+)\)/.exec(v || '')
      if (!m) return null
      var parts = m[1].split(/[ ,\/]+/).filter(function (x) { return x !== '' })
      return {
        r: parseFloat(parts[0]), g: parseFloat(parts[1]), b: parseFloat(parts[2]),
        a: parts.length > 3 ? parseFloat(parts[3]) : 1,
      }
    }
    function over(fg, bg) {
      /* تركيبُ ألفا: ما يراه المستخدمُ فعلا */
      var a = fg.a
      return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
    }
    function lum(c) {
      function ch(v) { var x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
      return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b)
    }
    function ratio(a, b) {
      var la = lum(a), lb = lum(b)
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
    }
    /* أوّلُ أرضيّةٍ غيرِ شفّافةٍ فوق العنصر — وإلّا أرضيّةُ المستند.

       ويعود `null` إن كان في السلسلة تدرّجٌ أو صورة: اللونُ المرسومُ عندها
       غيرُ معلومٍ من الأنماط المحسوبة، والحكمُ عليه تخمينٌ. وفحصٌ يصرخ في
       غير موضعه يُهمَل كلُّه — فالسكوتُ عمّا لا يُقاس أصدقُ من رقمٍ مختلَق. */
    function bgOf(el) {
      var node = el
      var stack = []
      while (node && node.nodeType === 1) {
        var cs2 = getComputedStyle(node)
        if (cs2.backgroundImage && cs2.backgroundImage !== 'none') return null
        var c = parseColor(cs2.backgroundColor)
        if (c && c.a > 0) {
          stack.push(c)
          if (c.a >= 0.999) break
        }
        node = node.parentElement
      }
      var base = { r: 255, g: 255, b: 255, a: 1 }
      if (!node) {
        var docBg = parseColor(getComputedStyle(document.documentElement).backgroundColor)
        if (docBg && docBg.a >= 0.999) base = docBg
      }
      for (var i = stack.length - 1; i >= 0; i--) base = over(stack[i], base)
      return base
    }
    function tagOf(el) {
      var t = el.tagName.toLowerCase()
      var cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 3).join('.')
      return t + (cls ? '.' + cls : '')
    }

    var all = document.querySelectorAll('body *')
    var seen = 0
    for (var i = 0; i < all.length && seen < 1200; i++) {
      var el = all[i]
      if (el.getAttribute('aria-hidden') === 'true') continue
      /* النصُّ المباشرُ وحدَه: لو حُسب النصُّ الموروثُ لكلّ أبٍ لتضاعف كلُّ
         خللٍ بعددِ آبائه. */
      var own = ''
      for (var k = 0; k < el.childNodes.length; k++) {
        if (el.childNodes[k].nodeType === 3) own += el.childNodes[k].nodeValue
      }
      own = own.replace(/\s+/g, ' ').trim()
      if (own.length < 2) continue
      var cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.1) continue
      /* العناصرُ المعطَّلة مستثناةٌ في المعيار نفسِه (WCAG 1.4.3 يستثني
         «مكوّنات الواجهة غيرَ النشطة»): الزرُّ المغلَقُ يُقرأ باهتا **بقصد**
         ليُعرف أنّه لا يُضغَط. ولو حُسبت لصار الفحصُ يشكو ممّا هو صحيح — وفحصٌ
         يشكو في غير موضعه يُهمَل كلُّه. */
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue
      if (el.closest && el.closest('[disabled], [aria-disabled="true"], fieldset[disabled]')) continue
      var rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) continue
      seen++
      var fg = parseColor(cs.color)
      if (!fg) continue
      /* نصٌّ شفّافٌ تماما: نمطُ `bg-clip-text` يرسم التدرّجَ داخلَ الحروف
         ولونُ النصّ `transparent`. فالمقياسُ لا ينطبق عليه، ولو حُسب لخرج
         ‏١:‏١ دائما — وهو الذي ظهر في الصفحة الرئيسيّة عشرَ مرّات. */
      if (fg.a < 0.05) continue
      var bg = bgOf(el)
      if (!bg) continue
      var eff = fg.a >= 0.999 ? fg : over(fg, bg)
      var size = parseFloat(cs.fontSize)
      var weight = parseInt(cs.fontWeight, 10) || 400
      var large = size >= 24 || (size >= 18.66 && weight >= 700)
      var need = large ? 3 : 4.5
      var got = ratio(eff, bg)
      if (got + 0.05 < need) {
        out.push({
          target: tagOf(el),
          text: own.slice(0, 40),
          ratio: Math.round(got * 100) / 100,
          need: need,
          size: Math.round(size * 10) / 10,
        })
      }
    }
    /* الأسوأُ أوّلا، وعشرون تكفي للحكم: القائمةُ للإصلاح لا للإحصاء */
    out.sort(function (a, b) { return a.ratio - b.ratio })
    return out.slice(0, 20)
  },

  /* ─────────── حجمُ هدف اللمس (WCAG 2.5.8) ───────────

     العطبُ الذي وُلدت منه: القياسُ على هاتفٍ عرضُه ٣٩٠ بكسلا وجد في ستّ
     عشرةَ شاشةً أهدافا لا يصيبها الإصبع — روابطَ بارتفاع ثلاثةَ عشرَ بكسلا
     في تذييل ستّ صفحات، وزرَّ إظهارِ كلمة المرور بعرض ستّةَ عشر، وحقلَ
     بحثٍ بارتفاع ستّةَ عشر، وعلامةَ المنصّة مضغوطةً إلى بكسلَين.

     والحدُّ هنا **٢٤×٢٤** لا ٤٤: هو ما يفرضه المعيار في مستوى AA
     (‏2.5.8 Target Size Minimum)، و٤٤ توصيةٌ في AAA. والبوّابةُ تحرس
     الإلزامَ، والمراجعةُ تطلب الأفضل.

     وثلاثةُ استثناءاتٍ من المعيار نفسِه — بلا واحدٍ منها يصرخ الفحصُ في غير
     موضعه فيُهمَل كلُّه:
     • **الرابطُ في جملة**: تكبيرُه يفكّ سطرَ النصّ، والمعيار يستثنيه نصّا.
     • **الوسمُ الذي يلفّ الحقل**: هو الهدفُ الفعليّ — الضغطةُ على نصّه
       تُبدّل المربّع؛ فيُقاس هو لا المربّعُ الصغيرُ داخله.
     • **المعطَّل**: لا يُضغط أصلا. */
  targets: function () {
    var out = []
    /* نسخةٌ محلّيّة: نظيرتُها في `contrast` مغلقةٌ داخلَ نطاقها */
    function tagOf(el) {
      var t = el.tagName.toLowerCase()
      var cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 3).join('.')
      return t + (cls ? '.' + cls : '')
    }
    var sel = 'a[href], button, input, select, textarea, [role="button"], [role="checkbox"], [role="tab"]'
    var nodes = document.querySelectorAll(sel)
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue
      if (el.closest && el.closest('[disabled], [aria-disabled="true"], fieldset[disabled]')) continue
      var cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue
      var r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      /* خارجَ الشاشة أفقيّا: لا يُلمَس فلا حجمَ هدفٍ له (نظيرُ الشرط في `visible`) */
      var vw = window.innerWidth || document.documentElement.clientWidth
      if (r.right <= 0 || r.left >= vw) continue
      /* الوسمُ حولَه هو الهدف */
      var lbl = el.closest('label')
      if (lbl) {
        var lr = lbl.getBoundingClientRect()
        if (lr.width >= 24 && lr.height >= 24) continue
      }
      /* رابطٌ داخلَ جملةٍ: أبوه فقرةٌ فيها نصٌّ غيرُ نصّه */
      if (el.tagName === 'A') {
        var par = el.closest('p, li, td, dd, blockquote, figcaption')
        var mine = (el.textContent || '').trim().length
        if (par && (par.textContent || '').trim().length > mine + 8) continue
      }
      if (r.width >= 24 && r.height >= 24) continue
      out.push({
        target: tagOf(el),
        text: ((el.textContent || '').trim() || el.getAttribute('aria-label') || '').slice(0, 32),
        w: Math.round(r.width),
        h: Math.round(r.height),
      })
    }
    /* الأصغرُ أوّلا، وعشرون تكفي */
    out.sort(function (a, b) { return (a.w * a.h) - (b.w * b.h) })
    return out.slice(0, 20)
  },
}
