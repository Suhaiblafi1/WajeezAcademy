/* كلماتُ خانة الحساب البنكيّ — لكلّ من تُحوَّل إليه أموالُه كلماتُه. والخانةُ `components/BankAccountPanel.tsx`. */

export interface BankPanelCopy {
  /** ما يُحوَّل إليه — «مستحقّاتك» أو «عمولتك» */
  moneyAr: string
  /** ما يقال قبل إلغاء الحساب */
  noneUntilAr: string
  /** وبلا حساب */
  emptyAr: string
  /** أين يُعرف اسمُه — «في العقد» أو «في المنصة» */
  nameWhereAr: string
  /** آخرُ الإقرار بأنّه باسمه */
  consentTailAr: string
  /** متى يُفكّ */
  sealedAr: string
}

export const BANK_COPY: Record<"trainer" | "advisor", BankPanelCopy> = {
  trainer: {
    moneyAr: "مستحقّاتك",
    noneUntilAr: "ولا يصرف لك مستحقّ حتّى تدخل غيره.",
    emptyAr: "لم تدخل حسابك بعد، ولا يصرف مستحقّ قبله.",
    nameWhereAr: "في العقد",
    consentTailAr: "ولا تحوّل المستحقّات إلى حساب غيري.",
    sealedAr: "ولا يفتح إلّا عند تحويل مستحقّ معتمد.",
  },
  advisor: {
    moneyAr: "عمولتك",
    noneUntilAr: "ولا تصرف لك عمولة حتّى تدخل غيره.",
    emptyAr: "لم تدخل حسابك بعد، ولا تصرف عمولتك قبله.",
    nameWhereAr: "في المنصة",
    consentTailAr: "ولا تحوّل العمولة إلى حساب غيري.",
    sealedAr: "ولا يفتح إلّا عند صرف كشف معتمد.",
  },
}
