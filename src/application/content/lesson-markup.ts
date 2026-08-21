/* تحليل متن الدرس (البند ح-١) — Markdown مقيّد إلى كتل، دالة نقية بلا DOM.
   ⚠ الفصل مقصود: التحليل هنا والعرض في LessonBody.tsx. فالتحليل يُختبر وحده،
   والعرض لا يملك مسارا لإخراج HTML خام أصلا — الأمان بنيوي لا بالتنقية. */

export type LessonBlock =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; text: string }
  | { kind: "hr" };

/** يحوّل المتن إلى كتل — دالة نقية قابلة للاختبار بلا DOM */
export function parseLesson(md: string): LessonBlock[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: LessonBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith("```")) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }
    if (t === "") { flush(); continue; }
    if (/^---+$/.test(t)) { flush(); blocks.push({ kind: "hr" }); continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) { flush(); blocks.push({ kind: "h", level: h[1].length as 1 | 2 | 3, text: h[2].trim() }); continue; }

    if (t.startsWith("> ")) {
      flush();
      const buf = [t.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("> ")) buf.push(lines[++i].trim().slice(2));
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(t);
    if (ul) {
      flush();
      const items = [ul[1]];
      while (i + 1 < lines.length) {
        const nx = /^[-*]\s+(.*)$/.exec(lines[i + 1].trim());
        if (!nx) break;
        items.push(nx[1]); i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    const ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ol) {
      flush();
      const items = [ol[1]];
      while (i + 1 < lines.length) {
        const nx = /^\d+[.)]\s+(.*)$/.exec(lines[i + 1].trim());
        if (!nx) break;
        items.push(nx[1]); i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    para.push(t);
  }
  flush();
  return blocks;
}

