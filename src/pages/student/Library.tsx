/* المكتبة (١د) — موادّ خارج الدورات: فيديو ومقالات وقوالب ومنشورات وملفات
   وكتب. جدول واحد بسيط، والفتح في تبويب خارجي لا التضمين: مشغّل يوتيوب أو
   إطار إنستغرام داخل الصفحة يُنزل متتبّعات الطرف الثالث على صفحات المنصّة
   ويبطّئها، ولا يُضيف على الرابط شيئا.

   المصدر هو سلسلة الكتالوج نفسها (مصدر → استيراد → نشر)، فتَرِث المكتبة
   حوكمةَ المحتوى القائمة بلا شاشة إدارة جديدة. وحين لا موادّ منشورة: صفحةٌ
   تقول ذلك صراحةً، وتبويبُها لا يظهر في التنقّل أصلا. */

import { ExternalLink, FileText, Film, Instagram, LayoutTemplate, Library as LibraryIcon, BookMarked, FileType2 } from "lucide-react";
import PortalLayout from "./PortalLayout";
import EmptyState from "@/components/EmptyState";
import { usePublishedContent } from "@/services/public-content";
import { getLibraryResources, type CoreCatalogLibraryResource } from "@/data/core-catalog-source";

const KIND: Record<CoreCatalogLibraryResource["kind"], { label: string; icon: typeof FileText }> = {
  video: { label: "فيديو", icon: Film },
  article: { label: "مقال", icon: FileText },
  template: { label: "قالب", icon: LayoutTemplate },
  post: { label: "منشور", icon: Instagram },
  pdf: { label: "ملف PDF", icon: FileType2 },
  text: { label: "نص", icon: FileText },
  book: { label: "كتاب", icon: BookMarked },
};

/** اسم المضيف وحده — يرى المتعلم إلى أين يذهب قبل أن ينقر */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function Library() {
  /* usePublishedContent يعيد التصيير عند تثبيت لقطة الكتالوج (useSyncExternalStore)،
     فالقراءة أثناء التصيير كافية — وuseMemo هنا يعقّد بلا فائدة. */
  usePublishedContent();
  const rows = getLibraryResources();

  return (
    <PortalLayout title="المكتبة">
      <p className="mb-6 max-w-2xl text-sm leading-7 text-muted-foreground">
        موادّ مختارة خارج الدورات — تُفتح في تبويب جديد على مصدرها الأصلي.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          icon={LibraryIcon}
          titleAr="المكتبة لم تُفتح بعد"
          reasonAr="لم تُنشر موادّ في المكتبة حتى الآن. حين تُضاف ستظهر هنا بعنوانها ومصدرها ورابطها."
          tone="start"
        />
      ) : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {rows.map((r) => {
            const kind = KIND[r.kind] ?? KIND.article;
            const host = hostOf(r.url);
            return (
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-4 py-4 transition hover:bg-white/[0.04] sm:items-center sm:px-5"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal-light-ink sm:mt-0">
                    <kind.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-6">{r.title_ar}</span>
                    {r.description_ar && (
                      <span className="mt-1 block text-[12px] leading-6 text-muted-foreground">{r.description_ar}</span>
                    )}
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-fine text-muted-foreground">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-bold">{kind.label}</span>
                      {r.source_ar && <span>{r.source_ar}</span>}
                      {r.minutes ? <span>{r.minutes} دقيقة</span> : null}
                      {host && <span dir="ltr">{host}</span>}
                    </span>
                  </span>
                  <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 sm:mt-0" aria-label="يُفتح في تبويب جديد" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </PortalLayout>
  );
}
