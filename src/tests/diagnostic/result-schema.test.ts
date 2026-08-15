import { describe, expect, it } from 'vitest'
import { readStoredResult, wrapResultForStorage, RESULT_SCHEMA_VERSION } from '../../application/diagnostic/result-schema'
import { pathways } from '../../data/pathways'
import templatesJson from '../../data/catalog/composite-templates.v1.json'
import type { DiagResult } from '../../data/diagnostic'

/* نتيجة سليمة الحد الأدنى — مسار حقيقي من الكتالوج الحي */
const validResult = (): DiagResult => ({
  top: pathways[0],
  faster: null,
  cheaper: null,
  confidence: 82,
  confidenceBand: 'قوية',
  needsAdvisor: false,
  reasons: ['هدفك واضح'],
  gaps: ['كتابة المحتوى'],
  gapDetails: [],
  unavailableSkills: [],
  priorOverlap: [],
  changeMakers: ['خبرة سابقة'],
  reconciled: true,
  secondGoal: null,
  resultJson: { kind: 'single_pathway', pathway_id: pathways[0].id },
})

const firstTemplateId = (templatesJson as { templates: { template_id: string }[] }).templates[0].template_id

const validCompositeResult = (): DiagResult => ({
  ...validResult(),
  resultJson: {
    kind: 'composite_template',
    pathway_id: pathways[0].id,
    composite: { template_id: firstTemplateId, name_ar: 'خطة مركبة', variant: 'balanced', label_ar: 'خطة مركبة مخصصة', courses: [], fit: 0.8 },
  },
})

describe('مخطط النتيجة المحفوظة وترحيلها', () => {
  it('نتيجة v2 مغلفة سليمة تقرأ كما هي', () => {
    const raw = wrapResultForStorage(validResult())
    const read = readStoredResult(raw)
    expect(read.status).toBe('ok')
    if (read.status === 'ok') expect(read.result.top.id).toBe(pathways[0].id)
  })

  it('الغلاف يحمل schema_version الحالي', () => {
    const raw = JSON.parse(wrapResultForStorage(validResult()))
    expect(raw.schema_version).toBe(RESULT_SCHEMA_VERSION)
    expect(raw.savedAt).toBeTruthy()
  })

  it('نتيجة قديمة عارية (v1 بلا غلاف) تُرحّل بأمان', () => {
    const raw = JSON.stringify(validResult()) // بلا غلاف — هكذا كانت تُحفظ سابقا
    const read = readStoredResult(raw)
    expect(read.status).toBe('migrated')
    if (read.status === 'migrated') {
      expect(read.result.unavailableSkills).toEqual([])
      expect(read.result.faster).toBeNull()
    }
  })

  it('نتيجة مركبة قديمة بقالب موجود تُرحّل وتُقبل', () => {
    const raw = JSON.stringify(validCompositeResult())
    const read = readStoredResult(raw)
    expect(read.status).toBe('migrated')
  })

  it('نتيجة مركبة قديمة بقالب لم يعد موجودا تُحذف بأمان', () => {
    const broken = validCompositeResult()
    ;(broken.resultJson.composite as { template_id: string }).template_id = 'TPL-OLD-DELETED'
    const read = readStoredResult(JSON.stringify(broken))
    expect(read.status).toBe('discarded')
    if (read.status === 'discarded') expect(read.reason_ar).toContain('أعد المؤشر')
  })

  it('نتيجة قديمة بمسار لم يعد في الكتالوج تُحذف بأمان', () => {
    const stale = validResult()
    stale.top = { ...stale.top, id: 'PW-OLD-45-ERA' }
    const read = readStoredResult(JSON.stringify(stale))
    expect(read.status).toBe('discarded')
  })

  it('JSON فاسد يُحذف بأمان دون استثناء', () => {
    expect(readStoredResult('{broken json').status).toBe('discarded')
    expect(readStoredResult('42').status).toBe('discarded')
    expect(readStoredResult('"نص"').status).toBe('discarded')
  })

  it('نتيجة ناقصة الحقول الحرجة تُحذف — لا صفحة نصف فارغة', () => {
    const broken = validResult() as unknown as Record<string, unknown>
    delete broken.gaps
    expect(readStoredResult(JSON.stringify(broken)).status).toBe('discarded')
    delete broken.resultJson
    expect(readStoredResult(JSON.stringify(broken)).status).toBe('discarded')
  })

  it('لا شيء محفوظ = none بلا ضجيج', () => {
    expect(readStoredResult(null).status).toBe('none')
  })

  it('إحالة المستشار القديمة بلا مسار أول تُقبل — لا مسار إلزامي فيها', () => {
    const referral = validResult()
    referral.needsAdvisor = true
    referral.resultJson = { kind: 'advisor_referral', pathway_id: null }
    expect(readStoredResult(JSON.stringify(referral)).status).toBe('migrated')
  })
})
