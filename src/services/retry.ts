/* ═══ نداءٌ يُعاد حين يخفق — لا «لا شيء» يبقى حتّى يحدّث القارئُ الصفحة (٢٠ أكتوبر ٢٠٢٦) ═══

   سأل صاحبُ المنصّة: «لماذا يجب أن أعمل رفرش كلّ مرّة لتظهر أسماءُ المدرّبين؟». وكانت صفحةُ الفريق
   تطلب قائمتَها مرّةً واحدة، وكلُّ إخفاقٍ — خادمٌ يُعاد تشغيلُه بعد نشرٍ (٥٠٢)، أو اتّصالٌ انقطع، أو
   حدُّ الطلبات (٤٢٩) — يصير قائمةً فارغة تقول «لم يعتمد نشر اسم مدرّب بعد». فلا شيءَ يعيد الطلبَ إلّا يدُه.

   والنشرُ التلقائيُّ يقع مرّاتٍ في اليوم، وفيه ثوانٍ تكون الواجهةُ الجديدةُ قائمةً والخادمُ لم يُقلع
   (`deploy/deploy.sh`). فالفواصلُ تغطّي نحو نصف دقيقة: أوّلُ إعادةٍ سريعة، وآخرُها بعد أن يكون قد قام. */

/** فواصلُ الإعادة بالمللي ثانية — بعد كلِّ إخفاقٍ واحدٌ منها، ثمّ يُسلَّم الخطأ */
export const RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 20_000] as const

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** ينادي `fn`، ويعيده بعد كلّ فاصلٍ حتّى ينجح أو تنفد الفواصل. و`alive` يوقفه حين يُغلق صاحبُه */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { delays?: readonly number[]; alive?: () => boolean } = {},
): Promise<T> {
  const delays = opts.delays ?? RETRY_DELAYS_MS
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      const wait = delays[attempt]
      if (wait === undefined || (opts.alive && !opts.alive())) throw err
      await sleep(wait)
      if (opts.alive && !opts.alive()) throw err
    }
  }
}
