/* خريطةُ الموقع وllms.txt — صيغتُهما في موضعٍ واحد، ويملؤهما من يعرف ما يُعرض.

   ═══ لماذا موضعٌ واحدٌ ومَلآن ═══

   `scripts/prerender-seo.ts` يكتبهما ساكنَين وقتَ البناء بالصفحات العامّة وحدَها —
   احتياطا لمن يخدم `dist/` بلا خادمٍ (`.htaccess`). والخادمُ يجيبهما حيّين
   (`server/services/seo-feeds.service.ts`) ومعهما ما يُعرض **الآن**: المساراتُ التي
   لكلّ دوراتها شعبةٌ في فصلها، والدوراتُ التي لها شعبة.
   والصيغةُ هنا كي لا يفترق الاثنان في شكلٍ يرفضه قوقل في أحدهما.

   ═══ ولمَ llms.txt ═══

   محرّكاتُ الإجابة (ChatGPT وPerplexity وClaude وGemini) تقرأ النصَّ لا التطبيق.
   و`/llms.txt` (llmstxt.org) ملخّصٌ بـMarkdown يقول لها في صفحةٍ واحدة: من نحن، وما
   الذي نقدّمه، وأين التفاصيل — بروابطَ مطلقةٍ إلى صفحاتٍ مُهيَّأةٍ تقرؤها بلا جافاسكربت.
   ونصُّه من المصادر نفسِها التي تعرضها الصفحات — لا ادّعاءَ ليس في الموقع. */

import { ACADEMY_EMAILS } from '../../data/academy-email'

export interface SitemapEntry {
  /** يبدأ بشرطةٍ مائلة */
  path: string
  priority: number
}

const xmlEsc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** خريطةُ الموقع — بلا تكرار، والأوّلُ يغلب */
export function sitemapXml(origin: string, entries: readonly SitemapEntry[]): string {
  const seen = new Set<string>()
  const urls: string[] = []
  for (const e of entries) {
    if (seen.has(e.path)) continue
    seen.add(e.path)
    urls.push(`  <url><loc>${xmlEsc(`${origin}${e.path}`)}</loc><priority>${e.priority.toFixed(1)}</priority></url>`)
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- مولَّدٌ آليّا من src/application/site/seo-feeds.ts — لا يُحرَّر بيد. -->\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls.join('\n')}\n` +
    '</urlset>\n'
  )
}

export interface LlmsLink {
  path: string
  title: string
  /** سطرٌ واحد — ما يُقتبس عنه */
  note?: string
}

export interface LlmsInput {
  /** الصفحاتُ العامّة الأساسيّة */
  pages: readonly LlmsLink[]
  /** المساراتُ المعروضة الآن */
  pathways?: readonly LlmsLink[]
  /** الدوراتُ المعروضة الآن */
  courses?: readonly LlmsLink[]
  faqs: readonly { q: string; a: string }[]
  /** صفحاتٌ ثانويّة — الشروطُ والخصوصيّة */
  optional?: readonly LlmsLink[]
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

function linkList(origin: string, links: readonly LlmsLink[]): string {
  return links
    .map((l) => `- [${oneLine(l.title)}](${origin}${l.path})${l.note ? `: ${oneLine(l.note)}` : ''}`)
    .join('\n')
}

/** `/llms.txt` بصيغة llmstxt.org: عنوان، فملخّصٌ مقتبَس، فأقسامٌ بروابط */
export function llmsTxt(origin: string, input: LlmsInput): string {
  const out: string[] = []
  out.push('# أكاديمية وجيز (Wajeez Academy)')
  out.push('')
  out.push(
    '> أكاديمية عربية للتدريب العملي عبر الإنترنت، من منظومة وجيز للمعرفة والتطوير (wajeez.com). ' +
      'تبدأ بتشخيص تعليمي مجاني يفهم هدف المتعلم وواقعه، ثم توصي بمسار واحد مفسر من دورات مباشرة مع مدربين، ' +
      'وتطبيقات يقيمها خبراء، ومشروع تخرج، وشهادة إتمام يمكن التحقق منها.',
  )
  out.push('')
  out.push(
    'Wajeez Academy is an Arabic-language online training academy (part of the Wajeez knowledge ecosystem). ' +
      'Learners start with a free adaptive diagnostic that recommends one explained learning pathway; pathways are ' +
      'made of live, trainer-led online courses with hands-on projects assessed by industry experts, a capstone ' +
      'project, and a verifiable completion certificate. Fields include entrepreneurship, marketing, careers and job ' +
      'search, leadership and management, HR, communication and public speaking, freelancing, personal finance, ' +
      'cybersecurity and cloud, and English.',
  )
  out.push('')
  out.push('حقائق أساسية:')
  out.push('- طريقة التعلم: مباشر عبر الإنترنت، لقاء أسبوعي مع المدرب وتطبيق عملي بين اللقاءات.')
  out.push('- اللغة: العربية.')
  out.push('- البداية: تشخيص مجاني دون حساب، ثم مستشار بشري حين تنخفض ثقة التوصية.')
  out.push('- الشهادة: شهادة إتمام موثقة لها رقم يتحقق منه أي أحد في صفحة التحقق.')
  out.push('- لا وعد بوظيفة أو دخل: الوعد مهارات تقاس ومشاريع حقيقية.')
  out.push(`- التواصل: ${ACADEMY_EMAILS.support} — الرياض، حي الياسمين، شارع أنس بن مالك.`)
  out.push('')
  out.push('## الصفحات الأساسية')
  out.push('')
  out.push(linkList(origin, input.pages))
  if (input.pathways?.length) {
    out.push('', '## المسارات المتاحة الآن', '', linkList(origin, input.pathways))
  }
  if (input.courses?.length) {
    out.push('', '## الدورات المتاحة الآن', '', linkList(origin, input.courses))
  }
  if (input.faqs.length) {
    out.push('', '## الأسئلة الشائعة', '')
    for (const f of input.faqs) out.push(`### ${oneLine(f.q)}`, '', oneLine(f.a), '')
    out.pop()
  }
  if (input.optional?.length) {
    out.push('', '## Optional', '', linkList(origin, input.optional))
  }
  out.push('')
  return out.join('\n')
}
