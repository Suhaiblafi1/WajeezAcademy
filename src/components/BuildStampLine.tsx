/* تذييلُ اللوحات: أيَّ نسخةٍ تنظر إليها الآن؟ (البند ٦)

   ── لماذا سطرٌ في التذييل، والجوابُ موجودٌ أصلا ──

   `‎/api/version` يجيب هذا السؤالَ منذ إصلاحِ ختم البناء. لكنّه مسارُ JSON:
   يُقرأ بـcurl من يعرف أنّه موجود. **ومعلومةٌ لا شاشةَ لها معلومةٌ غيرُ
   موجودة** — بقي سؤالُ «لماذا أرى موقعا قديما؟» مفتوحا أسبوعا، وذهبت جلسةٌ
   في تشخيصٍ على بيئةٍ خاطئة، والجوابُ في مسارٍ لم يُفتح.

   فحين يشكّ الإداريُّ أنّ تغييرا لم يصل، الجوابُ في أسفل الشاشة التي هو فيها
   لا في أداةٍ يفتحها.

   ── ولماذا يُجلب مرّةً واحدةً للصفحة كلِّها ──

   التذييلُ في كلّ شاشةِ إدارة، والانتقالُ بين الشاشات لا يُعيد تحميل التطبيق.
   فطلبٌ لكلّ شاشةٍ يعني عشراتِ الطلبات في جلسةٍ واحدة على معلومةٍ **لا تتغيّر
   ما دامت العمليّةُ حيّة**. فالوعدُ يُخزَّن في الوحدة: أوّلُ من يسأل يطلب،
   والباقون ينتظرون الوعدَ نفسَه.

   ولا يُعرض شيءٌ حين يخفق الطلبُ أو يُجهل الالتزام: تذييلٌ يقول «مجهول» ضجيجٌ
   في كلّ شاشة. والغيابُ يُقرأ في «صحّة النظام» حيث له سطرٌ يشرحه. */

import { useEffect, useState } from "react";
import { Link } from "react-router";

interface VersionReply {
  الكود?: { الالتزام?: string | null; الفرع?: string | null; وقت_البناء?: string | null; البيئة?: string | null };
  متطابقان?: string;
}

let pending: Promise<VersionReply | null> | undefined;

function version(): Promise<VersionReply | null> {
  pending ??= fetch("/api/version")
    .then((r) => (r.ok ? (r.json() as Promise<VersionReply>) : null))
    .catch(() => null);
  return pending;
}

export default function BuildStampLine() {
  const [v, setV] = useState<VersionReply | null>(null);

  useEffect(() => {
    let alive = true;
    version().then((r) => { if (alive) setV(r); });
    return () => { alive = false; };
  }, []);

  const sha = v?.الكود?.الالتزام;
  if (!sha) return null;

  const ref = v.الكود?.الفرع;
  const builtAt = v.الكود?.وقت_البناء;
  /* التاريخُ يُعرض بالتقويم الميلاديّ صراحةً: هذا سطرُ تشخيصٍ يُقارن بسجلّ
     GitHub، والمقارنةُ تفسد إن اختلف التقويم. */
  const built = builtAt
    ? new Date(builtAt).toLocaleString("ar", {
        calendar: "gregory", dateStyle: "medium", timeStyle: "short",
      })
    : null;

  return (
    <p className="mt-10 border-t border-white/10 pt-4 text-read text-muted-foreground">
      <span className="font-mono">{sha}</span>
      {ref ? <> · {ref}</> : null}
      {built ? <> · بُني {built}</> : null}
      {v.الكود?.البيئة ? <> · {v.الكود.البيئة}</> : null}
      {" — "}
      <Link className="underline hover:text-foreground" to="/admin/system-health">
        النسخةُ العاملةُ وحالُ البيئة
      </Link>
    </p>
  );
}
