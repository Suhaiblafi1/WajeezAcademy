/* عارض متن الدرس (البند ح-١) — Markdown مقيّد يُحوَّل إلى عناصر React مباشرة.
   ⚠ لا dangerouslySetInnerHTML إطلاقا: المتن يكتبه مدرب أو مدير عبر حاكمية
   النسخ والاعتماد، لكنه مدخل بشري في نهاية الأمر. التحويل إلى عناصر يجعل
   حقن HTML مستحيلا بنيويا لا بالتنقية، فلا يعتمد الأمان على قائمة حجب.

   المدعوم — وما عداه يُعرض نصا كما هو:
   # عنوان · ## عنوان فرعي · ### عنوان صغير
   - قائمة نقطية   ·   1. قائمة مرقّمة
   > اقتباس
   ```كود``` أسطر متعددة   ·   `كود ضمن السطر`
   **عريض** · *مائل* · [نص](رابط)
   --- فاصل   ·   سطر فارغ = فقرة جديدة

   الروابط: http/https وmailto فقط — وأي مخطط آخر (javascript:) يُعرض نصا. */

import { Fragment, type ReactNode } from "react";
import { parseLesson } from "@/application/content/lesson-markup";

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** يقسّم النص على الأنماط السطرية ويعيد عناصر React — بلا HTML خام */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  /* الترتيب مقصود: الكود أولا كي لا تُفسَّر النجوم داخله */
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-i${i++}`;
    if (tok.startsWith("`")) {
      out.push(
        <code key={key} dir="auto" className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={key} className="font-black">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const cut = tok.indexOf("](");
      const label = tok.slice(1, cut);
      const href = tok.slice(cut + 2, -1);
      if (SAFE_LINK.test(href)) {
        out.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer nofollow"
            className="font-bold text-teal-light-ink underline decoration-dotted underline-offset-4 hover:text-teal-ink"
          >
            {label}
          </a>,
        );
      } else {
        /* مخطط غير مسموح — يُعرض نصا كما كُتب ولا يصير رابطا */
        out.push(<Fragment key={key}>{tok}</Fragment>);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function LessonBody({ body, className = "" }: { body: string; className?: string }) {
  const blocks = parseLesson(body);
  if (blocks.length === 0) return null;
  return (
    <div dir="rtl" className={`course-prose space-y-3 text-sm leading-8 text-white/80 ${className}`.trim()}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.kind) {
          case "h":
            return b.level === 1 ? (
              <h3 key={k} className="mt-5 text-base font-black text-white first:mt-0">{inline(b.text, k)}</h3>
            ) : b.level === 2 ? (
              <h4 key={k} className="mt-4 text-sm font-black text-white/90 first:mt-0">{inline(b.text, k)}</h4>
            ) : (
              <h5 key={k} className="mt-3 text-sm font-bold text-white/80 first:mt-0">{inline(b.text, k)}</h5>
            );
          case "quote":
            return (
              <blockquote key={k} className="border-s-2 border-teal/50 bg-teal-ink/[0.06] px-4 py-2.5 text-white/75">
                {inline(b.text, k)}
              </blockquote>
            );
          case "ul":
            return (
              <ul key={k} className="space-y-1.5 ps-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-ink" />
                    <span className="min-w-0">{inline(it, `${k}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} className="space-y-1.5 ps-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-ink/15 text-micro font-black tabular-nums text-teal-light-ink">
                      {j + 1}
                    </span>
                    <span className="min-w-0">{inline(it, `${k}-${j}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre key={k} dir="ltr" className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
                <code className="font-mono text-xs leading-6 text-white/80">{b.text}</code>
              </pre>
            );
          case "hr":
            return <hr key={k} className="border-white/10" />;
          default:
            return <p key={k}>{inline(b.text, k)}</p>;
        }
      })}
    </div>
  );
}
