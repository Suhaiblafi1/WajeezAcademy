/* «ما ينتظرك» لشارات الأقسام — يُجلب مرّةً في الدقيقة لا في كلّ شاشة (٢٤ أكتوبر ٢٠٢٦).

   الإطارُ يُركَّب من جديدٍ مع كلّ شاشةٍ في لوحة الإدارة، و«ما ينتظرك» يجمع طوابيرَ المنصّة كلَّها
   (`staff-inbox.service.ts`) — فنداؤه في كلّ انتقالٍ بين ألسنة قسمٍ حِملٌ بلا خبرٍ جديد. فيُحفظ
   الوعدُ دقيقةً، ولصاحب الجلسة وحدَه: الخروجُ لا يعيد تحميلَ الصفحة، فمن دخل بعده على الجهاز
   نفسِه لا يرى أعدادَ غيره.

   ويسقط صامتا: شارةٌ غائبةٌ أهونُ من خطأٍ يُعرَض في كلّ شاشة. */

import { apiGet } from "./api";

export interface InboxCount {
  href: string;
  count: number;
}

const FRESH_MS = 60_000;

let cached: { userId: string; at: number; counts: Promise<InboxCount[]> } | null = null;
/* وآخرُ جوابٍ وصل — يُرسم به أوّلُ إطارٍ في الشاشة التالية، فلا تقفز الألسنةُ حين يصل العدد */
let known: { userId: string; counts: InboxCount[] } | null = null;

export function loadInboxCounts(userId: string, now = Date.now()): Promise<InboxCount[]> {
  if (!cached || cached.userId !== userId || now - cached.at > FRESH_MS) {
    const counts = apiGet<InboxCount[]>("/api/staff/inbox").catch(() => []);
    cached = { userId, at: now, counts };
    void counts.then((c) => { known = { userId, counts: c }; });
  }
  return cached.counts;
}

/** ما عُرف آخرَ مرّةٍ لصاحب الجلسة — أو لا شيء */
export function knownInboxCounts(userId: string | undefined): InboxCount[] | undefined {
  return userId && known?.userId === userId ? known.counts : undefined;
}

/** للاختبارات — ولمن قضى في طابورٍ فأراد العددَ الجديدَ قبل أن تمضي الدقيقة */
export function forgetInboxCounts(): void {
  cached = null;
  known = null;
}
