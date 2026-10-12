/* ═══ حزمتا «خططٌ تنتظر اعتمادك» (١٢ أكتوبر ٢٠٢٦) ═══
   المنتظِرةُ وحدَها، أو المفتوحةُ كلُّها ومعها ما فعله المدرّبون بالتعديلات (`allOpen` في
   `plan-review-bundle.service.ts`). في ملفٍّ صغيرٍ وحدَه: تقرؤه الصفحةُ بلا بنّاء الحزمة. */

/** الحزمتان في «خططٌ تنتظر اعتمادك» — مسارُ كلٍّ واسمُ ملفّه وما فيه */
export type BundleScope = 'pending' | 'open'
export const BUNDLE_SCOPES: Record<BundleScope, { path: string; fileName: string; labelAr: string; whatAr: string }> = {
  pending: {
    path: '/api/admin/cohort-plans/pending/review-bundle', fileName: 'خطط-تنتظر-الاعتماد.zip',
    labelAr: 'نزّل الخطط كلّها للمراجعة', whatAr: 'الخطط المنتظرة وحدها.',
  },
  open: {
    path: '/api/admin/cohort-plans/open/review-bundle', fileName: 'الخطط-المفتوحة.zip',
    labelAr: 'نزل كل الخطط المفتوحة',
    whatAr: 'وكل الخطط المفتوحة معا: المنتظرة وما رددته إلى مدربه، ومع كل خطة ما قبله المدرب من التعديلات وما رفضه وكلمته.',
  },
}
