/* ═══ «شارك» — منصّةٌ يختارها، ومنشورٌ جاهزٌ لها (٢٦ أكتوبر ٢٠٢٦) ═══

   «عندما أضغط على شير يجب أن أختار ما بين إنستغرام وواتساب وفيسبوك وتيك توك ولينكدإن» (صاحب المنصّة). فلوحةٌ
   واحدة: معاينةُ الصورة بصيغتها (منشور · ستوري · كاروسيل)، وزرٌّ لكلّ منصّة، والنصُّ الجاهزُ لها تحتها.

   · **واتساب ولينكدإن وإكس** تُفتح بالنصّ كاملا (`shareUrl`).
   · **فيسبوك** يقبل الرابطَ وحدَه — فيُنسخ النصُّ قبل فتحه ويُقال له ليلصقه.
   · **إنستغرام وتيك توك** لا بابَ لهما من موقع: على الهاتف تُشارَك الصورُ من قائمة الهاتف نفسِها (`navigator.share`)
     فيختارهما منها؛ وعلى الحاسوب تُنزَّل الصورُ ويُنسخ النصّ. ويُقال له ما جرى في كلٍّ — لا يُترك يخمّن.

   والنصُّ والأبوابُ محضةٌ في `share-kit.ts`، والرسمُ في `share-art.ts`. */

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { staffControlCls } from "@/components/FormKit";
import TabBar from "@/components/ui/TabBar";
import { fmtDayMonth } from "@/application/text/format-ar";
import { SHARE_PLATFORMS, shareText, shareUrl, type ShareCourse, type SharePlatform } from "@/application/trainer/share-kit";
import { artPlan, drawArt, toFile, type ArtData } from "./share-art";

type Format = "post" | "story" | "carousel";
const FORMATS: { id: Format; label: string }[] = [
  { id: "post", label: "منشور" },
  { id: "story", label: "ستوري" },
  { id: "carousel", label: "كاروسيل" },
];

/** الصيغةُ التي تناسب كلَّ منصّة إن اختارها قبل أن يختار صيغة */
const FORMAT_OF: Record<SharePlatform, Format> = {
  whatsapp: "post", linkedin: "post", facebook: "post", x: "post", instagram: "carousel", tiktok: "story",
};

export interface ShareFace { name: string; photoUrl: string | null }

export default function ShareKit({ face, courses, url, code, fileStem }: {
  face: ShareFace;
  courses: ShareCourse[];
  url: string;
  code: { code: string; percentOff: number } | null;
  /** اسمُ الملفّات المنزَّلة */
  fileStem: string;
}) {
  const [platform, setPlatform] = useState<SharePlatform>("whatsapp");
  const [format, setFormat] = useState<Format>("post");
  const [previews, setPreviews] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const input = useMemo(() => ({ courses, url, code, dayAr: (iso: string) => fmtDayMonth(iso) }), [courses, url, code]);
  const art: ArtData = useMemo(() => ({
    name: face.name, photoUrl: face.photoUrl, courses, code,
    dayAr: (iso: string) => fmtDayMonth(iso), host: window.location.host,
  }), [face, courses, code]);
  const text = shareText(platform, input);
  const plan = artPlan(format, courses.length);

  /* المعاينةُ تُرسم لكلّ صيغة — والكاروسيلُ شرائحُه كلُّها */
  useEffect(() => {
    let live = true;
    void Promise.all(plan.map((p) => drawArt(p.kind, art, p.index)))
      .then((cs) => { if (live) setPreviews(cs.map((c) => c.toDataURL("image/png"))); })
      .catch(() => { if (live) setPreviews([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- الخطّةُ تُشتقّ من الصيغة وعدد الدورات
  }, [format, art]);

  const files = async () => Promise.all(plan.map(async (p, i) =>
    toFile(await drawArt(p.kind, art, p.index), `${fileStem}-${format}${plan.length > 1 ? `-${i + 1}` : ""}.png`)));

  const copyText = async () => { await navigator.clipboard?.writeText(text).catch(() => undefined); };

  const download = async () => {
    for (const f of await files()) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  };

  const pick = (p: SharePlatform) => {
    setPlatform(p);
    setFormat(FORMAT_OF[p]);
    setNote(null);
  };

  const share = async () => {
    setBusy(true);
    setNote(null);
    try {
      const door = shareUrl(platform, input);
      if (door) {
        /* فيسبوك يقبل الرابطَ وحدَه — فالنصُّ في الحافظة قبل فتحه */
        if (platform === "facebook") await copyText();
        window.open(door, "_blank", "noopener");
        setNote(platform === "facebook" ? "نسخنا النص — الصقه في المنشور" : null);
        return;
      }
      /* إنستغرام وتيك توك: من قائمة الهاتف إن قبلت الصور، وإلّا تنزيلٌ ونسخ */
      const fs = await files();
      if (navigator.canShare?.({ files: fs })) {
        await copyText();
        await navigator.share({ files: fs, text }).catch(() => undefined);
        setNote("نسخنا النص — الصقه تحت الصورة");
      } else {
        await download();
        await copyText();
        setNote(`نزلنا ${fs.length > 1 ? "الصور" : "الصورة"} ونسخنا النص — افتح ${platform === "instagram" ? "إنستغرام" : "تيك توك"} وانشرها`);
      }
    } finally {
      setBusy(false);
    }
  };

  const platformAr = SHARE_PLATFORMS.find((p) => p.id === platform)!.ar;

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* المعاينة — كما تُنشر */}
      <div>
        <TabBar ariaLabel="صيغة الصورة" value={format} onChange={setFormat}
          items={FORMATS.map((f) => ({ id: f.id, label: f.label }))} />
        <div className={`mt-3 flex gap-2 overflow-x-auto ${format === "story" ? "max-w-[16rem]" : ""}`}>
          {previews.length === 0
            ? <div className="aspect-square w-full animate-pulse rounded-xl bg-paper/60" aria-label="جار رسم الصورة" />
            : previews.map((src, i) => (
              <img key={i} src={src} alt={`معاينة ${FORMATS.find((f) => f.id === format)!.label}${previews.length > 1 ? ` ${i + 1}` : ""}`}
                className={`rounded-xl shadow-sm ring-1 ring-black/10 ${previews.length > 1 ? "w-48 shrink-0" : "w-full"}`} />
            ))}
        </div>
      </div>

      {/* المنصّة والنصّ */}
      <div>
        <p className="text-read font-bold">أين تنشر؟</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="المنصة">
          {SHARE_PLATFORMS.map((p) => (
            <Button key={p.id} size="sm" tone={platform === p.id ? "confirm" : "secondary"} type="button"
              aria-pressed={platform === p.id} onClick={() => pick(p.id)}>
              {p.ar}
            </Button>
          ))}
        </div>
        <label className="mt-3 block text-read font-bold" htmlFor={`${fileStem}-text`}>النص الجاهز لـ{platformAr}</label>
        <textarea id={`${fileStem}-text`} readOnly value={text} rows={7}
          className={`${staffControlCls} mt-1 w-full text-read leading-7`} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button tone="confirm" type="button" icon={Share2} loading={busy} onClick={() => void share()}>
            انشر على {platformAr}
          </Button>
          <Button tone="secondary" type="button" icon={Copy} onClick={() => { void copyText(); setNote("نسخنا النص"); }}>
            انسخ النص
          </Button>
          <Button tone="secondary" type="button" icon={Download} onClick={() => void download()}>
            {plan.length > 1 ? "نزل الصور" : "نزل الصورة"}
          </Button>
        </div>
        {note && <Inset as="p" role="status" className="mt-2 px-3 py-2 text-read text-teal-light-ink">{note}</Inset>}
      </div>
    </div>
  );
}
