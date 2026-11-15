/* المنحُ في مبدّل صفحتها (`GrantSwitcher`) — بياناتٌ في ملفٍّ وحدَها كي لا يكسر تصديرُها التحديثَ الساخن */

import { BLACK_FRIDAY_GRANT_NAME_AR, INFLUENCER_GRANT_NAME_AR, MEMBER_GRANT_NAME_AR, OPEN_GRANT_NAME_AR, OPEN_GRANT_PATH } from "@/application/commerce/grant";

export type GrantVariant = "members" | "influencer" | "open" | "blackfriday" | "partners";

/** المنحُ بترتيبها — ومسارُ كلٍّ في اللوحة هو مسارُ بندها في `nav-map.ts` */
export const GRANT_SCREENS: readonly { variant: GrantVariant; nameAr: string; to: string; publicPath: string | null; noteAr?: string }[] = [
  { variant: "members", nameAr: MEMBER_GRANT_NAME_AR, to: "/admin/member-grant", publicPath: "/grant" },
  { variant: "influencer", nameAr: INFLUENCER_GRANT_NAME_AR, to: "/admin/influencer-grant", publicPath: null },
  { variant: "open", nameAr: OPEN_GRANT_NAME_AR, to: "/admin/open-grant", publicPath: OPEN_GRANT_PATH },
  /* «بلاك فرايدي وجيز» (١٥ نوفمبر ٢٠٢٦) — صفحتُها برابط كلّ مؤثّر، فلا رابطَ عامّا لها */
  { variant: "blackfriday", nameAr: BLACK_FRIDAY_GRANT_NAME_AR, to: "/admin/black-friday-grant", publicPath: null },
  /* «منح الشركاء» (١٥ نوفمبر ٢٠٢٦) — لكلّ جامعةٍ أو شركةٍ صفحتُها، وروابطُها في قائمة الشركاء */
  { variant: "partners", nameAr: "منح الشركاء", to: "/admin/partner-grants", publicPath: null, noteAr: "لكل شريك رابطه، وهو في قائمة الشركاء." },
];
