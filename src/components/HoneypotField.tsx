/* حقلُ الفخّ — حقلٌ لا يراه إنسانٌ ويُعبّئه آليٌّ يملأ كلَّ ما وجد.

   وحدُّه مكتوبٌ في `server/http/honeypot.ts`: يُمسك ما يقود متصفّحا حقيقيّا،
   ولا يُمسك من يُرسل JSON إلى المسار مباشرةً — ولذلك هو طبقةٌ فوق سقوف
   المسارات لا بديلٌ عنها.

   ولمَ «خارجَ الشاشة» لا `display:none`: الآليُّ الذي يقود متصفّحا يتخطّى
   أحيانا ما كان `display:none`، ويقع فيما كان مرئيّا في الشيفرة. ولذلك يُخرَج
   من الشاشة بموضعه، ويُخرَج من شجرة الإتاحة بـ`aria-hidden`، ومن ترتيب
   التنقّل بـ`tabIndex={-1}` — فلا يبلغه لوحُ مفاتيحَ ولا قارئُ شاشة.

   واسمُ `website` مقصود: جاذبٌ للآليّات، ولا يُعبّئه المتصفّحُ تلقائيّا
   (بخلاف `email` و`organization` و`tel`). */

import { useId, useState } from "react";

export const HONEYPOT_FIELD = "website";

export interface Honeypot {
  /** يُدرَج في النموذج كما هو */
  field: React.ReactNode;
  /** يُضاف إلى الحمولة: `[HONEYPOT_FIELD]: hp.value` */
  value: string | undefined;
}

export function useHoneypot(): Honeypot {
  const [value, setValue] = useState("");
  const id = useId();
  const field = (
    <div aria-hidden="true" className="hp-trap">
      <label htmlFor={id}>الموقع الإلكتروني</label>
      <input
        id={id}
        name={HONEYPOT_FIELD}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
  return { field, value: value.trim() ? value : undefined };
}
