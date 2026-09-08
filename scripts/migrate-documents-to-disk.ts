#!/usr/bin/env node
/* هجرةُ وثائق المتقدّمين: من عمود القاعدة إلى القرص (البند ⑤ · خطوة ٢).

   تُشغَّل على الخادم بعد أن تصل النشرةُ التي فيها المخزن:

     npm run storage:migrate           # تقرير بلا كتابة
     npm run storage:migrate -- --apply

   ── ولماذا لا تُحذف البايتاتُ من العمود هنا ──

   الحذفُ لا رجعةَ فيه، والهجرةُ تُشغَّل مرّةً على بياناتٍ حقيقيّة. فتُنسخ
   أوّلا ويُتحقَّق من النسخة **بمقارنة البصمة** لا بمقارنة الطول — طولان
   متساويان لا يعنيان محتوًى واحدا. ويبقى العمودُ كما هو.

   وتفريغُ العمود خطوةٌ ثالثةٌ منفصلةٌ (`--purge`) تُشغَّل بعد أن يُرى المخزنُ
   يعمل على الإنتاج أيّاما — لا في الدقيقة نفسِها. فالقراءةُ تتراجع إلى
   العمود حتّى ذلك الحين (`readDocumentContent`)، ووثيقةٌ لم تُهاجر تبقى
   مقروءةً لمراجعها بدل أن تختفيَ منه. */

import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { getObject, putObject } from '../server/services/object-store'

const APPLY = process.argv.includes('--apply')
const PURGE = process.argv.includes('--purge')
const digest = (b: Buffer) => createHash('sha256').update(b).digest('hex')

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('✗ لا DATABASE_URL')
    process.exitCode = 1
    return
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

  const rows = await prisma.trainerApplicationDocument.findMany({
    where: { content: { not: null } },
    select: { storageKey: true, content: true, originalName: true, mime: true },
  })
  console.log(`وثائقُ بمحتوًى في العمود: ${rows.length}`)

  let moved = 0
  let already = 0
  let failed = 0
  for (const r of rows) {
    const content = Buffer.from(r.content!)
    const onDisk = await getObject(r.storageKey)
    if (onDisk && digest(onDisk) === digest(content)) {
      already += 1
      continue
    }
    if (!APPLY) {
      moved += 1
      continue
    }
    await putObject(r.storageKey, content, { mime: r.mime, originalName: r.originalName })
    /* التحقّقُ بالبصمة: تُقرأ من القرص كما تُقرأ في الخدمة، وتُقارن بالأصل */
    const back = await getObject(r.storageKey)
    if (!back || digest(back) !== digest(content)) {
      failed += 1
      console.error(`✗ لم تُطابق النسخةُ الأصلَ: ${r.storageKey}`)
      continue
    }
    moved += 1
  }

  console.log(
    APPLY
      ? `✓ نُقلت ${moved} · كانت على القرص ${already} · أخفقت ${failed}`
      : `(تقريرٌ بلا كتابة) ستُنقل ${moved} · على القرص ${already}. أضف --apply للتنفيذ.`,
  )

  if (failed > 0) {
    console.error('✗ أخفقت وثائقُ — لا يُفرَّغ العمودُ وفيها ما لم يُنقل')
    process.exitCode = 1
    await prisma.$disconnect()
    return
  }

  /* ── التفريغُ: خطوةٌ ثالثةٌ صريحةٌ لا تقع بالخطأ ── */
  if (PURGE) {
    if (!APPLY) {
      console.error('✗ التفريغُ يحتاج --apply معه — ولا يُنفَّذ في تقرير')
      process.exitCode = 1
      await prisma.$disconnect()
      return
    }
    let purged = 0
    for (const r of rows) {
      const back = await getObject(r.storageKey)
      /* لا يُفرَّغ عمودٌ إلّا وقد ثبتت نسختُه على القرص بالبصمة */
      if (!back || digest(back) !== digest(Buffer.from(r.content!))) continue
      await prisma.trainerApplicationDocument.update({
        where: { storageKey: r.storageKey }, data: { content: null },
      })
      purged += 1
    }
    console.log(`✓ فُرّغ العمودُ في ${purged} وثيقة — وما لم تثبت نسختُه بقي كما هو`)
  }

  await prisma.$disconnect()
}

void main()
