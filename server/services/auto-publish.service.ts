/* نشر لقطة الكتالوج آليا — يُستدعى من البناء الإنتاجي.
 *
 * اللقطة كانت الطبقة الوحيدة خارج مجرى Git: الكود والمحتوى وبنية القاعدة
 * تصل بدفعة واحدة، وهي — وهي ما يقرأه المحرك فعلا — تنتظر أربع ضغطات في
 * لوحة الإدارة. فيتقدّم المستودع ويبقى المستخدم على القديم بلا ما ينبّه.
 *
 * ما يبقى من الحوكمة بعد الأتمتة:
 *   · النشر ذرّي كما هو — معاملة واحدة ترفض عند أي نقص، فلا نشر جزئي.
 *   · اللقطات تُحفظ، فالتراجع بضغطة يبقى متاحا من اللوحة.
 *   · تحليل الأثر يُشغَّل ويُخزَّن قبل النشر لا بعده — بعده يصير المرشّح هو
 *     المنشور فتضيع المقارنة أصلا.
 *   · واللوحة تبقى عاملة للنشر اليدوي متى أراده المشغّل.
 *
 * وما لا يفعله: لا ينشر حين لا جديد. تطابق البصمة يعني أن ما في الجداول هو
 * ما يقرأه المحرك أصلا، فإنشاء إصدار حينها ضجيج في سجل يُقرأ عند الأعطال.
 */

import type { PrismaClient } from '@prisma/client'
import { buildSnapshotFromDb, getActiveSnapshot } from '../catalog/snapshot-builder'
import { PublishingService } from './publishing.service'
import { analyzeImpact } from './impact.service'

export interface AutoPublishResult {
  published: boolean
  /** سبب عدم النشر حين published=false */
  skippedAr?: string
  label?: string
  candidateHash: string
  activeLabel: string | null
  impactRunId?: string
  changedCount?: number
}

/** تسمية تربط اللقطة بالالتزام الذي أنتجها وبمحتواها — مقروءة وفريدة */
export function autoLabel(commit: string | undefined, hash: string): string {
  const sha = (commit ?? '').slice(0, 7)
  return sha ? `auto-${sha}-${hash.slice(0, 6)}` : `auto-${hash.slice(0, 12)}`
}

export async function publishSnapshotIfChanged(
  prisma: PrismaClient,
  opts: { commit?: string; log?: (line: string) => void } = {},
): Promise<AutoPublishResult> {
  const log = opts.log ?? (() => {})

  /* المرشّح = المنشور + المعتمد، وهو ما ستبنيه publish() بعد الترقية */
  const candidate = await buildSnapshotFromDb(prisma, { extraStatuses: ['approved'] })
  const active = await getActiveSnapshot(prisma)
  const base = { candidateHash: candidate.hash, activeLabel: active?.label ?? null }

  if (active && active.hash === candidate.hash) {
    log('لا جديد لينشر — بصمة الجداول تطابق اللقطة المنشورة.')
    log(`  اللقطة الفعالة: «${active.label}» · ${active.hash.slice(0, 16)}…`)
    return { ...base, published: false, skippedAr: 'لا فرق بين الجداول واللقطة المنشورة' }
  }

  log('يوجد فرق بين الجداول واللقطة المنشورة:')
  log(`  اللقطة الفعالة : ${active ? `«${active.label}» · ${active.hash.slice(0, 16)}…` : 'لا لقطة منشورة بعد'}`)
  log(`  بصمة المرشّح   : ${candidate.hash.slice(0, 16)}…`)

  /* الأثر قبل النشر لا بعده — وهو السجل الذي يحلّ محلّ قراءة اللوحة */
  log('')
  log('── تحليل الأثر (12 شخصية) ──')
  const impact = await analyzeImpact(prisma, 'نشر آلي مع البناء')
  log(`  مقيس على: ${impact.baselineAr}`)
  log(`  ${impact.verdictAr}`)
  log(`  تغيّرت توصية ${impact.changedCount} من ${impact.totalPersonas} شخصية.`)
  for (const w of impact.changedWinners) {
    log(`   • ${w.name}: ${w.beforeTop ?? '—'} ← ${w.afterTop ?? '—'}`)
  }
  log(`  سجل التحليل: ${impact.runId}`)

  log('')
  log('── النشر الذرّي ──')
  const pub = new PublishingService(prisma)
  let label = autoLabel(opts.commit, candidate.hash)
  for (let n = 2; await prisma.catalogVersion.findUnique({ where: { label } }); n++) {
    if (n > 9) throw new Error(`تعذّر إيجاد تسمية حرة للقطة — آخر ما جُرّب: ${label}`)
    label = `${autoLabel(opts.commit, candidate.hash)}-${n}`
  }
  const version = await pub.createDraftVersion(label, undefined)
  await pub.publish(version.id, null) // فعل نظامي — لا مشغّل بشري خلفه
  log(`✅ نُشرت «${label}»`)
  log('   والتراجع متاح من /admin/publishing إن ساء شيء.')

  return {
    ...base,
    published: true,
    label,
    impactRunId: impact.runId,
    changedCount: impact.changedCount,
  }
}
