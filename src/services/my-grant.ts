/* كودُ منحة صاحب الحساب وما بقي من دوراته — من `GET /api/learner/my-grant` (٣١ أكتوبر ٢٠٢٦).

   قرارُ صاحب المنصّة: «أوضحه في المنصّة له، وفعّله تلقائيّا عند أيّ شراءٍ له». فتقرؤه لوحتُه (`MyGrantCard`)
   ولوحُ الشراء (`BuyPanel`) يطبّقه وحده. ولا يُخبَّأ: ما بقي من دوراته يتغيّر بكلّ شراء. والفشلُ يُقرأ «لا كود» —
   فيُسعَّر الشراءُ كما كان بلا منحة. والعلّةُ في `server/services/grant.service.ts#learnerGrant`. */

import { useEffect, useState } from "react";
import { apiGet } from "@/services/api";
import { readSession } from "@/services/auth";

export interface MyGrant {
  code: string | null;
  percentOff?: number | null;
  nameAr?: string;
  left?: number;
  max?: number;
}

export function fetchMyGrant(): Promise<MyGrant> {
  if (!readSession()) return Promise.resolve({ code: null });
  return apiGet<MyGrant>("/api/learner/my-grant").catch(() => ({ code: null }));
}

export function useMyGrant(): MyGrant | null {
  const [grant, setGrant] = useState<MyGrant | null>(null);
  useEffect(() => {
    let on = true;
    void fetchMyGrant().then((g) => { if (on) setGrant(g); });
    return () => { on = false; };
  }, []);
  return grant;
}

/** كم دورةً بقيت على كود صاحب الحساب في هذه المنحة — ولا عددَ إن كان كودُه من الأخرى أو لا كودَ له.
    تسألها صفحةُ المنحة فيصير حدُّ اختياره ما بقي له، لا حدَّ الحملة كلَّه (٣١ أكتوبر ٢٠٢٦) */
export function coursesLeftOn(grant: MyGrant | null, grantNameAr: string): number | null {
  if (!grant?.code || grant.nameAr !== grantNameAr || grant.left === undefined) return null;
  return grant.left;
}
