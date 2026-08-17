/* قوائم الأهداف لكل شخصية + فلترة خيارات سؤال الهدف.
   القاعدة الصارمة: خيار هدف لا يناسب المرحلة لا يُعرض أصلًا (وليس «يُخصم منه»).
   معرفات الخيارات ثابتة (o1..o7) من بنك الأسئلة QB-M2-001:
   o1 وظيفة أو ترقية | o2 مشروع أو دخل | o3 تغيير مسار | o4 ثقافة عامة
   o5 أسرة ورفاه | o6 قيادة وتأثير | o7 لا أعرف بعد */

import type { PersonaKey } from './types'

export const GOAL_QUESTION_ID = 'QB-M2-001'

/** خيارات الهدف المستبعدة صرامة لكل شخصية — موثقة بسبب */
const GOAL_OPTION_EXCLUSIONS: Partial<Record<PersonaKey, { optionId: string; reason_ar: string }[]>> = {
  school_student: [
    { optionId: 'o1', reason_ar: 'طالب مدرسة لا يُعرض عليه «وظيفة أو ترقية» — هدف غير مناسب للمرحلة.' },
    { optionId: 'o5', reason_ar: 'الهدف الأسري لا يُعرض على قاصر في سياق تعلم فردي.' },
    { optionId: 'o6', reason_ar: '«قيادة وتأثير» هدف مؤسسي لا يناسب طالب مدرسة.' },
  ],
  university_student: [
    { optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر لا طالب الجامعة.' },
  ],
  graduate: [
    { optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' },
    { optionId: 'o6', reason_ar: 'قيادة فريق ليست نقطة بداية واقعية لخريج بلا خبرة.' },
  ],
  job_seeker: [
    { optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' },
    { optionId: 'o6', reason_ar: 'قيادة فريق ليست نقطة بداية واقعية لباحث عن عمل.' },
  ],
  junior_employee: [{ optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' }],
  experienced_employee: [{ optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' }],
  new_manager: [{ optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' }],
  leader: [{ optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' }],
  gov_employee: [{ optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' }],
  gov_manager: [{ optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' }],
  founder_idea: [
    { optionId: 'o1', reason_ar: 'رائد الأعمال لا يُعرض عليه هدف الترقية الوظيفية.' },
    { optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' },
  ],
  founder_operating: [
    { optionId: 'o1', reason_ar: 'صاحب المشروع لا يُعرض عليه هدف الترقية الوظيفية.' },
    { optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' },
  ],
  freelancer: [
    { optionId: 'o1', reason_ar: 'المستقل لا يُعرض عليه هدف الترقية الوظيفية.' },
    { optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' },
  ],
  ld_professional: [{ optionId: 'o5', reason_ar: 'الهدف الأسري يُدار عبر شخصية ولي الأمر.' }],
  unsure_explorer: [
    { optionId: 'o1', reason_ar: 'من لم يحسم اتجاهه لا يبدأ بخيار «وظيفة أو ترقية» — يبدأ بالاستكشاف.' },
    { optionId: 'o6', reason_ar: 'من لم يحسم اتجاهه لا يبدأ بخيار القيادة.' },
  ],
}

/** معرفات الخيارات المستبعدة لشخصية — [] إن لم تُعرف الشخصية بعد (لا فلترة بلا دليل) */
export function excludedGoalOptions(persona: PersonaKey): string[] {
  return (GOAL_OPTION_EXCLUSIONS[persona] ?? []).map((e) => e.optionId)
}

export function goalExclusionReasonsAr(persona: PersonaKey): string[] {
  return (GOAL_OPTION_EXCLUSIONS[persona] ?? []).map((e) => e.reason_ar)
}

/* إعادة تفسير موثقة لأهداف واردة من جلسات قديمة/مزروعة لا تناسب الشخصية.
   لا نطمس إجابة المستخدم — نعيد تأويلها علنًا ونوثقها في أثر القرار. */
export function reinterpretGoalForPersona(
  persona: PersonaKey,
  goal: string,
): { goal: string; note_ar: string | null } {
  if (persona === 'school_student' && ['employment_advancement', 'promotion', 'first_job'].includes(goal)) {
    return {
      goal: 'career_direction',
      note_ar: 'هدف وظيفي («وظيفة/ترقية/أول عمل») لطالب مدرسة أُعيد تأويله إلى «استكشاف اتجاه مهني» — التوظيف الفوري ليس مرحلته.',
    }
  }
  if (persona === 'school_student' && goal === 'lead_team') {
    return {
      goal: 'personal_growth',
      note_ar: 'هدف «قيادة وتأثير» لطالب مدرسة أُعيد تأويله إلى «نمو شخصي».',
    }
  }
  return { goal, note_ar: null }
}
