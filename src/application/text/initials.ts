/* حروفُ الاسم مكانَ صورةٍ لم تُرفع أو لم تُعتمد — حرفٌ للعربيّ، وحرفان للّاتينيّ.

   كانت في صفحة الفريق وحدَها، ولزمت صندوقَ الشعبة حين صار يحمل وجهَ مدرّبها
   (٢٠ أكتوبر ٢٠٢٦). ونسختان تفترقان، فالدالّةُ هنا واحدة.

   «Reine Metlej» ← «RM»، و«احمد صالح» ← «أ». والعربيّةُ حرفٌ واحد: حرفان
   منفصلان منها لا يُقرآن اسما. والألفُ المجرّدةُ تُرسم بهمزتها، وإلّا قُرئت
   خطّا عموديّا أو «I». */

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0] ?? ''
  if (/^[A-Za-z]/.test(first)) {
    const last = words.length > 1 ? words[words.length - 1] : ''
    return (first[0] + (last[0] ?? '')).toUpperCase()
  }
  const ch = first.slice(0, 1)
  return ch === 'ا' ? 'أ' : ch
}
