/* ═══ ما يقوله رابطُ العقد — حيّا كان أو قديما (١ أكتوبر ٢٠٢٦) ═══

   طلبُ صاحب المنصّة: «when someone has expired link, they know the exact
   reason whether expired or signed… for the signed ones, they should still
   see the contract locked for reading».

   وكان رابطُ العقد يُقرأ من `TrainerContract.tokenHash` وحدَه — وهو يحمل الحيَّ
   ويُكتب فوقه كلّما سُكّ غيرُه. فكلُّ رابطٍ قديمٍ (قبل «جدِّدِ الرابط» أو
   التذكير الأخير أو طلبِه ببريده) يُقال له «غيرُ صالح» ولا يُدرى لأيّ عقد. وكلُّ
   عقدٍ جاوز «وُقّع» — اعتمدناه، أو أزاحه أحدثُ منه، أو انتهى — كان يُقال لرابطه
   «انتهى هذا الرابط: إمّا اعتُذر أو سُحب أو…»: من وقّع وخُتم عقدُه يقرأ أنّه
   ربّما اعتذر.

   فصار كلُّ رمزٍ يُصرف يُحفَظ (`TrainerContractLink`)، وصار الرابطُ يقول حالَ
   عقده **بحالٍ واحدةٍ مسمّاة** من القائمة أدناه، برقم العقد وتواريخه. وهذا
   الملفُّ هو العقدُ بين الخادم وصفحة التوقيع: ما يردّه الأوّلُ تسمّيه الثانية،
   ولكلّ حالٍ رأسٌ وجملة (`src/tests/trainer/contract-link-states-page.test.ts`).

   ── وما يُعرَض من المتن ──

   المتنُ المقفلُ للقراءة لعقدٍ **وُقّع** (`signedAt`) وحدَه — نافذا كان أو
   منتهيا أو أزاحه أحدث. أمّا ما لم يُوقَّع فلا متنَ على بابه المغلق، كما كان
   (`closed-doors-say-which.test.ts`). ولا يُعرَض المتنُ على رابطٍ قديمٍ ذهب إلى
   **غير بريد الرابط الحيّ** — فيُقال الحالُ وحدَها (`detailed: false`): من صُحّح
   بريدُه بعد خطإٍ لا يقرأ عقدَه من وصله الأوّل. */

/** لماذا صُرف رمزٌ — وتطابقه قائمةُ التعليق في المخطّط وقيدُ القاعدة */
export const CONTRACT_LINK_PURPOSES = [
  'sent', 'resend', 'final_reminder', 'link_request', 'amendment_reply',
] as const
export type ContractLinkPurpose = (typeof CONTRACT_LINK_PURPOSES)[number]

/** حالُ رابطٍ لا يُوقَّع منه — ولكلٍّ منها رأسٌ وجملةٌ في صفحة التوقيع */
export const CONTRACT_CLOSED_STATES = [
  /** عرضٌ مرسَلٌ انقضى أجلُ رابطه */
  'expired',
  /** رابطٌ قديمٌ والعرضُ ما زال ينتظر — بُعث بعده رابطٌ أحدث */
  'replaced',
  /** وقّعه، وينتظر اعتمادَنا */
  'signed',
  /** وقّعه واعتمدناه — نافذ */
  'countersigned',
  /** كان نافذا فحلّ محلَّه عقدٌ أحدثُ اعتُمد */
  'superseded',
  /** كان نافذا فانتهى */
  'terminated',
  'declined',
  'revoked',
  'amendment_requested',
] as const
export type ContractClosedState = (typeof CONTRACT_CLOSED_STATES)[number]

/** الحالاتُ التي يُعرَض فيها المتنُ مقفلا — فكلُّها عقدٌ وُقّع */
export const SIGNED_COPY_STATES: readonly ContractClosedState[] = [
  'signed', 'countersigned', 'superseded', 'terminated', 'revoked',
]

/** العقدُ الذي حلّ محلَّ هذا — ليُقال رقمُه ومتى أُرسل */
export interface ContractSuccessor<D = string> {
  number: string
  title: string
  status: string
  sentAt: D | null
}

/** جوابُ الرابط حين لا يُوقَّع منه. وكلُّ حقلٍ لا يخصّ حالَه `null`.
 *  و`D` تاريخٌ في الخادم ونصٌّ بعد أن يعبر الشبكة. */
export interface ContractClosedView<D = string> {
  state: ContractClosedState
  number: string
  title: string
  /** رابطٌ قديم: متى بُعث بعده الأحدث — و`null` للرابط الحيّ */
  newerLinkAt: D | null
  /** `false`: رابطٌ قديمٌ ذهب إلى غير بريد الحيّ — فالحالُ وحدَها، بلا متن */
  detailed: boolean
  signedAt: D | null
  signerLegalName: string | null
  countersignedAt: D | null
  supersededAt: D | null
  terminatedAt: D | null
  declinedAt: D | null
  revokedAt: D | null
  /** سُحب بعد أن وقّعه ليُعاد إليه على نصٍّ محدَّث — لا لعيبٍ فيه */
  revokedForResign: boolean
  requestedAt: D | null
  /** نصُّ طلبه بالتعديل — كتبه هو، ويُعاد إليه على رابطه */
  requestAr: string | null
  expiredAt: D | null
  /** انقضى بعد التذكير الأخير — فلا يُطلب رابطُه ببريده (`requestContractLink`) */
  afterFinalReminder: boolean
  successor: ContractSuccessor<D> | null
  bodyAr: string | null
  bodyHash: string | null
}

/** حالُ الرابط من صفّ عقده — أو `null` لرابطٍ حيٍّ مفتوحٍ للتوقيع (أو لما لا بابَ له).
 *
 *  و`old`: الرابطُ ليس الحيَّ بل من السجلّ. فالعرضُ المرسَلُ يُقال لرابطه القديم
 *  «بُعث بعدك أحدث» ما دام الحيُّ قائما — وإلّا فقد انقضى العرضُ نفسُه. ولا
 *  يُفتَح رابطٌ قديمٌ للتوقيع أبدا. */
export function closedStateOf(
  c: { status: string; tokenExpiresAt: Date | null },
  opts: { old: boolean; now: Date },
): ContractClosedState | null {
  switch (c.status) {
    case 'signed':
    case 'countersigned':
    case 'superseded':
    case 'terminated':
    case 'declined':
    case 'revoked':
    case 'amendment_requested':
      return c.status
    case 'sent':
      if (c.tokenExpiresAt && c.tokenExpiresAt < opts.now) return 'expired'
      return opts.old ? 'replaced' : null
    default:
      /* مسوّدةٌ لا رابطَ لها، وما لا تعرفه القائمةُ لا يُسمّى بغير اسمه */
      return null
  }
}

/** بريدان لصندوقٍ واحد؟ — بلا نظرٍ إلى حالة الحرف ولا الفراغ حوله */
export function sameMailbox(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = a?.trim().toLowerCase()
  const y = b?.trim().toLowerCase()
  return Boolean(x) && x === y
}
