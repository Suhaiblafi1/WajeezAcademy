/* المنحُ الثلاثُ في مبدّل صفحتها (`GrantSwitcher`) — بياناتٌ في ملفٍّ وحدَها كي لا يكسر تصديرُها التحديثَ الساخن */

import { INFLUENCER_GRANT_NAME_AR, MEMBER_GRANT_NAME_AR, OPEN_GRANT_NAME_AR, OPEN_GRANT_PATH } from "@/application/commerce/grant";

export type GrantVariant = "members" | "influencer" | "open";

/** المنحُ بترتيبها — ومسارُ كلٍّ في اللوحة هو مسارُ بندها في `nav-map.ts` */
export const GRANT_SCREENS: readonly { variant: GrantVariant; nameAr: string; to: string; publicPath: string | null }[] = [
  { variant: "members", nameAr: MEMBER_GRANT_NAME_AR, to: "/admin/member-grant", publicPath: "/grant" },
  { variant: "influencer", nameAr: INFLUENCER_GRANT_NAME_AR, to: "/admin/influencer-grant", publicPath: null },
  { variant: "open", nameAr: OPEN_GRANT_NAME_AR, to: "/admin/open-grant", publicPath: OPEN_GRANT_PATH },
];
