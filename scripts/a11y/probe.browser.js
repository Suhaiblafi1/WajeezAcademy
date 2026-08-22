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
      return r.width > 0 && r.height > 0
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
}
