/* قدراتُ المنصّة داخل مكوّن — بلا حالةِ تحميلٍ ظاهرة.

   القيمةُ الأولى هي الافتراضُ المتحفّظ (لا رفع)، فإن جاء الجوابُ بخلافه
   ظهر الزرّ. والعكسُ — إظهارُ زرٍّ ثمّ إخفاؤه — كان سيُربك المستخدم. */

import { useEffect, useState } from "react";
import { loadPlatformConfig, platformConfigSnapshot, type PlatformConfig } from "@/services/platform-config";

export function usePlatformConfig(): PlatformConfig {
  const [config, setConfig] = useState<PlatformConfig>(() => platformConfigSnapshot() ?? { fileUploads: false, demoMode: false });
  useEffect(() => {
    let alive = true;
    void loadPlatformConfig().then((c) => { if (alive) setConfig(c); });
    return () => { alive = false };
  }, []);
  return config;
}
