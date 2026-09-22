#!/usr/bin/env node
/* أتتجمّع اقتراحاتُ المدرّبين؟ — تقريرٌ على الطابور الحيّ.

   ═══ السؤالُ الذي وُضع له ═══

   سأل صاحبُ المنصّة (٢١ سبتمبر ٢٠٢٦): «ماذا لو كلّ فترةٍ وفترة جمعنا كلَّ
   الدورات المقترحة الجديدة وأضفناها بمسارات جديدة؟ أليس هذا أسهل من أن
   أضيف دورةً دورة وأربطها بمهاراتٍ لربّما غير موجودة؟»

   والجوابُ **لا يُعطى برأي**. إن وقعت ستّةُ اقتراحاتٍ في مجالَين فالتجميعُ
   يدفع ثمنَه؛ وإن وقعت في ستّة فالاجتماعُ يُخرج ستّةَ قراراتٍ منفردةٍ على
   كلّ حال. فهذا يقرأ الطابورَ ويقول أيَّهما.

   الاستعمال:
     npx tsx scripts/with-db.ts npx tsx scripts/audit-proposal-clusters.ts
     … --all   ليقرأ المبتوتَ معه (المربوطَ وما صار دورةً والمرفوض)

   ═══ ولا يُفشِل شيئا ═══

   هذا **تقريرُ قراءة** لا بوّابة: لا شيءَ في الطابور «خطأٌ» يُوقف نشرا.
   ولو رُبط بـCI لَاحمرّ يوما لأنّ مدرّبا اقترح دورةً في مجالٍ جديد — وذاك
   خبرٌ حسن، لا عطب. فيخرج بصفرٍ دائما، ويُنادى حين يُراد.

   ═══ وما يقرؤه ولا يخترعه ═══

   · **المطابقةُ** من `suggestCourses` نفسِها التي تُرشِّح في شاشة التصنيف —
     فلا مرشِّحان يفترقان يوما، ولا يرى الأدمنُ في الشاشة غيرَ ما في التقرير.
   · **والمجالُ والجمهور** من `recommendationUniverse()` — مصدرُ الحقيقة في
     التوصية. فما يقوله التقريرُ عن «مجالٍ يصله هدف» هو ما يقوله المحرّك.
   · **ومقرُّ الدورة من المسارات القياسيّة وحدَها**، والقوالبُ المركّبةُ تُقرأ
     في الوصول ولا تعرّف مقرّا — وإلّا وقع الاقتراحُ الواحدُ في ثمانية عناقيد
     فقيل «تتجمّع» وما تجمّع شيء. والعلّةُ مبسوطةٌ في رأس ملفّ القواعد.
   · **والقواعدُ** في `src/application/catalog/proposal-clusters.ts`، تُختبر
     في `npm run verify` — وهذا الملفُّ قراءةٌ وطباعةٌ لا غير. */

import { PrismaClient } from '@prisma/client'
import { recommendationUniverse } from '../src/domain/diagnostic/v2_1/universe'
import { domainLabelAr } from '../src/domain/diagnostic/v2/data'
import type { DomainId } from '../src/domain/diagnostic/v2/types'
import {
  clusterHeadlineAr, clusterProposals, PATH_COURSE_COUNT,
  type ProposalInput, type UniverseEntity,
} from '../src/application/catalog/proposal-clusters'
import type { MatchableCourse } from '../src/application/trainer/proposal-match'

const ALL = process.argv.includes('--all')
/* المفتوحُ وحدَه افتراضا: المبتوتُ قُرئ وقُرِّر فيه، وإقحامُه يضخّم كلَّ
   عنقودٍ بما لا يُقرَّر فيه ثانية. و`--all` لمن أراد صورةَ الطابور كلِّه. */
const OPEN = ['draft', 'submitted', 'info_requested']

const prisma = new PrismaClient()

/** الكتالوجُ كما يقرؤه المرشِّح — نصُّ الدورة ومهاراتُها، كما في الشاشة */
async function matchableCourses(): Promise<MatchableCourse[]> {
  const rows = await prisma.course.findMany({
    where: { status: { not: 'archived' } },
    select: {
      id: true, currentVersion: true,
      versions: { select: { version: true, titleAr: true, shortPromiseAr: true } },
      skillLinks: { select: { skill: { select: { nameAr: true } } } },
    },
  })
  return rows.map((c) => {
    const v = c.versions.find((x) => x.version === c.currentVersion)
    return {
      id: c.id,
      titleAr: v?.titleAr ?? c.id,
      extraAr: [v?.shortPromiseAr, ...c.skillLinks.map((l) => l.skill.nameAr)],
    }
  })
}

async function main() {
  const rows = await prisma.trainerCourseProposal.findMany({
    where: ALL ? {} : { status: { in: OPEN } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, titleAr: true, summaryAr: true, status: true,
      profile: { select: { application: { select: { fullName: true } } } },
    },
  })

  const proposals: ProposalInput[] = rows.map((r) => ({
    id: r.id,
    titleAr: r.titleAr,
    summaryAr: r.summaryAr,
    trainerName: r.profile.application.fullName,
  }))

  const courses = await matchableCourses()
  const entities = recommendationUniverse().entities as unknown as UniverseEntity[]
  const report = clusterProposals(proposals, courses, entities)

  const label = (d: string) => `${domainLabelAr(d as DomainId)} (${d})`

  console.log(`═══ تجميعُ اقتراحات المدرّبين — ${ALL ? 'الطابورُ كلُّه' : 'المفتوحُ منه'} ═══\n`)
  console.log(`اقتراحات: ${report.totalProposals} · دورات الكتالوج المقروءة: ${courses.length}`)
  console.log(`كياناتُ التوصية: ${entities.length} · دوراتُ المسار الواحد: ${PATH_COURSE_COUNT}\n`)
  console.log(clusterHeadlineAr(report))

  if (report.clusters.length > 0) console.log('\n─────────── العناقيد ───────────')
  for (const c of report.clusters) {
    const mark = c.verdict === 'path_candidate' ? '◆' : c.verdict === 'split_by_audience' ? '◇' : '·'
    console.log(`\n${mark} ${label(c.domain)} — ${c.proposals.length} اقتراحا`)
    console.log(`   الجمهورُ المشترَك: ${c.commonStages.length > 0 ? c.commonStages.join(' · ') : '— لا جمهورَ يجمعها —'}`)
    console.log(`   يصله هدفٌ اليوم: ${c.domainReachable ? 'نعم' : '**لا**'}`)
    console.log(`   ${c.verdictAr}`)
    for (const p of c.proposals) {
      console.log(`     · «${p.titleAr}»${p.trainerName ? ` — ${p.trainerName}` : ''}`)
      console.log(`       أقربُ رمز: ${p.nearestCourseId} «${p.nearestTitleAr}» (${p.score})`)
      console.log(`       تشترك في: ${p.sharedAr.join(' · ')}`)
    }
  }

  /* ═══ وما لم يُوضَع يُقال، ولا يُبتلَع ═══

     المرشِّحُ نصّيٌّ لا أكثر: لا يُرشِّح لاقتراحٍ لا تشترك كلمةٌ من عنوانه
     مع الكتالوج. وذاك ليس عيبا فيه — هو تعريفُه — لكنّ صمتَه عن هؤلاء يجعل
     التقريرَ يقول «كلُّ شيءٍ في مجاله» وفيه ما لا مجالَ له.

     **وهذه أهمُّ صفوف التقرير**: اقتراحٌ لا يشبه شيئا في كتالوجنا إمّا بابٌ
     جديدٌ فعلا، وإمّا عنوانٌ يحتاج قراءةً بعين. وكلاهما يُقرَّر فيه بإنسان. */
  if (report.unanchored.length > 0) {
    console.log(`\n─────────── بلا مرساة (${report.unanchored.length}) ───────────`)
    console.log('لا تشترك كلمةٌ من عناوينها مع الكتالوج — فلا تُوضَع في مجال، وتُقرأ بعين.')
    console.log('وهي إمّا بابٌ جديدٌ فعلا، وإمّا عنوانٌ غامضٌ يُسأل صاحبُه عنه.\n')
    for (const p of report.unanchored) {
      console.log(`  · «${p.titleAr}»${p.trainerName ? ` — ${p.trainerName}` : ''}`)
      if (p.summaryAr) console.log(`    ${p.summaryAr.slice(0, 120)}${p.summaryAr.length > 120 ? '…' : ''}`)
    }
  }

  console.log('\n─────────── وماذا بعد ───────────')
  console.log(`· ◆ مرشَّحُ مسار — ${PATH_COURSE_COUNT} فأكثرُ بجمهورٍ واحد. يُقرأ ولا يُنفَّذ:`)
  console.log('  المسارُ وعدٌ ومخرَجٌ ختاميٌّ وشهادة، ولا يُولَد من عناوينَ اجتمعت في عمود.')
  console.log('· ◇ يُقسَم بالجمهور — عددُه يكفي ولا جمهورَ يجمعه، و«الجوكر» يُحفَظ ولا يُرشَّح.')
  console.log('· · دورةٌ قائمةٌ بنفسها — `recommendableDirectly` بمجالٍ وجمهورٍ ومهارات، بلا مسار.')
  console.log('\nومجالٌ لا يصله هدفٌ: العلاجُ بنكُ الأسئلة لا مسارٌ جديد —')
  console.log('  `docs/CATALOG_GAPS_FROM_DIAGNOSTIC_AR.md` يوثّق اثني عشرَ مسارا سبقت إليه.')
}

main()
  .catch((e) => {
    console.error('✘ تعذّر بناءُ التقرير:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
