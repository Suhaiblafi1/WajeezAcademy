/* عُدّةُ بلاك فرايدي في «شارك دوراتك» — رابطُ المدرّب إلى المنحة، والتصميمُ، ونصوصُه جاهزةً للنسخ (١٧ نوفمبر ٢٠٢٦).
   والعلّةُ في `src/application/trainer/bf-kit.ts`. ولا تظهر إلّا والمنحةُ مفتوحة: رابطٌ إلى منحةٍ أُغلقت لا يُنشر. */

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Megaphone } from "lucide-react";
import { apiGet } from "@/services/api";
import { Panel, Inset } from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { BF_KIT_DESIGNS, bfKitLink, bfKitTexts, bfLastDayAr } from "@/application/trainer/bf-kit";

interface BfCampaign { open: boolean; percentOff: number; maxCourses: number; closesAt: string | null }

export default function BlackFridayKit({ refCode, name }: { refCode: string; name?: string | null }) {
  const [campaign, setCampaign] = useState<BfCampaign | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void apiGet<{ campaign: BfCampaign }>("/api/public/grant/bf")
      .then((r) => { if (alive) setCampaign(r.campaign); })
      .catch(() => { if (alive) setCampaign(null); });
    return () => { alive = false };
  }, []);

  const link = bfKitLink(window.location.origin, refCode);
  const texts = useMemo(() => campaign && bfKitTexts({
    link, percentOff: campaign.percentOff, maxCourses: campaign.maxCourses,
    lastDayAr: campaign.closesAt ? bfLastDayAr(campaign.closesAt) : null, name,
  }), [campaign, link, name]);

  if (!campaign?.open || !texts) return null;

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    });
  };
  const CopyBtn = ({ k, text }: { k: string; text: string }) => (
    <Button size="sm" icon={copied === k ? Check : Copy} onClick={() => copy(k, text)}>
      {copied === k ? "تم النسخ" : "انسخ"}
    </Button>
  );

  return (
    <Panel as="section" className="mb-6" id="black-friday">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <Megaphone className="h-5 w-5 text-gold-ink" aria-hidden="true" />
        بلاك فرايدي: منحة {campaign.percentOff}% على كل الدورات
      </h2>
      <p className="mt-1 text-read leading-7 text-muted-foreground">
        انشرها في صفحاتك برابطك الخاص{campaign.closesAt ? `، حتى ${bfLastDayAr(campaign.closesAt)}` : ""}. والتصميم والنصوص جاهزة تحته.
      </p>

      <Inset className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span dir="ltr" className="break-all font-bold">{link}</span>
        <CopyBtn k="link" text={link} />
      </Inset>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {BF_KIT_DESIGNS.map((d) => (
          <figure key={d.key} className="grid gap-2">
            <img src={d.src} alt={`تصميم ${d.labelAr} بلاك فرايدي`} loading="lazy" className="w-full rounded-lg" />
            <figcaption className="flex items-center justify-between gap-2 text-read text-muted-foreground">
              <span>{d.labelAr} · {d.size}</span>
              <Button as="a" size="sm" icon={Download} href={d.src} download>نزّل</Button>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {([
          ["social", "منشور", texts.social],
          ["email", `بريد · الموضوع: ${texts.emailSubject}`, texts.email],
          ["whatsapp", "واتساب", texts.whatsapp],
        ] as const).map(([k, label, text]) => (
          <div key={k}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-read font-bold">{label}</h3>
              <CopyBtn k={k} text={text} />
            </div>
            <Inset as="p" className="mt-2 whitespace-pre-line px-4 py-3 text-read leading-7">{text}</Inset>
          </div>
        ))}
      </div>
    </Panel>
  );
}
