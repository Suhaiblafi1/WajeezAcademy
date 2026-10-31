/* بطاقةُ «منحتك» في لوحة الطالب — كودُه وما بقي من دوراته، وأنّه يُطبَّق وحده عند الشراء (٣١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «امنحه فرصةَ استعمال الكود، أوضحه في المنصّة له، وفعّله تلقائيّا عند أيّ شراء». ولا كودَ =
   لا بطاقة. والكودُ يُطبَّق في لوح الشراء نفسِه (`BuyPanel`)، فلا يُطلب منه أن ينسخه. */

import { Link } from "react-router";
import { Gift } from "lucide-react";
import { Panel } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { useMyGrant } from "@/services/my-grant";

/** «دورة واحدة» و«دورتان» و«3 دورات» */
const coursesAr = (n: number) => (n === 1 ? "دورة واحدة" : n === 2 ? "دورتان" : `${n} دورات`);

export default function MyGrantCard({ className = "" }: { className?: string }) {
  const grant = useMyGrant();
  if (!grant?.code || grant.left === undefined) return null;
  return (
    <Panel as="section" tone="accent" className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Gift className="h-4 w-4 text-gold-ink" aria-hidden="true" /> {grant.nameAr}: <bdi dir="ltr">{grant.code}</bdi>
        </p>
        <p className="mt-1 text-read text-muted-foreground">
          بقي لك {coursesAr(grant.left)} من {grant.max} بخصم {grant.percentOff}٪. يطبق تلقائيا عند الشراء.
        </p>
      </div>
      <Button as={Link} to="/courses" tone="confirm" size="sm">تصفح الدورات</Button>
    </Panel>
  );
}
