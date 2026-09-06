/* تشغيلٌ واحدٌ للدفعة الواحدة — لا تشغيلان.

   العطبُ الذي وُلد منه هذا الملفّ قياسٌ لا رأي: كان `on.push` يشمل
   `claude/**` و`on.pull_request` يشمل كلَّ طلب، ففرعٌ عليه طلبٌ مفتوحٌ يُشغّل
   الحزمةَ **مرّتَين** على الدفعة الواحدة — أربعُ وظائف بدل اثنتين. وحزمةُ
   اختبارات الخادم تُشغَّل مرّتين على العتاد نفسِه فتتقاسمانه: وظيفةٌ قِيست
   ثلاثةَ عشرَ دقيقة في التشغيل الأوّل صارت **أربعا وعشرين** في نظيرتها
   المتزامنة.

   و`concurrency` لم يمنعها: مفتاحُها كان `github.ref`، وهو يختلف بين الحدثَين
   (`refs/heads/claude/…` مقابل `refs/pull/15/merge`) — فمجموعتان لا واحدة.

   والحرسُ مصدريٌّ لأنّ الأثرَ ليس فشلا يُرى في اختبار: كلُّ شيءٍ أخضر،
   والثمنُ دقائقُ ووقتُ مُشغِّلٍ يُدفعان مرّتين. ومن أعاد `claude/**` إلى
   `on.push` غدا لن يُسقط شيئا — إلّا هذا. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')

/** كتلةُ `on:` وحدَها — إلى أوّل مفتاحٍ في الجذر بعدها */
const onBlock = /^on:\n((?:[ \t]+.*\n|\n)*)/m.exec(ci)?.[1] ?? ''

describe('CI تُشغَّل مرّةً واحدةً لكلّ دفعة', () => {
  it('كتلةُ `on:` موجودةٌ وتُقرأ', () => {
    expect(onBlock, 'تعذّر قراءةُ كتلة on من ci.yml').not.toBe('')
    expect(onBlock).toMatch(/pull_request/)
  })

  it('والدفعُ على `main` وحدَه — فلا يجتمع حدثان على فرعٍ له طلبٌ مفتوح', () => {
    const push = /push:\n((?:[ \t]{4,}.*\n)*)/.exec(onBlock)?.[1] ?? ''
    expect(push, 'لا كتلةَ push').not.toBe('')
    expect(push).toMatch(/branches:\s*\[\s*main\s*\]/)
    expect(push, "فرعٌ في on.push مع on.pull_request يعني تشغيلَين على الدفعة").not.toMatch(/claude/)
  })

  it('ومفتاحُ التزاحم الالتزامُ لا المرجع', () => {
    const group = /group:\s*(.+)/.exec(ci)?.[1] ?? ''
    expect(group).toMatch(/head\.sha/)
    expect(group, 'github.ref يختلف بين حدثَي الدفع والطلب فلا يوحّدهما').not.toMatch(/github\.ref/)
  })

  it('والوظيفتان اثنتان بقصد — سريعةٌ بلا قاعدة، وخادمٌ بقاعدة حقيقيّة', () => {
    /* كتلةُ `jobs:` وحدَها — مفاتيحُ المستوى الثاني في غيرها ليست وظائف */
    const jobsBlock = /^jobs:\n((?:[ \t]+.*\n|\n)*)/m.exec(ci)?.[1] ?? ''
    expect(jobsBlock, 'تعذّر قراءةُ كتلة jobs').not.toBe('')
    const jobs = [...jobsBlock.matchAll(/^ {2}(\w+):$/gm)].map((m) => m[1])
    expect(jobs).toEqual(['fast', 'server'])
  })
})
