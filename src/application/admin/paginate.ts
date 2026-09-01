/* ترقيمُ صفحاتٍ لا يضيع فيه صفّ.

   المزلقُ الوحيد أن تُرشَّح القائمةُ والصفحةُ الحاليّة أبعدُ من آخرها، فيرى
   الباحثُ فراغا ويظنّ ألّا نتيجة — ولها نتيجةٌ في الصفحة الأولى. فالصفحةُ
   تُلجَم إلى المدى الموجود دائما، ولا يُترك ذلك لمن ينادي. */

export interface Page<T> {
  rows: T[]
  page: number
  pages: number
  total: number
  from: number
  to: number
}

export function paginate<T>(rows: readonly T[], page: number, size: number): Page<T> {
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages)
  const start = (current - 1) * size
  return {
    rows: rows.slice(start, start + size),
    page: current,
    pages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  }
}
