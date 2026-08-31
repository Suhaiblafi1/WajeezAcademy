/* المسودّة تحفظ ما يُعاد، ولا تحفظ ما لا يُحفظ.

   نموذج الانضمام طويلٌ بطبعه، ومن أغلق اللسان ليبحث عن رقم اعتماده كان يعود
   إلى نموذج فارغ. فصارت الإجابات تُحفظ عنده. وفي ذلك خطران يُحرسان هنا:
   أن يتسرّب سرٌّ عابر (كلمة مرور، رمز تحقق) إلى تخزينٍ يبقى، وأن تبقى بياناته
   عند متصفّحٍ نسيها أبدا. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DRAFT_KEY, DRAFT_TTL_MS, NEVER_PERSISTED,
  clearDraft, draftHasContent, loadDraft, saveDraft, serializeDraft,
} from '../application/trainer/application-draft'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
})

const draft = () => ({
  step: 2,
  form: {
    fullName: 'سهيل', email: 's@wajeez.test', phoneCountryCode: '+962',
    accountPassword: 'Secret#12345', verifyTokenInput: 'tok-abcdefghij',
  },
  specialties: ['تحليل البيانات'], languages: ['العربية'],
  targetCountries: [], targetAudiences: [],
  teachable: ['C-BIZ-101'], teachableOther: 'دورة بقلمي',
  days: ['الأحد'], periods: ['evening'], hoursPerWeek: '6', startFrom: '',
  demoConsent: true, reference: 'WJ-TR-2026-00001', candidateToken: 'cand-abcdefghij',
})

describe('مسودّة طلب الانضمام', () => {
  beforeEach(() => store.clear())

  it('تعود كما تُركت — الخطوة والإجابات والمرجع', () => {
    saveDraft(draft(), 1_000)
    const back = loadDraft(2_000)
    expect(back?.step).toBe(2)
    expect(back?.form.fullName).toBe('سهيل')
    expect(back?.teachable).toEqual(['C-BIZ-101'])
    expect(back?.periods).toEqual(['evening'])
    expect(back?.candidateToken).toBe('cand-abcdefghij')
  })

  it('لا سرَّ عابرا في تخزينٍ يبقى', () => {
    const raw = serializeDraft(draft(), 1_000)
    for (const secret of ['Secret#12345', 'tok-abcdefghij']) {
      expect(raw, `${secret} كُتب في المسودّة`).not.toContain(secret)
    }
    for (const key of NEVER_PERSISTED) {
      expect(raw, `${key} كُتب في المسودّة`).not.toContain(key)
    }
    /* وما يُعاد يبقى — الاستثناء مقصورٌ على السرّ */
    expect(raw).toContain('سهيل')
  })

  it('تنتهي بمدّتها ولا تبقى أبدا', () => {
    saveDraft(draft(), 1_000)
    expect(loadDraft(1_000 + DRAFT_TTL_MS - 1), 'انتهت قبل مدّتها').not.toBeNull()
    expect(loadDraft(1_000 + DRAFT_TTL_MS + 1), 'بقيت بعد مدّتها').toBeNull()
    expect(store.get(DRAFT_KEY), 'المنتهية لم تُمسح من التخزين').toBeUndefined()
  })

  it('نموذجٌ لم يُمسّ لا يُعرض له إشعار استئناف', () => {
    const empty = { ...draft(), form: { phoneCountryCode: '+962' }, specialties: [], teachable: [], teachableOther: '' }
    expect(draftHasContent({ ...empty, savedAt: 0 })).toBe(false)
    expect(draftHasContent({ ...empty, savedAt: 0, specialties: ['x'] })).toBe(true)
    expect(draftHasContent({ ...empty, savedAt: 0, form: { fullName: 'سهيل' } })).toBe(true)
  })

  it('تخزينٌ يرفض لا يُسقط النموذج', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    })
    expect(() => saveDraft(draft())).not.toThrow()
    expect(loadDraft()).toBeNull()
    expect(() => clearDraft()).not.toThrow()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
  })

  it('مسودّة تالفة تُتجاهَل ولا تُسقط الصفحة', () => {
    store.set(DRAFT_KEY, '{ليست JSON')
    expect(loadDraft()).toBeNull()
  })
})
