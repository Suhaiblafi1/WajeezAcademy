/* الإجراءُ الجماعيّ — وصدقُ خبره.

   الخطرُ في «طبّق على المحدَّد» ليس في التنفيذ بل في الخبر بعده: عشرون صفّا
   يُطلب عليها الإجراء، ينجح ثمانيةَ عشرَ ويُردّ اثنان لحالٍ لا يسمح — فإن
   قيل «تمّ» ظنّ الموظّفُ أنّ العشرين مضت، ولا يكتشف الاثنين إلّا بمصادفة.

   فالقاعدة: يُنفَّذ واحدا واحدا (لا دفعةً متوازية على مسالكَ تمسّ المال
   وتكتب سجلّا)، ويُجمع أثرُ كلٍّ على حدة، ويُقال الرقمان معا. */

export interface BulkOutcome {
  ok: string[]
  failed: { id: string; message: string }[]
}

export async function runBulk(
  ids: readonly string[],
  apply: (id: string) => Promise<unknown>,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkOutcome> {
  const out: BulkOutcome = { ok: [], failed: [] }
  let done = 0
  for (const id of ids) {
    try {
      await apply(id)
      out.ok.push(id)
    } catch (err) {
      out.failed.push({ id, message: err instanceof Error ? err.message : 'سببٌ غير معروف' })
    }
    done += 1
    onProgress?.(done, ids.length)
  }
  return out
}

/** خبرٌ لا يبتلع الإخفاق — والسببُ الأوّلُ يُقال ليُعرف نوعُ المانع */
export function bulkMessage(outcome: BulkOutcome, doneVerbAr: string): string {
  const ok = outcome.ok.length
  const bad = outcome.failed.length
  if (bad === 0) return `${doneVerbAr} على ${ok}.`
  const first = outcome.failed[0].message
  if (ok === 0) return `لم يُنفَّذ على أيٍّ من ${bad} — أوّلُ سبب: ${first}`
  return `${doneVerbAr} على ${ok}، وتعذّر على ${bad} — أوّلُ سبب: ${first}`
}
