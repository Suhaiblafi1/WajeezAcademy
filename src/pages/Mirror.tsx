/* «مرآة وجيز» — أربعةٌ وعشرون بندا، ثلاثُ دقائق، بلا بريدٍ ولا حساب (البند ٤٠).
 *
 * ── ولماذا لوحُ «ما لا يقوله» إلزاميّ ──
 *
 * اختبارُ ميولٍ يُنشر بلا تسجيلٍ يُقرأ حكما على صاحبه إن لم يُقيَّد. والميلُ
 * ليس قدرة: من يحبّ الشرحَ قد لا يُحسنه، ومن ينظّم الملفّاتِ بدقّةٍ ليس
 * محاسبا. فاللوحُ الثالثُ ليس تواضعا — هو **شرطُ صلاحيّة النشر**: بدونه
 * تُقرأ الأشرطةُ قرارا، وهي ترجيحٌ لا أكثر.
 *
 * ── وما يُبذَر منها في التشخيص ──
 *
 * الأبعادُ الستّةُ ووضوحُ الهدف. ومقياسا «الاستعداد للتطبيق» و«الاستمرار»
 * يُعرضان للمتعلّم **ولا يُمرَّران** — تفصيلُ ذلك في `mirror/items.ts`. */

import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Compass, Info, RotateCcw } from 'lucide-react'
import SiteShell from '@/components/SiteShell'
import { Card, Panel } from '@/components/ui/Surface'
import Button from '@/components/ui/Button'
import { LIKERT_AR, mirrorItems } from '@/domain/diagnostic/mirror/items'
import { DIM_LABEL_AR, READINESS_LABEL_AR, scoreMirror } from '@/domain/diagnostic/mirror/score'
import { MIRROR_V2_STORAGE_KEY } from '@/domain/diagnostic/mirror/bridge'
import type { ReadinessKey } from '@/domain/diagnostic/mirror/items'

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(MIRROR_V2_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export default function Mirror() {
  const items = useMemo(() => mirrorItems(), [])
  const [answers, setAnswers] = useState<Record<string, number>>(load)
  const result = useMemo(() => scoreMirror(answers), [answers])
  const done = result.answered === result.total

  const answer = (id: string, score: number) => {
    const next = { ...answers, [id]: score }
    setAnswers(next)
    try {
      localStorage.setItem(MIRROR_V2_STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* متصفّحٌ يمنع التخزين — تبقى الجلسةُ عاملةً في الذاكرة */
    }
  }

  const reset = () => {
    setAnswers({})
    try {
      localStorage.removeItem(MIRROR_V2_STORAGE_KEY)
    } catch {
      /* لا شيء */
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-5 py-10 md:py-14">
        <span className="kicker">مرآة وجيز</span>
        <h1 className="mt-3 text-2xl font-black leading-snug md:text-4xl">
          ما الذي تميل إليه فعلا؟
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
          أربعةٌ وعشرون عبارة، ثلاثُ دقائق. <b className="text-foreground">بلا بريدٍ ولا حساب</b> —
          تُحفظ إجاباتُك على جهازك وحدَه، ومن أخذها لا يُسأل عنها ثانيةً في التشخيص.
        </p>

        <p className="mt-6 text-fine font-bold text-muted-foreground" role="status" aria-live="polite">
          {result.answered} من {result.total}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-teal transition-all"
            style={{ width: `${(result.answered / result.total) * 100}%` }}
          />
        </div>

        <ol className="mt-8 space-y-4">
          {items.map((item, i) => (
            <Card as="li" key={item.id}>
              <p className="text-sm font-bold leading-7 text-foreground">
                <span className="me-2 text-fine text-muted-foreground" dir="ltr">{i + 1}</span>
                {item.text_ar}
              </p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={item.text_ar}>
                {LIKERT_AR.map((label, idx) => (
                  <Button
                    key={label} size="sm" type="button"
                    tone={answers[item.id] === idx + 1 ? 'confirm' : 'secondary'}
                    aria-pressed={answers[item.id] === idx + 1}
                    onClick={() => answer(item.id, idx + 1)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </ol>

        {done && (
          <section className="mt-10" aria-labelledby="mirror-result">
            <h2 id="mirror-result" className="text-xl font-black">مرآتك</h2>

            <Panel tone="accent" className="mt-4">
              <p className="text-fine font-black text-teal-light-ink">رمزُك الثلاثيّ</p>
              <p className="mt-2 text-lg font-black text-foreground">
                {result.code.map((d) => DIM_LABEL_AR[d]).join(' · ')}
              </p>
              <ul className="mt-4 space-y-2.5">
                {result.code.map((d) => (
                  <li key={d}>
                    <div className="flex items-baseline justify-between gap-3 text-fine">
                      <span className="font-bold text-foreground">{DIM_LABEL_AR[d]}</span>
                      {/* المقياسُ صادق: ١..٥ لا نسبةٌ مئويّةٌ توهم بدقّةٍ ليست فيه */}
                      <span className="text-muted-foreground" dir="ltr">{result.dims[d]?.toFixed(1)} / 5</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-teal" style={{ width: `${((result.dims[d] ?? 0) / 5) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel className="mt-4">
              <p className="text-fine font-black text-muted-foreground">جاهزيّتُك للتعلّم</p>
              <ul className="mt-3 space-y-2.5">
                {(['goal_clarity', 'application_readiness', 'completion_pattern'] as ReadinessKey[]).map((k) => (
                  <li key={k} className="flex items-baseline justify-between gap-3 text-fine">
                    <span className="font-bold text-foreground">{READINESS_LABEL_AR[k]}</span>
                    <span className="text-muted-foreground" dir="ltr">{result.readiness[k]?.toFixed(1)} / 5</span>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* ── اللوحُ الإلزاميّ ── */}
            <Panel tone="warn" className="mt-4">
              <p className="flex items-center gap-2 text-fine font-black text-gold-ink">
                <Info className="h-3.5 w-3.5" aria-hidden="true" /> ما لا يقوله هذا الاختبار
              </p>
              <ul className="mt-2.5 space-y-1.5 text-fine leading-6 text-muted-foreground">
                <li>يقيس <b className="text-foreground">ما تميل إليه</b>، لا ما تتقنه — الميلُ ليس قدرة.</li>
                <li>لا يقول لك أيَّ مسارٍ تختار: الميلُ يرجّح ولا يحسم، والاحتياجُ هو الذي يحسم.</li>
                <li>ومن مقاييس الجاهزيّة الثلاثة، <b className="text-foreground">وضوحُ الهدف وحدَه</b> يصل إلى التشخيص — والآخران لك أنت، لأنّ المحرّك لا يملك ما يفعله بهما اليوم.</li>
              </ul>
            </Panel>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button as={Link} to="/diagnostic" tone="primary" icon={Compass}>
                أكمل إلى التشخيص
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button onClick={reset} icon={RotateCcw}>أعِد من البداية</Button>
            </div>
            <p className="mt-3 text-fine leading-5 text-muted-foreground">
              التشخيصُ يبدأ بما عرفناه هنا، فلا يُسأل عمّا أجبتَ عنه.
            </p>
          </section>
        )}
      </div>
    </SiteShell>
  )
}
