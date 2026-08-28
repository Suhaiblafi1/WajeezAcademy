/* حفظ مسار سمّاه متعلم — اسمه وقائمة دوراته لا غير.

   القيمة: مئة دورة في الكتالوج وستة عشر قالبا مركّبا يغطيان واحدا وثلاثين زوجا
   من المجالات. أما ما يركّبه المتعلمون لأنفسهم فهو الطلب الحقيقي معلَنا بلسانهم،
   وكان يُفقد لحظة إغلاق التبويب. يُحفظ ليُقرأ لاحقا: ما تكرر منه يستحق أن يصير
   مسارا معتمدا للعامة.

   ما لا يُرسل: لا بريد ولا اسم ولا أي شيء عن الشخص. الاسم الذي يكتبه هو اسم
   المسار لا اسمه هو. والإخفاق لا يوقف الشراء — الحفظ خدمةٌ لنا لا شرطٌ عليه. */

export interface PathDraftInput {
  name: string
  courseIds: string[]
}

export async function savePathDraft(input: PathDraftInput): Promise<boolean> {
  const name = input.name.trim()
  if (name.length < 3 || input.courseIds.length === 0) return false
  try {
    const res = await fetch('/api/path-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.slice(0, 80), courseIds: input.courseIds.slice(0, 12) }),
    })
    return res.ok
  } catch {
    /* بلا شبكة أو بلا خادم — لا يُعطَّل شيء مما يخصّ المتعلم */
    return false
  }
}
