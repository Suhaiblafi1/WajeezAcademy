/* المحتوى النظريُّ حين يكون ملفّا (ع-٢).

   ═══ لمَ يُقرأ في الصفحة ولا يُنزَّل ═══

   الوحدةُ رحلةٌ: درسٌ فاسترجاعٌ فتطبيق. وملفٌّ يُنزَّل يقطعها — يخرج
   المتعلّمُ من بوّابته إلى مجلّد تنزيلاته، ولا يعود غالبا. فـPDF يُعرض في
   مكانه، ويبقى التنزيلُ زرّا لمن أراده.

   وWord لا يُعرض في متصفّح، فهو تنزيلٌ صريحٌ يقول ذلك قبل الضغط — لا زرٌّ
   يبدو كقارئٍ ثمّ يفتح نافذةَ حفظ.

   ═══ ولا رابطَ دائمٌ يُنسخ ═══

   المسارُ محروسٌ بالجلسة والالتحاق، فمن نسخه إلى محادثةٍ لم ينفع من ليس
   في الشعبة. ولذلك لا `target="_blank"` على العرض: الإطارُ يحمل ترويستَه
   ويُقرأ في مكانه. */

import { Download, FileText } from "lucide-react";
import { fileLabelAr, fileReadsInline, type FilePurpose } from "@/application/trainer/module-body";

import { Card, Inset } from "@/components/ui/Surface";

export default function ModuleBodyDoc({
  storageKey, mime, name, purpose = "module_body", className = "",
}: {
  storageKey: string;
  mime?: string | null;
  name?: string | null;
  purpose?: FilePurpose;
  className?: string;
}) {
  const href = `/api/v1/cohort-files/${encodeURIComponent(storageKey)}`;
  const label = fileLabelAr(purpose, mime);
  const title = name?.trim() || `ملفّ (${label})`;

  return (
    <div className={className}>
      {fileReadsInline(purpose, mime) ? (
        <>
          {/* الارتفاعُ بالشاشة لا برقمٍ ثابت: صفحةُ PDF طويلةٌ، وإطارٌ بـ٤٠٠
              بكسلٍ يجعل القراءةَ تمريرا داخل تمرير. */}
          {/* الحدُّ والانحناءُ من `Inset` لا مكتوبَين هنا — ومعجمُ الأسطح
              واحدٌ في المنصّة، وصيغةٌ مكتوبةٌ بيدها تنحرف عنه صامتةً. */}
          <Inset className="overflow-hidden p-0">
            <object
              data={href}
              type={mime ?? "application/pdf"}
              aria-label={title}
              className="h-[75vh] max-h-[900px] min-h-[420px] w-full bg-paper"
            >
            {/* لمن لا يعرض متصفّحُه PDF — ولا يُترك أمام إطارٍ فارغ */}
              <Card as="p" className="text-read leading-6 text-muted-foreground">
                متصفّحُك لا يعرض هذه الصيغة.{" "}
                <a href={href} download className="font-bold text-teal-light-ink hover:underline">
                  نزِّل الملفَّ لتقرأه
                </a>
              </Card>
            </object>
          </Inset>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-read leading-6 text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{title}</span>
            <a href={href} download className="inline-flex items-center gap-1 font-bold text-teal-light-ink hover:underline">
              <Download className="h-3 w-3" aria-hidden="true" /> نزِّله
            </a>
          </p>
        </>
      ) : (
        <Card as="section" className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal/15 text-teal-light-ink">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-read font-bold text-foreground">{title}</p>
            {/* يُقال إنّه تنزيلٌ قبل الضغط — لا زرٌّ يبدو قارئا ثمّ يفتح نافذةَ حفظ */}
            <p className="mt-0.5 text-read leading-6 text-muted-foreground">
              صيغةُ {label} لا تُعرض في المتصفّح — تُفتح بعد تنزيلها.
            </p>
          </div>
          <a
            href={href}
            download
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-teal px-4 py-2 text-xs font-black text-on-teal transition hover:bg-teal-light"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> نزِّل الملفّ
          </a>
        </Card>
      )}
    </div>
  );
}
