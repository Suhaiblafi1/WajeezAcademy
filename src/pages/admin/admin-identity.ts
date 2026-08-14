/* هوية الإدارة — منفصلة عن مكون الإطار حتى يبقى ملف المكون للمكونات فقط */

export const ADMIN_IDENTITY_KEY = "wajeez_admin_identity";

export const ADMIN_IDENTITIES = [
  { id: "adm-ops", name: "م. عبدالله الرشيد", title: "مدير العمليات" },
  { id: "adm-academic", name: "د. سارة العمري", title: "مديرة الشؤون الأكاديمية" },
  { id: "adm-finance", name: "أ. محمد الحربي", title: "مدير المالية" },
];

export type AdminIdentity = (typeof ADMIN_IDENTITIES)[number];

export function adminIdentity(): AdminIdentity | null {
  try {
    const raw = localStorage.getItem(ADMIN_IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
