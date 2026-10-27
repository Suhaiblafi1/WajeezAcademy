/* ═══ «شارك» — منصّةٌ يختارها، ومنشورٌ جاهزٌ لها (٢٦ أكتوبر ٢٠٢٦) ═══

   «عندما أضغط على شير يجب أن أختار ما بين إنستغرام وواتساب وفيسبوك وتيك توك ولينكدإن» (صاحب المنصّة). فلوحةٌ
   واحدة: معاينةُ الصورة بصيغتها (منشور · ستوري · كاروسيل)، وزرٌّ لكلّ منصّة، والنصُّ الجاهزُ لها تحتها.

   · **واتساب ولينكدإن وإكس** تُفتح بالنصّ كاملا (`shareUrl`).
   · **فيسبوك** يقبل الرابطَ وحدَه — فيُنسخ النصُّ قبل فتحه ويُقال له ليلصقه.
   · **إنستغرام وتيك توك** لا بابَ لهما من موقع: على الهاتف تُشارَك الصورُ من قائمة الهاتف نفسِها (`navigator.share`)
     فيختارهما منها؛ وعلى الحاسوب تُنزَّل الصورُ ويُنسخ النصّ. ويُقال له ما جرى في كلٍّ — لا يُترك يخمّن.

   والنصُّ والأبوابُ محضةٌ في `share-kit.ts`، والرسمُ في `share-art.ts`.

   ═══ واللوحةُ نفسُها للمؤثّر (٢٦ أكتوبر ٢٠٢٦) ═══

   «امنح المؤثّرَ تصاميمَ يشاركها… كما فعلنا للمدرّب» (صاحب المنصّة). فالأبوابُ والصيغُ وما يُقال قبل الضغط واحدة،
   ويتغيّر المحتوى وحدَه: `content` يمرّر نصَّ المنحة وصورَها (`influencer-share.ts` و`influencer/grant-art.ts`)،
   وبلا `content` محتوى المدرّب كما كان. */

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Inset } from "@/components/ui/Surface";
import { staffControlCls } from "@/components/FormKit";
import TabBar from "@/components/ui/TabBar";
import { fmtDayMonth } from "@/application/text/format-ar";
import { emailSubject, manualNoteAr, SHARE_MODES, SHARE_PLATFORMS, shareText, shareUrl, type ShareCourse, type ShareMode, type SharePlatform } from "@/application/trainer/share-kit";
import { artPlan, drawArt, toFile, type ArtData, type ArtKind } from "./share-art";
import { withVia } from "@/application/links/share-via";

export type Format = "post" | "story" | "carousel";
const FORMATS: { id: Format; label: string }[] = [
  { id: "post", label: "منشور" },
  { id: "story", label: "ستوري" },
  { id: "carousel", label: "كاروسيل" },
];

/** الصيغةُ التي تناسب كلَّ منصّة إن اختارها قبل أن يختار صيغة */
const FORMAT_OF: Record<SharePlatform, Format> = {
  whatsapp: "post", linkedin: "post", facebook: "post", x: "post", instagram: "carousel", tiktok: "story", email: "post",
};

export interface ShareFace { name: string; headline?: string | null; photoUrl: string | null }

/** محتوى غيرُ دورات المدرّب — نصُّه لكلّ منصّة، وعنوانُ بريده، وبابُ كلّ منصّة، وصورُه لكلّ صيغة */
export interface ShareContent {
  text: (p: SharePlatform) => string;
  subject: () => string;
  door: (p: SharePlatform) => string | null;
  plan: (f: Format) => { kind: string; index: number }[];
  draw: (kind: string, index: number) => Promise<HTMLCanvasElement>;
  /** ما يتغيّر الرسمُ بتغيّره */
  key: string;
}

export default function ShareKit({ face, courses, url, code, fileStem, content }: {
  face: ShareFace;
  courses: ShareCourse[];
  url: string;
  code: { code: string; percentOff: number } | null;
  /** اسمُ الملفّات المنزَّلة */
  fileStem: string;
  content?: ShareContent;
}) {
  const [platform, setPlatform] = useState<SharePlatform>("whatsapp");
  const [format, setFormat] = useState<Format>("post");
  const [previews, setPreviews] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* ═══ إعلانُ انضمامه أو دعوةٌ لدوراته، ونصُّه بيده (٢٧ أكتوبر ٢٠٢٦) ═══
     «منهم من يريد أن يقول: سعيد بانضمامي لأكاديمية وجيز كمدرّبة في مجال كذا» — فيختار نوعَ منشوره، والنصُّ يُعدَّل
     قبل نشره، وما عدّله هو ما يُنسخ ويُفتح به بابُ المنصّة (`shareUrl`). وتبديلُ المنصّة أو النوع يعيد نصَّنا */
  const [mode, setMode] = useState<ShareMode>("join");
  const [draft, setDraft] = useState<string | null>(null);

  /* والرابطُ يحمل منصّتَه (`?p=wa`) — فيُقال للمدرّب تحت رابطه من أيّ منصّةٍ فُتح (`share-via.ts`) */
  const input = useMemo(() => ({
    courses, url: withVia(url, platform), code, dayAr: (iso: string) => fmtDayMonth(iso), signature: face.name, mode, headline: face.headline,
  }), [courses, url, platform, code, face.name, face.headline, mode]);
  /* ═══ أيرفق جهازُه الصورةَ بنفسه؟ (٢٦ أكتوبر ٢٠٢٦) ═══
     «هل يمكن أن تُرفق الصورةُ تلقائيّا عند النشر؟» — نعم حيث يقبل الجهازُ مشاركةَ الصور (الهاتف): قائمةُ المشاركة
     تحملها مع النصّ إلى أيّ منصّة. ويُسأل الجهازُ مرّةً بصورةٍ صغيرة (`manualNoteAr`) */
  const [canAttach, setCanAttach] = useState(false);
  useEffect(() => {
    try {
      const probe = new File([new Blob(["x"], { type: "image/png" })], "p.png", { type: "image/png" });
      setCanAttach(Boolean(navigator.canShare?.({ files: [probe] })));
    } catch { setCanAttach(false); }
  }, []);
  const art: ArtData = useMemo(() => ({
    name: face.name, headline: face.headline ?? null, photoUrl: face.photoUrl, courses, code,
    dayAr: (iso: string) => fmtDayMonth(iso),
  }), [face, courses, code]);
  const ours = content ? content.text(platform) : shareText(platform, input);
  const text = !content && draft !== null ? draft : ours;
  const plan: { kind: string; index: number }[] = content ? content.plan(format) : artPlan(format, courses.length);
  const draw = (kind: string, index: number) => (content ? content.draw(kind, index) : drawArt(kind as ArtKind, art, index));
  const subject = () => (content ? content.subject() : emailSubject(input));
  const door = (p: SharePlatform) => (content ? content.door(p) : shareUrl(p, input, text));

  /* المعاينةُ تُرسم لكلّ صيغة — والكاروسيلُ شرائحُه كلُّها */
  useEffect(() => {
    let live = true;
    void Promise.all(plan.map((p) => draw(p.kind, p.index)))
      .then((cs) => { if (live) setPreviews(cs.map((c) => c.toDataURL("image/png"))); })
      .catch(() => { if (live) setPreviews([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- الخطّةُ والرسمُ يُشتقّان من الصيغة والمحتوى
  }, [format, art, content?.key]);

  const files = async () => Promise.all(plan.map(async (p, i) =>
    toFile(await draw(p.kind, p.index), `${fileStem}-${format}${plan.length > 1 ? `-${i + 1}` : ""}.png`)));

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
    setDraft(null);
  };

  const share = async () => {
    setBusy(true);
    setNote(null);
    try {
      const fs = await files();
      const app = SHARE_PLATFORMS.find((p) => p.id === platform)!.ar;
      /* الهاتف: قائمةُ المشاركة تحمل الصورةَ والنصَّ معا إلى المنصّة التي يختارها */
      if (canAttach && navigator.canShare?.({ files: fs })) {
        await copyText();
        await navigator.share({ files: fs, text, title: platform === "email" ? subject() : undefined }).catch(() => undefined);
        setNote(`اختر ${app} من القائمة — والنص منسوخ أيضا إن احتجته`);
        return;
      }
      /* الحاسوب: المنشورُ يُفتح بنصّه، والصورةُ تُنزَّل ليرفقها — فلا منصّةَ تقبلها من موقعٍ آخر */
      const opens = door(platform);
      await download();
      if (opens) {
        if (platform === "facebook") await copyText();
        if (platform === "email") window.location.href = opens;
        else window.open(opens, "_blank", "noopener");
        setNote(platform === "facebook"
          ? "نزلنا الصورة ونسخنا النص — أرفق الصورة والصق النص في المنشور"
          : `نزلنا ${fs.length > 1 ? "الصور" : "الصورة"} — أرفقها في ${platform === "email" ? "الرسالة" : "المنشور"}`);
        return;
      }
      await copyText();
      setNote(`نزلنا ${fs.length > 1 ? "الصور" : "الصورة"} ونسخنا النص — افتح ${app} وانشرها`);
    } finally {
      setBusy(false);
    }
  };

  const platformAr = SHARE_PLATFORMS.find((p) => p.id === platform)!.ar;

  return (
    <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* المعاينة — كما تُنشر.
          و`min-w-0` على العمودين (٢٦ أكتوبر ٢٠٢٦): عمودُ الشبكة يتّسع لأعرض ما فيه، فشرائحُ الكاروسيل
          وصفُّ المنصّات كانت تدفع اللوحةَ خارجَ شاشة الهاتف — وصارت مفتوحةً أوّلَ الصفحة فتُرى. */}
      <div className="min-w-0">
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
      <div className="min-w-0">
        {!content && (
          <>
            <p className="mb-2 text-read font-bold">ماذا تنشر؟</p>
            <TabBar ariaLabel="نوع المنشور" value={mode} onChange={(m) => { setMode(m); setDraft(null); }}
              items={SHARE_MODES.map((m) => ({ id: m.id, label: m.ar }))} className="mb-4" />
          </>
        )}
        <p className="text-read font-bold">أين تنشر؟</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="المنصة">
          {SHARE_PLATFORMS.map((p) => (
            <Button key={p.id} size="sm" tone={platform === p.id ? "confirm" : "secondary"} type="button"
              aria-pressed={platform === p.id} onClick={() => pick(p.id)}>
              {p.ar}
            </Button>
          ))}
        </div>
        {/* ═══ وما لا يُنشر منه مباشرةً يُقال قبل الضغط (٢٦ أكتوبر ٢٠٢٦) ═══
            «للوسائل التي لا تسمح بالنشر المباشر يجب إبلاغ المدرّب أنّه يقوم بها يدويّا» (صاحب المنصّة). */}
        {manualNoteAr(platform, canAttach) && (
          <Inset as="p" tone={canAttach ? "default" : "warn"} className="mt-3 px-3 py-2 text-read leading-6">{manualNoteAr(platform, canAttach)}</Inset>
        )}
        {platform === "email" && (
          <p className="mt-3 text-read"><b>العنوان:</b> {subject()}</p>
        )}
        <label className="mt-3 block text-read font-bold" htmlFor={`${fileStem}-text`}>{platform === "email" ? "نص الرسالة" : `النص الجاهز لـ${platformAr}`}</label>
        <textarea id={`${fileStem}-text`} readOnly={Boolean(content)} value={text} rows={9}
          onChange={(e) => setDraft(e.target.value)}
          className={`${staffControlCls} mt-1 w-full text-read leading-7`} />
        {!content && (
          <p className="mt-1 text-read text-muted-foreground">
            عدل النص كما تحب قبل النشر.
            {draft !== null && draft !== ours && (
              <button type="button" className="ms-2 font-bold text-teal-light-ink underline" onClick={() => setDraft(null)}>أعد النص الأصلي</button>
            )}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button tone="confirm" type="button" icon={Share2} loading={busy} onClick={() => void share()}>
            {platform === "email" ? "افتح بريدي" : `انشر على ${platformAr}`}
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
