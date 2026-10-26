/* قصّةُ العقد في سطر — في «الاتفاقية» من ملفّ المدرّب (٢٦ أكتوبر ٢٠٢٦).

   المرحلةُ الرابعةُ من مقترح لوحة الإدارة (3c): «قصّةُ العقد في سطرٍ واحد، وتحته طلبُ التعديل وجوابُه». وكان الملفُّ
   يقول حالَ العقد وحدَه («أرسل — بانتظار توقيعه») ولا يقول متى أُرسل ولا هل فتحه — فيُسأل عنه في «العقود».

   والوقائعُ من أعمدة العقد نفسِها بترتيب وقوعها، وما لم يقع لا يُذكر. وأسماؤها مصادرُ لا أفعال: «أرسل» بلا تشكيلٍ
   تُقرأ أمرا («أرسِل!») وخبرا معا، و«إرساله» لا تُقرأ إلّا خبرا. */

import { CONTRACT_AMENDMENT_REQUESTED } from './contract-endings'

type DateLike = string | Date | null | undefined

export interface ContractStoryInput {
  createdAt?: DateLike
  sentAt?: DateLike
  firstOpenedAt?: DateLike
  amendmentRequestedAt?: DateLike
  declinedAt?: DateLike
  signedAt?: DateLike
  signatureApprovedAt?: DateLike
  countersignedAt?: DateLike
  revokedAt?: DateLike
}

export interface ContractStoryEvent {
  key: keyof ContractStoryInput
  ar: string
  at: string | Date
}

/** بترتيب وقوعها المعتاد — ويُرتَّب ما وقع بتاريخه، والتعادلُ لهذا الترتيب (تركيبٌ وإرسالٌ بنقرةٍ واحدة) */
const EVENTS: readonly (readonly [keyof ContractStoryInput, string])[] = [
  ['createdAt', 'تجهيزه'],
  ['sentAt', 'إرساله'],
  ['firstOpenedAt', 'فتحه'],
  ['amendmentRequestedAt', 'طلب تعديله'],
  ['declinedAt', 'اعتذاره'],
  ['signedAt', 'توقيعه'],
  ['signatureApprovedAt', 'اعتماد توقيعه'],
  ['countersignedAt', 'توقيعنا'],
  ['revokedAt', 'إلغاؤه'],
]

const time = (d: string | Date) => new Date(d).getTime()

/** ما وقع للعقد، بتاريخه وبترتيب وقوعه */
export function contractStoryOf(c: ContractStoryInput): ContractStoryEvent[] {
  return EVENTS
    .flatMap(([key, ar]) => {
      const at = c[key]
      return at ? [{ key, ar, at }] : []
    })
    .sort((a, b) => time(a.at) - time(b.at))
}

/* ═══ وطلبُ التعديل وجوابُه — تحت سطره ═══

   طلبُ التعديل يُكتب على العقد الذي طُلب فيه. فإن قُبل أُلغي ذاك ورُكّب بديلٌ يحمل `replacesContractId`، فيبقى
   الطلبُ وجوابُه على السلف — وبلا قراءته لا يقول البديلُ لماذا وُلد. وإن رُدّ عليه بلا بديلٍ بقي جوابُه على العقد نفسِه.
   فلكلّ عقدٍ طلبُه هو، وطلبُ سلفه المسجَّل — لا تخمينٌ بقرينة وقت (علّتُه في `contract-lineage.ts`). */

export interface AmendmentFacts {
  id: string
  status: string
  replacesContractId?: string | null
  amendmentRequestAr?: string | null
  amendmentRequestedAt?: DateLike
  amendmentReplyAr?: string | null
  amendmentRepliedAt?: DateLike
}

export interface AmendmentLine {
  /** طلبُ سلفه الذي وُلد منه هذا العقد — لا طلبٌ عليه هو */
  previous: boolean
  requestAr: string
  requestedAt: DateLike
  replyAr: string | null
  repliedAt: DateLike
  /** ينتظر جوابَنا الآن */
  pending: boolean
}

export function amendmentLinesOf(c: AmendmentFacts, all: readonly AmendmentFacts[]): AmendmentLine[] {
  const line = (x: AmendmentFacts, previous: boolean): AmendmentLine[] => (x.amendmentRequestAr
    ? [{
      previous,
      requestAr: x.amendmentRequestAr,
      requestedAt: x.amendmentRequestedAt,
      replyAr: x.amendmentReplyAr ?? null,
      repliedAt: x.amendmentRepliedAt,
      pending: !previous && x.status === CONTRACT_AMENDMENT_REQUESTED,
    }]
    : [])
  const parent = c.replacesContractId && c.replacesContractId !== c.id
    ? all.find((p) => p.id === c.replacesContractId)
    : undefined
  return [...(parent ? line(parent, true) : []), ...line(c, false)]
}
