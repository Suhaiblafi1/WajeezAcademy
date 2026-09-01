/* التخزين الممنوع لا يُسقط صفحة.

   في سفاري — وهو المتصفّح الذي يستعمل أهلُه إعداداتِ الخصوصية أكثر من غيرهم —
   **قراءةُ `localStorage` نفسِها ترمي** حين يفعّل المستخدم «حظر كل ملفات
   تعريف الارتباط». وكان في `Diagnostic.tsx` سطرٌ داخل `useState(() => ...)`
   أي يعمل أثناء التصيير، فرميُه يُسقط شجرة React كلَّها: صفحةٌ بيضاء بلا
   رسالة. ولا يظهر لمن يطوّر، ولا يُشتكى منه لأنّ صاحبه لا يرى ما يشتكي منه.

   فما يُحرَس هنا شيئان: أنّ الغلاف لا يرمي مهما فعل التخزين، وأنّ الصفحات
   السبع التي كانت تمسّه مباشرةً لم تعد تفعل. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeGet, safeSet, safeRemove, storageAvailable, resetStorageProbeForTests } from "@/services/safe-storage";

const THROWING: Storage = new Proxy({} as Storage, {
  get() { throw new DOMException("The operation is insecure.", "SecurityError"); },
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStorageProbeForTests();
});

describe("غلاف التخزين", () => {
  it("لا يرمي حين يرمي التخزين — بل يُعيد لا شيء", () => {
    vi.stubGlobal("window", { localStorage: THROWING, sessionStorage: THROWING });
    resetStorageProbeForTests();
    expect(() => safeGet("k")).not.toThrow();
    expect(safeGet("k")).toBeNull();
    expect(safeSet("k", "v")).toBe(false);
    expect(() => safeRemove("k")).not.toThrow();
    expect(storageAvailable()).toBe(false);
  });

  it("ولا حين يوجد الكائن ويرمي عند الكتابة وحدها", () => {
    const readOnly = {
      getItem: () => "x",
      setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
      removeItem: () => {},
    } as unknown as Storage;
    vi.stubGlobal("window", { localStorage: readOnly, sessionStorage: readOnly });
    resetStorageProbeForTests();
    /* الفحص يكتب ويمحو — فيكتشف المنع ويُعطّل التخزين كلَّه بدل أن يفاجئنا لاحقا */
    expect(storageAvailable()).toBe(false);
    expect(safeSet("k", "v")).toBe(false);
  });

  it("ويعمل عاديّا حين يعمل التخزين", () => {
    const mem = new Map<string, string>();
    const ok = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    } as unknown as Storage;
    vi.stubGlobal("window", { localStorage: ok, sessionStorage: ok });
    resetStorageProbeForTests();
    expect(storageAvailable()).toBe(true);
    expect(safeSet("a", "1")).toBe(true);
    expect(safeGet("a")).toBe("1");
    safeRemove("a");
    expect(safeGet("a")).toBeNull();
  });
});

describe("الصفحات لا تمسّ التخزين مباشرة", () => {
  /* هذه السبع كانت تقرأ التخزين بلا حماية، وإحداها أثناء التصيير.

     وسقطت منها `src/services/currency.ts` بحذف الملفّ نفسِه: كان مبدّلَ عملةٍ
     يحفظ اختيارَ الزائر ويحوّل به الأسعارَ المعروضة، ولم يبقَ في الموقع سطحٌ
     يحوّل عملة — العرضُ كلُّه بالدولار، والتبديلُ عند الدفع وحدَه وبأسعار
     ربطٍ رسميّة (`application/commerce/presentment.ts`). */
  const GUARDED = [
    "src/pages/Diagnostic.tsx",
    "src/components/SiteShell.tsx",
    "src/services/auth.ts",
    "src/services/favorites.ts",
    "src/pages/Home.tsx",
    "src/pages/Pathway.tsx",
  ];

  it("ولا واحدةٌ منها تستدعي localStorage أو sessionStorage", () => {
    const offenders: string[] = [];
    for (const f of GUARDED) {
      const src = readFileSync(join(process.cwd(), f), "utf8")
        .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "")
        .replace(/\/\/[^\n]*/g, "");
      if (/localStorage\s*\.|sessionStorage\s*\./.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it("وحارسُ القطع الزائلة يُعيد التحميل بلا تخزين — بعلامةٍ في العنوان", () => {
    /* كان يمتنع كليّا بلا تخزين، فيبقى صاحبُ الإعداد الصارم على شاشةٍ بيضاء.
       والعلامةُ تبقى بعد الإعادة فتمنع الحلقة، ولا تحتاج تخزينا. */
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(html).toContain("markedInUrl");
    expect(html).toContain("reloadWithMark");
    expect(html).toContain("doReload");
  });
});
