/* ⚠️ زرُّ shadcn الموروث — لا يُستعمل في جديد.
 *
 * سُمّي `button.tsx` فتعارض مع `Button.tsx` (زرُّ المنصّة): TypeScript يرفض
 * ملفَّين لا يفترقان إلّا بحالة الحرف. فأُعيدت تسميتُه إلى ما هو: موروثٌ
 * تستعمله سبعُ شاشاتٍ بواجهة shadcn (`variant` و`size`)، ولم تُتبنَّ في
 * غيرها — ثمانيةُ ملفّاتٍ من ١٦٥ في يومِ القياس.
 *
 * والجديدُ يستعمل `@/components/ui/Button`: سلّمُ أهمّيّةٍ بلغة المنصّة
 * (ذهبيٌّ رئيسيّ · فيروزيٌّ مُثبِت · حدٌّ بديل)، وفيه حلقةُ تركيزٍ وحالةُ
 * انتظارٍ معلَنة. وترحيلُ السبعِ إليه دفعةٌ قادمة — ولا يُخلَط النوعان في
 * ملفٍّ واحد.
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button-variants"

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
