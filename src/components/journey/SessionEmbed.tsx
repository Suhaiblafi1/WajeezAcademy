/* فتحُ جلسة الشعبة داخلَ الموقع — Meeting SDK بعرضِ المكوّن (Component View).

   ── لماذا من CDN لا من npm ──

   `@zoom/meetingsdk@6.2.0` يثبّت ندَّه على React **18.2.0 بالضبط**، والمنصّة
   على 19. وتضييقُ الاستثناء لم يكفِ: `react-redux@8.1.2` ندٌّ للحزمة وهو
   نفسُه يرفض 19، فكلُّ استثناءٍ يكشف الذي تحته. والبديلُ الوحيدُ في npm هو
   `legacy-peer-deps` على المستودَع كلِّه — يُخرِس تعارضاتِ كلِّ حزمةٍ قادمة في
   مستودعٍ فيه مدفوعات. فالحزمةُ تُحمَّل من مصدر Zoom عند الطلب، ولا تدخل
   `package.json` أصلا: `npm ci` يبقى كما هو، ولا ١٠٧ ميغابايت في node_modules.

   ── ولا يُحمَّل شيءٌ قبل الضغط ──

   ثلاثةُ ميغابايتٍ لا تُنزَّل على من يقرأ صفحتَه ولا يحضر جلسة. فالسكربتُ
   يُحقن عند أوّل ضغطةٍ على «افتح هنا»، مرّةً واحدةً للصفحة.

   ── والرابطُ الخارجيُّ يبقى دائما ──

   هذا **إضافةٌ لا بديل**. إن أُطفئ المفتاحُ في الخادم، أو سقط التحميل، أو
   كانت الجلسةُ بلا رقم اجتماع — يبقى «ادخل الجلسة» يفتح تطبيق Zoom كما كان.
   لا شاشةَ تُترك بلا طريقٍ إلى جلستها. */

import { useEffect, useRef, useState } from "react";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { ApiError, apiPost } from "@/services/api";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";

/* نسخةٌ مثبَّتة: «الأحدث» يعني أن يتغيّر ما يعمل اليومَ بلا التزامٍ منّا */
const SDK_VERSION = "6.2.0";
const SDK_SRC = `https://source.zoom.us/${SDK_VERSION}/zoom-meeting-embedded-${SDK_VERSION}.min.js`;

interface MeetingTicket {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  passcode: string;
  role: 0 | 1;
}

/* الشكلُ الذي نستعمله من الحزمة — لا نستورد أنواعَها لأنّها ليست في node_modules */
interface EmbeddedClient {
  init(args: Record<string, unknown>): Promise<unknown>;
  join(args: Record<string, unknown>): Promise<unknown>;
  leave(): Promise<unknown>;
}
interface ZoomEmbeddedGlobal {
  createClient(): EmbeddedClient;
}
declare global {
  interface Window {
    ZoomMtgEmbedded?: ZoomEmbeddedGlobal;
  }
}

/** يُحقن السكربتُ مرّةً واحدةً للصفحة — والوعدُ نفسُه يُعاد لمن طلبه أثناء التحميل */
let sdkLoad: Promise<ZoomEmbeddedGlobal> | null = null;
function loadSdk(): Promise<ZoomEmbeddedGlobal> {
  if (window.ZoomMtgEmbedded) return Promise.resolve(window.ZoomMtgEmbedded);
  if (sdkLoad) return sdkLoad;
  sdkLoad = new Promise<ZoomEmbeddedGlobal>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SDK_SRC;
    el.async = true;
    el.onload = () => {
      const g = window.ZoomMtgEmbedded;
      if (g) resolve(g);
      else reject(new Error("sdk_global_missing"));
    };
    /* السقوطُ يُنسي الوعدَ كي تُعيد الضغطةُ التاليةُ المحاولةَ بدل أن تَرِث فشلا */
    el.onerror = () => {
      sdkLoad = null;
      reject(new Error("sdk_load_failed"));
    };
    document.head.appendChild(el);
  });
  return sdkLoad;
}

export default function SessionEmbed({
  sessionId,
  userName,
  onClose,
}: {
  sessionId: string;
  userName: string;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<EmbeddedClient | null>(null);
  const [phase, setPhase] = useState<"loading" | "joined" | "failed">("loading");
  const [reasonAr, setReasonAr] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        /* التذكرةُ أوّلا: إن ردّ الخادمُ ٥٠١ أو ٤٠٩ فلا داعيَ لتنزيل ثلاثة ميغابايت */
        const ticket = await apiPost<MeetingTicket>(`/api/learner/sessions/${sessionId}/meeting-ticket`, {});
        if (cancelled) return;

        const sdk = await loadSdk();
        if (cancelled || !rootRef.current) return;

        const client = sdk.createClient();
        clientRef.current = client;

        /* لا عربيّةَ في لغات الحزمة (تسعَ عشرةَ لغةً ليست منها العربيّة)،
           فواجهةُ الاجتماع إنجليزيّةٌ — وما حولَها من شاشتنا عربيٌّ كما هو. */
        await client.init({
          zoomAppRoot: rootRef.current,
          language: "en-US",
          patchJsMedia: true,
        });
        if (cancelled) return;

        await client.join({
          sdkKey: ticket.sdkKey,
          signature: ticket.signature,
          meetingNumber: ticket.meetingNumber,
          password: ticket.passcode,
          userName,
        });
        if (!cancelled) setPhase("joined");
      } catch (err) {
        if (cancelled) return;
        /* `ApiError` يضع عربيّةَ الخادم في `message` نفسِها — فتُقال كما قالها
           الخادم (٥٠١ «غير مفعّل»، ٤٠٩ «بلا رقم اجتماع»، ٤٠٣ «ليست من شعبك»).
           وسقوطُ تحميلِ السكربت ليس `ApiError` فله نصُّنا العامّ. */
        const ar = err instanceof ApiError ? err.message : "تعذّر فتحُ الجلسة داخل الموقع.";
        setReasonAr(ar);
        setPhase("failed");
      }
    };
    void run();

    return () => {
      cancelled = true;
      /* الخروجُ عند الإغلاق — وإلّا بقي الصوتُ والكاميرا يعملان بعد اختفاء الشاشة */
      void clientRef.current?.leave().catch(() => {});
      clientRef.current = null;
    };
  }, [sessionId, userName]);

  return (
    <Card as="section" className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-read font-bold">
          {phase === "loading" && "نفتح الجلسة…"}
          {phase === "joined" && "الجلسة مفتوحة هنا"}
          {phase === "failed" && "لم تُفتح هنا"}
        </p>
        <Button tone="secondary" size="sm" icon={X} onClick={onClose} className="min-h-9 shrink-0">
          أغلِق
        </Button>
      </div>

      {phase === "loading" && (
        <p className="mt-2 flex items-center gap-2 text-read text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          أوّلُ فتحٍ يأخذ لحظةً — تُحمَّل أدواتُ الاجتماع مرّةً واحدة.
        </p>
      )}

      {phase === "failed" && (
        <p className="mt-2 flex items-start gap-2 text-read leading-6 text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-ink" aria-hidden="true" />
          {reasonAr} استعمل «ادخل الجلسة» لفتحها في تطبيق Zoom.
        </p>
      )}

      {/* واجهةُ Zoom إنجليزيّةٌ وتُرسم يسارا-يمينا، فتُعزل عن اتّجاه الصفحة.

          ولا يُخفى الصندوقُ قبل الانضمام: `init` تُسلَّم هذا العنصرَ لتقيسه،
          وعنصرٌ `display:none` قياسُه صفرٌ في البعدَين. فيبقى قائما بارتفاعه
          — فارغا لحظةَ التحميل، وهو أيضا يقول للقارئ أين ستُفتح الجلسة. */}
      <div ref={rootRef} dir="ltr" className="mt-3 min-h-[24rem] w-full overflow-hidden rounded-xl" />
    </Card>
  );
}
