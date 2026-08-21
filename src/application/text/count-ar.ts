/* صيغة العدد في العربية: ١ مفرد · ٢ مثنى · ٣–١٠ جمع · ١١+ مفرد منصوب.
   «1 مسارا» و«3 قالبا» خطأ يقرؤه المستخدم في كل سطر — والعدد هنا يُقرأ لا يُحسب.
   موضعه في الطبقة المشتركة: تستورده الواجهة والخادم معا (الخادم يستورد من
   src/application كسابقة impact.service وcatalog.routes). */
export interface CountForms {
  one: string
  two: string
  few: string
  many: string
}

export function countAr(n: number, forms: CountForms): string {
  if (n === 1) return `${n} ${forms.one}`
  if (n === 2) return `${n} ${forms.two}`
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`
  return `${n} ${forms.many}`
}
