/* حذفُ الحسابات جملةً — قسمةٌ واحدةٌ يقرؤها الخادمُ والشاشة (القسم ل).

   ═══ والمعاينةُ هي البند، لا الحذف ═══

   الحذفُ ليس متماثلا: الحسابُ الذي يحمل شهادةً أو طلبَ شراءٍ أو تسجيلا
   **يُرفض حذفُه** — والسببُ مكتوبٌ في المخطّط: الشهادةُ «دعوى مستقلّةٌ عن
   المنصّة على صاحبها»، ومحوُها يكسر رابطَ تحقّقٍ لإنسانٍ حقيقيّ.

   فمن اختار أربعين وضغط «احذف» لن يُحذف له أربعون. تُحذف الفارغةُ وتُردّ
   البقيّة — **ورسالةُ «تمّ» واحدةٌ كذبٌ**. فالشاشةُ تقول قبل أن يقع شيء:
   هؤلاء الواحدُ والثلاثون يُحذفون، وهؤلاء التسعةُ لا، وهذا ما يحمله كلٌّ
   منهم. تلك هي الميزة، والحذفُ نصفُها الأسهل.

   ═══ ولمَ «آخرُ مديرِ نظامٍ أعلى» يُحسب على الدفعة لا على الحساب ═══

   لو سُئل كلُّ حسابٍ وحدَه «أأنت الأخير؟» لأجاب اثنان من اثنين «لا، ثمّة
   غيري» — فيُحذفان معا ولا يبقى أحد. فالحسابُ يُقاس بما **يبقى بعد الدفعة
   كلِّها**، لا بما يبقى بعده وحدَه. وهذا عطبٌ لا يُرى إلّا بالتفكير فيه:
   الشرطُ الساذجُ يمرّ على كلّ حالةٍ مفردةٍ ويسقط على الدفعة. */

/** أكثرُ ما يُختار في مرّة — حاجزٌ على المدخَل لا رأيٌ في العمل */
export const MAX_BULK_PURGE = 200

export interface BulkTarget {
  id: string
  email: string
  displayName: string
  /** أدوارُ الحساب — تُقرأ منها «آخرُ مديرِ نظام» */
  roles: readonly string[]
  /** ما يحمله، بالعبارة التي تُقرأ لا بالعدد المجرّد */
  blockers: readonly string[]
}

export const TOP_ROLE = 'super_admin'

export interface BulkDecision {
  id: string
  /** أيُحذف؟ */
  deletable: boolean
  /** ولمَ لا — بعبارةٍ تقول السبب، لا «تعذّر الحذف» */
  whyAr: string | null
}

export interface BulkContext {
  /** من يضغط الزرّ — لا يحذف نفسَه */
  actorId: string
  /** عددُ مديري النظام الأعلى في المنصّة كلِّها قبل الدفعة */
  topAdminsBefore: number
}

/* ═══ القرار، حسابا حسابا وعلى الدفعة معا ═══

   ويُبنى على ترتيبٍ مقصود: الذاتُ أوّلا فهي أوضحُ ما يُمنع، ثمّ آخرُ مديرٍ
   أعلى فهو ما يقفل المنصّةَ على الجميع، ثمّ ما يحمله الحساب. */
export function decideBulk(
  targets: readonly BulkTarget[], ctx: BulkContext,
): BulkDecision[] {
  /* كم مديرا أعلى في هذه الدفعة — يُحسب مرّةً على الدفعة كلِّها */
  const topsInBatch = targets.filter((t) => t.roles.includes(TOP_ROLE)).length
  const topsAfter = ctx.topAdminsBefore - topsInBatch

  return targets.map((t) => {
    if (t.id === ctx.actorId) {
      return { id: t.id, deletable: false, whyAr: 'لا تحذف حسابَك من هنا' }
    }
    if (t.roles.includes(TOP_ROLE) && topsAfter < 1) {
      return {
        id: t.id,
        deletable: false,
        whyAr: 'لا يبقى النظامُ بلا مديرٍ أعلى — أبقِ واحدا على الأقلّ',
      }
    }
    if (t.blockers.length > 0) {
      return {
        id: t.id,
        deletable: false,
        whyAr: `له ${t.blockers.join('، و')} — أوقفه بدل ذلك، فيبقى السجلُّ ويُمنع الدخول`,
      }
    }
    return { id: t.id, deletable: true, whyAr: null }
  })
}

export function deletableIds(decisions: readonly BulkDecision[]): string[] {
  return decisions.filter((d) => d.deletable).map((d) => d.id)
}

/* ═══ والتأكيدُ يُكتب عددا لا كلمة ═══

   «اكتب delete» تُكتب بلا قراءة. والعددُ هو ما يستحقّ أن يُقرأ مرّتَين: من
   ظنّ أنّه يحذف ثلاثةً فرأى نفسَه يكتب ٣١ توقّف. */
export function bulkConfirmMatches(typed: string, count: number): boolean {
  const n = typed.trim()
  if (!/^\d+$/.test(n)) return false
  return Number(n) === count && count > 0
}

/** ما يمنع تنفيذَ الدفعة كلَّها — أو `null` فتُنفَّذ */
export function bulkExecuteBlockerAr(
  decisions: readonly BulkDecision[], typed: string,
): string | null {
  const n = deletableIds(decisions).length
  if (n === 0) return 'لا حسابَ في هذه الدفعة يُحذف'
  if (!bulkConfirmMatches(typed, n)) return `اكتب عددَ ما سيُحذف فعلا: ${n}`
  return null
}
