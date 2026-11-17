/* `wajeezacademy.com/wa` — يفتح واتساب على رقم مستشار المنحة ورسالتُه جاهزة (١٧ نوفمبر ٢٠٢٦).
   والعلّةُ في `src/application/site/wa-start.ts`. ورابطٌ يُضغط تحت السطر لمن لم يفتح له واتساب وحدَه. */

import { useEffect, useState } from "react";
import { waHref, type WhatsAppNumbers } from "@/application/site/whatsapp";
import { waStartText } from "@/application/site/wa-start";
import { CONTACT } from "@/data/stories";

export default function WaStart() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const text = waStartText(window.location.search);
    const go = (numbers: WhatsAppNumbers) => {
      const to = waHref(numbers, "grant_advisor", CONTACT.whatsapp, text);
      setHref(to);
      if (to) window.location.replace(to);
    };
    fetch("/api/site/whatsapp")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { numbers?: WhatsAppNumbers } | null) => go(d?.numbers ?? {}))
      .catch(() => go({}));
  }, []);

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center p-6 text-center">
      <p className="text-read leading-8">
        نفتح لك واتساب…
        {href && <><br /><a href={href} className="font-bold text-teal-light-ink underline">اضغط هنا إن لم يفتح</a></>}
      </p>
    </main>
  );
}
