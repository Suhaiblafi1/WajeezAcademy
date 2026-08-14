/* محاكاة 12 شخصية — كل شخصية تُشغَّل مرتين للتحقق من الحتمية.
   تفشل المحاكاة عند: تجاوز 18 سؤالا في الوضع السريع، تكرار سؤال، أو اختلاف التشغيلين. */

import {
  CONSENT_YES,
  EMPLOYEE_DATA,
  FOUNDER_IDEA,
  GOV_EMPLOYEE,
  GRAD_INTERVIEWS,
  NEW_MANAGER,
  runSession,
  STUDENT_LOST,
  type Script,
} from '../src/tests/diagnostic/helpers'

const PARENT_FAMILY: Script = {
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

const MINOR_SELF: Script = {
  'QB-M0-001': 'أنا المتعلم',
  'QB-M0-002': 'أقل من 16',
  'QB-M0-006': 'نعم',
  'QB-M0-008': 'نعم',
}

const CONSENT_NO: Script = {
  ...CONSENT_YES,
  'QB-M0-006': 'لا',
}

const CONTRADICTORY: Script = {
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

const RUSHED_LOW_TIME: Script = {
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

const FREELANCER: Script = {
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

const PERSONAS: [string, Script][] = [
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

let failures = 0
const rows: string[] = []

for (const [name, script] of PERSONAS) {
  const a = runSession(script)
  const b = runSession(script)

  const dup = new Set(a.askedOrder).size !== a.askedOrder.length
  const overCap = a.askedOrder.length > 18
  const recA = {
    kind: a.recommendation.kind,
    top: a.recommendation.primaryPathway?.pathwayId ?? null,
    tpl: a.recommendation.composite?.templateId ?? null,
    conf: a.recommendation.confidence.total,
  }
  const recB = {
    kind: b.recommendation.kind,
    top: b.recommendation.primaryPathway?.pathwayId ?? null,
    tpl: b.recommendation.composite?.templateId ?? null,
    conf: b.recommendation.confidence.total,
  }
  const nonDet =
    JSON.stringify(a.askedOrder) !== JSON.stringify(b.askedOrder) ||
    JSON.stringify(recA) !== JSON.stringify(recB)

  if (dup || overCap || nonDet) failures++
  const flags = [dup ? 'تكرار!' : '', overCap ? 'تجاوز18!' : '', nonDet ? 'لا-حتمية!' : '']
    .filter(Boolean)
    .join(' ')
  rows.push(
    [
      name,
      String(a.askedOrder.length),
      recA.kind,
      recA.top ?? '—',
      recA.tpl ?? '—',
      (recA.conf * 100).toFixed(0) + '٪',
      flags || '✓',
    ].join(' | '),
  )
}

console.log('\nشخصية | أسئلة | نوع | مسار أول | قالب | ثقة | حالة')
console.log('---')
for (const r of rows) console.log(r)
console.log('---')
if (failures > 0) {
  console.error(`فشلت ${failures} شخصية من ${PERSONAS.length}`)
  process.exit(1)
}
console.log(`نجحت المحاكاة: ${PERSONAS.length} شخصية، كل واحدة حتمية عبر تشغيلين.`)
