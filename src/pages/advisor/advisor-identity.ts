/* هوية المستشار — منفصلة عن مكون الإطار */

export const ADVISOR_IDENTITY_KEY = "wajeez_advisor_identity";

export const ADVISOR_IDENTITIES = [
  { id: "adv-reem", name: "أ. ريم القحطاني", title: "مستشارة الجاهزية المهنية والمسارات التأسيسية" },
  { id: "adv-faisal", name: "د. فيصل العتيبي", title: "مستشار تطوير الموظفين" },
  { id: "adv-sultan", name: "م. سلطان الدوسري", title: "مستشار القطاع الحكومي والقيادة" },
  { id: "adv-lina", name: "م. لينا الحربي", title: "مستشارة ريادة الأعمال" },
];

export type AdvisorIdentity = (typeof ADVISOR_IDENTITIES)[number];

export function advisorIdentity(): AdvisorIdentity | null {
  try {
    const raw = localStorage.getItem(ADVISOR_IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
