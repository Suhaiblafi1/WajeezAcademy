/* أيُّ إصدارِ وحدةٍ يجوز أن يُقرأ — قاعدةٌ واحدةٌ لا خمس.

   قرّاءُ الوحدات خمسةٌ متفرّقون: بانيةُ اللقطة المنشورة، والكتالوج العامّ،
   وبطاقاتُ المراجعة المتباعدة، والسيناريوهات، وبوابةُ المدرب. وكلُّهم كانوا
   يسألون عن «أحدث إصدار» بلا النظر في حالته — وهو صحيحٌ ما دامت المسوّدات
   لا وجود لها، وخطأٌ في اللحظة التي يصير فيها التأليفُ ممكنا: تصير المسوّدةُ
   هي الأحدثَ رقما، فتُنشر إلى المتعلّم في أوّل لقطة.

   ولا تُترك القاعدة نصّا مكرّرا في خمسة ملفّات: السادس يُنسى. */

/** الحالتان اللتان يجوز أن يراهما متعلّم — وما عداهما لا يخرج */
export const READABLE_MODULE_VERSION_STATUSES = ['published', 'approved'] as const

/**
 * شرطُ الإصدار المقروء في `include`/`where` — يُستعمل كما هو:
 * `versions: { ...readableModuleVersion(), take: 1 }`
 */
export function readableModuleVersion() {
  return {
    where: { status: { in: [...READABLE_MODULE_VERSION_STATUSES] } },
    orderBy: { version: 'desc' as const },
  }
}

/**
 * شرطُ الإصدار المقروء لوحدةٍ بعينها في `findFirst` — يُستعمل كما هو:
 * `courseModuleVersion.findFirst(readableVersionOf(moduleId))`
 */
export function readableVersionOf(moduleId: string) {
  return {
    where: { moduleId, status: { in: [...READABLE_MODULE_VERSION_STATUSES] } },
    orderBy: { version: 'desc' as const },
  }
}
