/* ═══ العقدُ الذي مسّه توقيعٌ لا يُمَسّ ═══

   ─────────── السؤالُ الذي يجيب عنه ───────────

   **أمَسَّ هذا العقدَ توقيعٌ؟** ومن مسّه توقيعٌ صار وثيقةً يُحتَجّ بها لطرفٍ
   وعليه: تُقرأ بعد سنتين حين يُسأل عمّا التزم به الطرفان، ويُقابَل متنُها
   ببصمته. فلا يُحذف، ولا يُبدَّل متنُه، ولا يُعاد تركيبُه.

   ─────────── ولمَ شرطان لا واحد ───────────

   `signedAt`/`countersignedAt` تقول إنّ التوقيعَ **وقع فعلا**، والحالةُ تقول
   أين استقرّ الصفُّ بعده. وكلٌّ منهما يمسك ما يفلت من الآخر:

   · عقدٌ وُقّع ثمّ فُسخ حالتُه `terminated` لا `signed` — والتوقيعُ وقع.
   · وصفٌّ حالتُه `signed` وتاريخُه لم يُكتب لعطبٍ في هجرةٍ قديمة — والحكمُ
     أن يُصان لا أن يُمحى لأنّ عمودا فارغ.

   فالسلامةُ في اجتماعهما: ما أمسكه أحدُهما يُصان.

   ─────────── ولمَ هنا لا في الخدمة ───────────

   يقرؤه الحذفُ في `trainer-review.service.ts`، وسيقرؤه كلُّ ما يمسّ متنَ
   عقدٍ قائم. وحكمٌ كهذا مكتوبٌ مرّتين يفترق يوما — فيوقّع أحدُهما على ما
   يمنعه الآخر. */

export interface ContractSignatureFacts {
  status: string
  signedAt: Date | null
  countersignedAt: Date | null
}

/** الحالاتُ التي لا تكون إلّا بعد توقيع */
const SIGNED_STATUSES = ['signed', 'countersigned', 'terminated', 'superseded'] as const

export function isUntouchableContract(c: ContractSignatureFacts): boolean {
  if (c.signedAt !== null || c.countersignedAt !== null) return true
  return (SIGNED_STATUSES as readonly string[]).includes(c.status)
}
