/* وسمُ القسم — حبّةٌ صغيرة فوق كلّ عنوانٍ في الرئيسيّة.

   في ملفٍّ وحدَه لأنّه يُقرأ من الرئيسيّة ومن أقسامها المنقولة معا، ونسخُه
   في الاثنين يجعل تغييرَ الحبّة تغييرَين. */

import { Sparkles } from "lucide-react"

export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-4 py-1.5 text-sm text-teal-light-ink">
      <Sparkles className="h-3.5 w-3.5" />
      {children}
    </div>
  )
}
