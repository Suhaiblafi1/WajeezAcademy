/* قِمع المبيعات — عمودٌ لكلّ مرحلة، لا قائمةٌ واحدة مصفّاة بأزرار.

   دورُ المستشار مبيعاتٌ في وجهه الأوّل، وكانت شاشتُه قائمةً واحدة فوقها
   ثمانيةُ أزرارِ تصفية. فمن أراد أن يعرف «أين قِمعي؟» ضغط ثمانيةَ أزرارٍ
   وعدّ بعينه. وذلك ليس CRM بل جدولٌ بمرشِّح.

   والقِمع يقول ثلاثةً في نظرة: كم في كلّ مرحلة، ومن تأخّرت متابعتُه، وأين
   يقف كلُّ عميل. ومن تأخّرت متابعتُه أوّلُ ما يُرى — فالصفقة تُفقَد
   بالنسيان أكثر ممّا تُفقَد بالرفض. */

import { AlertTriangle, CalendarClock } from 'lucide-react'

/* ═══ الأحبارُ الشفّافةُ على الأبيض، ولماذا بُدِّلت ═══

   `text-muted-foreground/50` و`/35` وأمثالُها ليست ألوانا بل **أبيضٌ بشفافيّة**: تفترض
   أنّ ما خلفها داكن. فقياسُ التباين (`npm run a11y:audit`) وجد هنا نصّا
   بـ**٢٫٢٢:‏١** في المظهر الداكن — والمطلوب ٤٫٥ — و**١٫٦٨:‏١** في الفاتح، أي
   نصٌّ موجودٌ لا يُقرأ.

   و`text-muted-foreground` رمزٌ يُعرَّف في المظهرَين معا (‏٨:‏١ في الداكن
   و٦٫٤:‏١ في الفاتح)، فينقلب معهما. وهي القاعدةُ نفسُها التي أُصلح بها زرُّ
   تبديل المظهر. */
import { CLOSED_STAGES, isOverdue, sinceAr, STAGES, type PipelineCase } from '@/application/advisor/pipeline'

import { Card } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
export default function Pipeline({
  cases,
  onOpen,
  renderName,
}: {
  cases: PipelineCase[]
  onOpen: (id: string) => void
  renderName: (id: string) => { name: string; email: string }
}) {
  const byStage = (key: string) => cases.filter((c) => c.status === key)
  /* `filter(isOverdue)` يمرّر الفهرس مكان الوقت (٠،١،٢…) فيصير «الآن»
     صفرا ولا يتأخّر أحدٌ أبدا — والبانر لا يظهر بينما البطاقاتُ ذهبيّة.
     فالتمريرُ صريحٌ بمعامل واحد. */
  const overdue = cases.filter((c) => isOverdue(c))

  return (
    <div className="space-y-5">
      {/* ما فات موعدُه — قبل كلّ شيء */}
      {overdue.length > 0 && (
        <Card as="section" tone="warn">
          <h2 className="flex items-center gap-2 text-xs font-black text-gold-ink">
            <AlertTriangle className="h-4 w-4" />
            فات موعد متابعة {overdue.length} — الصفقة تُفقَد بالنسيان أكثر ممّا تُفقَد بالرفض
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {overdue.map((c) => (
              <Button tone="secondary" size="sm" key={c.id}
                onClick={() => onOpen(c.id)} className="bg-paper/25 px-3.5">
                {renderName(c.id).name}
                <span className="ms-2 text-gold-ink">{sinceAr(c.nextFollowUpAt!)}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* الأعمدة — تمريرٌ أفقيّ على الهاتف، وشبكةٌ على الشاشة */}
      <div className="scrollbar-hide -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
        {STAGES.map((s) => {
          const items = byStage(s.key)
          return (
            <section key={s.key} className="w-[240px] shrink-0 lg:w-auto">
              <header className="flex items-baseline justify-between gap-2 rounded-t-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <h2 className="truncate text-micro font-black">{s.label}</h2>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-micro font-black tabular-nums">
                  {items.length}
                </span>
              </header>
              <div className="min-h-24 space-y-2 rounded-b-2xl border border-t-0 border-white/10 bg-white/[0.015] p-2">
                {items.length === 0 ? (
                  <p className="px-1.5 py-4 text-center text-micro leading-5 text-muted-foreground">{s.hint}</p>
                ) : (
                  items.map((c) => {
                    const who = renderName(c.id)
                    const late = isOverdue(c)
                    return (
                      <button
                        key={c.id}
                        onClick={() => onOpen(c.id)}
                        className={`w-full cursor-pointer rounded-xl border p-3 text-right transition hover:-translate-y-0.5 ${
                          late ? 'border-gold/45 bg-gold/[0.06]' : 'border-white/10 bg-paper/25 hover:border-teal/40'
                        }`}
                      >
                        <p className="truncate text-xs font-bold">{who.name}</p>
                        {who.email && <p dir="ltr" className="mt-0.5 truncate text-right text-micro text-muted-foreground">{who.email}</p>}
                        {c.nextAction && <p className="mt-2 line-clamp-2 text-micro leading-5 text-muted-foreground">{c.nextAction}</p>}
                        <p className={`mt-2 flex items-center gap-1 text-micro ${late ? 'text-gold-ink' : 'text-muted-foreground'}`}>
                          <CalendarClock className="h-3 w-3" />
                          {c.nextFollowUpAt ? sinceAr(c.nextFollowUpAt) : `آخر تحديث ${sinceAr(c.updatedAt)}`}
                        </p>
                      </button>
                    )
                  })
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* الخارجون من القِمع */}
      {CLOSED_STAGES.some((s) => byStage(s.key).length > 0) && (
        <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <summary className="cursor-pointer text-micro font-bold text-muted-foreground">
            خرجوا من القِمع ({CLOSED_STAGES.reduce((n, s) => n + byStage(s.key).length, 0)})
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {CLOSED_STAGES.flatMap((s) =>
              byStage(s.key).map((c) => (
                <Button tone="secondary" size="sm" key={c.id}
                  onClick={() => onOpen(c.id)} className="px-3.5">
                  {renderName(c.id).name} <span className="text-muted-foreground">· {s.label}</span>
                </Button>
              )),
            )}
          </div>
        </details>
      )}
    </div>
  )
}
