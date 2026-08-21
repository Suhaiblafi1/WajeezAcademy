import { describe, expect, it } from 'vitest'
import { buildInbox, KIND_LABEL_AR } from '../../application/student/inbox'

const ME = 'user-me'

describe('الصندوق الموحّد (ص-١)', () => {
  it('مصادر فارغة أو غير مصفوفات لا تُسقط شيئا', () => {
    expect(buildInbox(null, null, null, ME)).toEqual([])
    expect(buildInbox({}, 'x', 7, ME)).toEqual([])
    expect(buildInbox([], [], [], ME)).toEqual([])
  })

  it('يجمع الأنواع الأربعة من مصادرها', () => {
    const items = buildInbox(
      [{ id: 'n1', title: 'قُبل تسجيلك', body: 'مرحبا بك', status: 'sent', sentAt: '2026-08-10T10:00:00Z' }],
      [{ id: 't1', subject: 'مشكلة دخول', messages: [{ id: 'm1', authorId: 'agent', body: 'حللناها', createdAt: '2026-08-11T10:00:00Z' }] }],
      [{
        id: 'e1', cohort: { title: 'شعبة أ' },
        submissions: [{
          id: 's1', status: 'accepted', reviewNote: 'ملاحظة', reviewedAt: '2026-08-12T10:00:00Z',
          assessment: { title: 'واجب أول' },
          feedback: [{ id: 'f1', body: 'تعليق', createdAt: '2026-08-13T10:00:00Z' }],
        }],
      }],
      ME,
    )
    expect(items.map((i) => i.kind)).toEqual(['trainer_feedback', 'review_note', 'support_reply', 'notification'])
    expect(items[0].titleAr).toBe('واجب أول')
  })

  it('الأحدث أولا', () => {
    const items = buildInbox(
      [
        { id: 'a', title: 'ت', body: 'قديم', status: 'read', sentAt: '2026-01-01T00:00:00Z' },
        { id: 'b', title: 'ت', body: 'جديد', status: 'read', sentAt: '2026-08-01T00:00:00Z' },
      ], [], [], ME,
    )
    expect(items.map((i) => i.bodyAr)).toEqual(['جديد', 'قديم'])
  })

  it('رسائل المتعلم نفسه في تذكرته ليست ردا عليه', () => {
    const items = buildInbox([], [{
      id: 't1', subject: 'س',
      messages: [
        { id: 'mine', authorId: ME, body: 'سؤالي', createdAt: '2026-08-01T00:00:00Z' },
        { id: 'theirs', authorId: 'agent', body: 'جوابهم', createdAt: '2026-08-02T00:00:00Z' },
      ],
    }], [], ME)
    expect(items).toHaveLength(1)
    expect(items[0].bodyAr).toBe('جوابهم')
  })

  it('بلا معرّف مالك تُعرض كل الرسائل — لا نحجب بتخمين', () => {
    const items = buildInbox([], [{ id: 't', subject: 'س', messages: [{ id: 'm', authorId: ME, body: 'سؤالي', createdAt: '2026-08-01T00:00:00Z' }] }], [], null)
    expect(items).toHaveLength(1)
  })

  it('حالة القراءة للإشعارات فقط — ولا تُصطنع لغيرها', () => {
    const items = buildInbox(
      [{ id: 'n', title: 'ت', body: 'ب', status: 'sent', sentAt: '2026-08-01T00:00:00Z' }],
      [{ id: 't', subject: 'س', messages: [{ id: 'm', authorId: 'a', body: 'ر', createdAt: '2026-08-02T00:00:00Z' }] }],
      [], ME,
    )
    expect(items.find((i) => i.kind === 'notification')!.unread).toBe(true)
    expect(items.find((i) => i.kind === 'support_reply')!.unread).toBe(false)
  })

  it('تاريخ غير صالح أو متن فارغ يُستبعد بلا رمي', () => {
    const items = buildInbox(
      [
        { id: 'a', title: 'ت', body: 'ب', status: 'sent', sentAt: 'ليس تاريخا' },
        { id: 'b', title: 'ت', body: '   ', status: 'sent', sentAt: '2026-08-01T00:00:00Z' },
        { id: 'c', title: 'ت', body: 'صالح', status: 'sent', sentAt: '2026-08-02T00:00:00Z' },
      ], [], [], ME,
    )
    expect(items.map((i) => i.bodyAr)).toEqual(['صالح'])
  })

  it('يسقط على queuedAt حين لا sentAt', () => {
    const items = buildInbox([{ id: 'a', title: 'ت', body: 'ب', status: 'sent', queuedAt: '2026-08-01T00:00:00Z' }], [], [], ME)
    expect(items).toHaveLength(1)
  })

  it('المعرّفات موسومة بمصدرها فلا تتصادم بين المصادر', () => {
    const items = buildInbox(
      [{ id: 'x', title: 'ت', body: 'إشعار', status: 'sent', sentAt: '2026-08-01T00:00:00Z' }],
      [{ id: 't', subject: 'س', messages: [{ id: 'x', authorId: 'a', body: 'رد', createdAt: '2026-08-02T00:00:00Z' }] }],
      [], ME,
    )
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
  })

  it('لكل نوع تسمية عربية', () => {
    for (const k of ['notification', 'trainer_feedback', 'review_note', 'support_reply'] as const) {
      expect(KIND_LABEL_AR[k].length).toBeGreaterThan(2)
    }
  })
})
