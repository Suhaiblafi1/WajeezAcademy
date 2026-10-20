/* «قرأ شيئا في صندوقه» — خبرٌ بين الصندوق والجرس (٢٠ أكتوبر ٢٠٢٦).

   كان الجرسُ يعدّ غيرَ المقروء كلَّ دقيقة، فمن قرأ رسائله في «الرسائل والتنبيهات» يرى شارتَه على
   عددها القديم دقيقةً كاملة — كأنّ القراءةَ لم تُحفظ. فالصندوقُ يُعلن، والجرسُ يعيد العدَّ فورا. */

const EVENT = 'wajeez:inbox-read'

/** يُنادى بعد أن يحفظ الخادمُ القراءة */
export function announceInboxRead(): void {
  window.dispatchEvent(new Event(EVENT))
}

/** يشترك فيه الجرس — ويعيد ما يُلغي الاشتراك */
export function onInboxRead(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
