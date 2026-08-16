/* الشخصيات الاثنتا عشرة الموثقة — مصدر مشترك للمحاكاة واختبار الارتداد والمحاكي */
import {
  CONSENT_YES,
  EMPLOYEE_DATA,
  FOUNDER_IDEA,
  GOV_EMPLOYEE,
  GRAD_INTERVIEWS,
  NEW_MANAGER,
  STUDENT_LOST,
  type Script,
} from './helpers'

export const PARENT_FAMILY: Script = {
  'QB-M0-001': 'ولي أمر أو عائلة',
  'QB-M0-002': 'من 35 إلى 44',
  'QB-M0-006': 'نعم',
  'QB-M0-008': 'لا',
  'QB-M1-001': 'طالب جامعة',
  'QB-M2-001': 'لا أعرف بعد',
  'QB-M2-005': 'متوسط',
  'QB-M2-015': 'متوسطة',
  'QB-M7-001': 'من 2 إلى 4 ساعات',
}

export const MINOR_SELF: Script = {
  'QB-M0-001': 'أنا المتعلم',
  'QB-M0-002': 'أقل من 16',
  'QB-M0-006': 'نعم',
  'QB-M0-008': 'نعم',
}

export const CONSENT_NO: Script = {
  ...CONSENT_YES,
  'QB-M0-006': 'لا',
}

export const CONTRADICTORY: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M1-001': 'موظف',
  'QB-M1-003': 'دوام كامل',
  'QB-M2-001': 'وظيفة أو ترقية',
  'QB-M2-005': 'واضح جدا',
  'QB-M2-014': 'مراجعة مستشار',
  'QB-M2-015': 'عالية',
  'QB-M3B-001': 'خاص',
  'QB-M3B-011': ['عمليات'],
  'QB-M7-001': 'من 5 إلى 7 ساعات',
}

export const RUSHED_LOW_TIME: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M1-001': 'موظف',
  'QB-M1-003': 'دوام كامل',
  'QB-M2-001': 'وظيفة أو ترقية',
  'QB-M2-005': 'واضح',
  'QB-M2-015': 'منخفضة',
  'QB-M3B-001': 'خاص',
  'QB-M3B-011': ['مبيعات'],
  'QB-M3B-012': 'لا',
  'QB-M7-001': 'أقل من ساعتين',
}

export const FREELANCER: Script = {
  ...CONSENT_YES,
  'QB-M0-002': 'من 25 إلى 34',
  'QB-M1-001': 'رائد أعمال/مستقل',
  'QB-M1-003': 'عمل حر',
  'QB-M2-001': 'مشروع أو دخل',
  'QB-M2-005': 'واضح',
  'QB-M2-015': 'عالية',
  'QB-M3C-001': 'قائم وله دخل',
  'QB-M3C-002': 'واضح',
  'QB-M3C-004': 'نعم',
  'QB-M3C-010': 'أعرفها جيدا',
  'QB-M3C-011': 'أعمل وحدي',
  'QB-M7-001': 'من 8 إلى 12 ساعة',
}

export const PERSONAS: [string, Script][] = [
  ['طالب ضائع', STUDENT_LOST],
  ['خريج يبحث عن عمل', GRAD_INTERVIEWS],
  ['موظف حكومي', GOV_EMPLOYEE],
  ['مدير جديد', NEW_MANAGER],
  ['رائد أعمال — فكرة', FOUNDER_IDEA],
  ['موظف عمليات', EMPLOYEE_DATA],
  ['والد أسرة', PARENT_FAMILY],
  ['قاصر يقرر بنفسه', MINOR_SELF],
  ['رافض الموافقة', CONSENT_NO],
  ['متناقض — واضح ثم مراجعة مستشار', CONTRADICTORY],
  ['مستعجل — وقت قليل', RUSHED_LOW_TIME],
  ['مستقل — عمل حر قائم', FREELANCER],
]
