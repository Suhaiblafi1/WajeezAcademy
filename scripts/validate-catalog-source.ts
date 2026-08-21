#!/usr/bin/env node
/* واجهة سطر أوامر لبوابة التحقق المصدرية (البند أ-١).
   المنطق في server/catalog/validate-source.ts ليستدعيه المستورد نفسه — بوابة
   تُشغَّل بأمر منفصل يُنسى ليست بوابة. وهذا الملف للتشغيل اليدوي وفي CI. */

import { assertCatalogSourceValid } from '../server/catalog/validate-source'

try {
  assertCatalogSourceValid({ verbose: true })
} catch {
  process.exit(1)
}
