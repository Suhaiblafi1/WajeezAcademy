/* ما يناله كلُّ أحدٍ الآن — بشراءٍ أو بغيره.

   ═══ لماذا كتلةٌ مستقلّةٌ لا بنودٌ تُدَسّ في قائمة المسار ═══

   قائمةُ المسار غرضُها المكتوبُ «فرقُ الشراءَين». ومجّانيٌّ للجميع فيها
   يناقضها: من قرأه فقَد سببا للشراء بدل أن يكسب. فكتلةٌ بجوارها تقول ما هي
   بصريح العبارة — والمجّانيُّ يظهر أوضحَ ممّا لو دُسّ بينها.

   والشرحُ يُفتح في الصفحة نفسِها: جسرُ المكتبة إلى «وجيز مهارات» غيرُ مربوطٍ
   بعد، وسياسةُ التأليف تنهى عن اختراع رابط. فما لا وجهةَ له يُشرح مكانَه. */

import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Gift } from 'lucide-react'
import { FREE_FOR_ALL_NOW, type Perk } from '@/data/pathway-perks'
import Modal from '@/components/Modal'
import { Card, Inset } from '@/components/ui/Surface'

function PerkBody({ perk }: { perk: Perk }) {
  return (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal/12">
        <perk.icon className="h-4 w-4 text-teal-light-ink" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-read font-bold leading-snug">{perk.t}</span>
        <span className="block text-read leading-6 text-muted-foreground">{perk.d}</span>
      </span>
    </>
  )
}

/** `bare`: بلا بطاقةٍ — لأنّها تُستعمل داخلَ بطاقةٍ قائمة، وبطاقةٌ في بطاقةٍ
    ازدواجُ حدودٍ يضاعف المعالمَ على قارئ الشاشة ولا يفصل شيئا للعين. */
export default function FreeNowPerks({ className = '', bare = false }: { className?: string; bare?: boolean }) {
  const [open, setOpen] = useState<Perk | null>(null)
  if (FREE_FOR_ALL_NOW.length === 0) return null

  const inner = (
    <>
      <h3 className="flex items-center gap-1.5 text-sm font-black text-gold-ink">
        <Gift className="h-4 w-4" aria-hidden="true" /> ومجّانا لك الآن — بمسارٍ أو بغيره
      </h3>

      <ul className="mt-3 space-y-2">
        {FREE_FOR_ALL_NOW.map((perk) => (
          <li key={perk.t}>
            {perk.href ? (
              <Link to={perk.href} className="flex items-start gap-2.5 rounded-xl p-1 transition hover:bg-white/[0.03]">
                <PerkBody perk={perk} />
                <ArrowLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-light-ink" aria-hidden="true" />
              </Link>
            ) : perk.explain ? (
              <button
                type="button"
                onClick={() => setOpen(perk)}
                className="flex w-full items-start gap-2.5 rounded-xl p-1 text-right transition hover:bg-white/[0.03]"
              >
                <PerkBody perk={perk} />
                <span className="mt-0.5 shrink-0 text-read font-bold text-teal-light-ink underline underline-offset-4">
                  اعرف أكثر
                </span>
              </button>
            ) : (
              <span className="flex items-start gap-2.5 p-1"><PerkBody perk={perk} /></span>
            )}
          </li>
        ))}
      </ul>

      {open?.explain && (
        <Modal onClose={() => setOpen(null)} label={open.explain.titleAr} panelClassName="w-full max-w-lg">
          <Inset dir="rtl" tone="solid" className="max-h-[86vh] overflow-y-auto sm:p-6">
            <h2 className="text-base font-black">{open.explain.titleAr}</h2>
            <div className="mt-3 space-y-3">
              {open.explain.paras.map((p) => (
                <p key={p} className="text-read leading-7">{p}</p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="mt-5 w-full rounded-xl bg-teal px-4 py-2 text-read font-bold text-white"
            >
              فهمت
            </button>
          </Inset>
        </Modal>
      )}
    </>
  )

  return bare
    ? <section className={`border-t border-white/10 pt-3 ${className}`}>{inner}</section>
    : <Card as="section" tone="warn" className={className}>{inner}</Card>
}
