/* لسانُ الصفحة في العنوان — فالرابطُ يفتحه، و«رجوع» يعود إليه (٢٤ أكتوبر ٢٠٢٦).

   كانت ألسنةُ الصفحات حالةً في الذاكرة (`useState`): من نسخ رابطَ «الاستردادات» لزميله فتح له
   «طلبات التسجيل»، ومن ضغط «رجوع» بعد أن بدّل اللسانَ خرج من الصفحة كلِّها. وهي من شكوى «اللوحة
   مشتّتة» في دراسة لوحة الإدارة، والمرحلةُ الثانيةُ من مقترحها: «الألسنةُ في العنوان».

   فاللسانُ `?tab=` في العنوان، وكلُّ تبديلٍ موضعٌ في التاريخ. والأوّلُ لا يُكتب: عنوانُ الصفحة
   بلا سؤالٍ يفتح لسانَها الأوّل كما كان، فلا يتغيّر رابطٌ قديم. وما ليس من ألسنتها — رابطٌ قديمٌ
   أو لسانٌ لا يملكه صاحبُ الجلسة — يفتح الأوّل، لا لوحا فارغا. وبقيّةُ ما في العنوان تبقى.

   والحسابُ دالّتان بلا React (`tabFromParams` و`paramsWithTab`) — تُفحصان وحدَهما
   (`tab-param.test.ts`)، والخطّافُ يصلهما بالعنوان. */

import { useCallback } from "react";
import { useSearchParams } from "react-router";

/** اللسانُ الذي يقوله العنوان — أو الأوّلُ إن لم يقل، أو قال ما ليس منها */
export function tabFromParams<K extends string>(params: URLSearchParams, tabs: readonly K[], first: K, name = "tab"): K {
  const asked = params.get(name);
  return asked !== null && (tabs as readonly string[]).includes(asked) ? (asked as K) : first;
}

/** العنوانُ بعد تبديل اللسان — والأوّلُ يُمحى، وبقيّةُ السؤال كما هي */
export function paramsWithTab(prev: URLSearchParams, next: string, first: string, name = "tab"): URLSearchParams {
  const out = new URLSearchParams(prev);
  if (next === first) out.delete(name);
  else out.set(name, next);
  return out;
}

export function useTabParam<K extends string>(
  /** ألسنةُ الصفحة التي يراها صاحبُ الجلسة */
  tabs: readonly K[],
  /** أوّلُها — ما يُفتح بلا سؤالٍ في العنوان */
  first: K,
  name = "tab",
): [K, (next: K) => void] {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParams(params, tabs, first, name);
  const setTab = useCallback((next: K) => {
    setParams((prev) => paramsWithTab(prev, next, first, name));
  }, [setParams, first, name]);
  return [tab, setTab];
}
