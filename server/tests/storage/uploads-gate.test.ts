/* بوّابةُ الرفع: مطفأةٌ افتراضيّا، وتقول البديل — لا تصمت ولا تكذب.

   جولةُ ٢٠٢٦-٠٩ أثبتت أنّ كلَّ رفعٍ خارجَ وثائقِ طلب انضمام المدرّب يفشل:
   `writeDocumentContent` يكتب في `trainerApplicationDocument` وحدَه، وهو
   النموذجُ الوحيدُ الذي يحمل عمودَ محتوى. فحتّى يُبنى مخزنُ الكائنات، لا
   يُصدَر رابطُ رفعٍ لا يقود إلى مكان. وهذا الاختبار يمنع عودةَ الوعد الكاذب. */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { assertFileUploadsEnabled, fileUploadsEnabled } from '../../services/storage.service'

const KEY = 'FILE_UPLOADS'
let before: string | undefined

beforeAll(() => { before = process.env[KEY]; delete process.env[KEY] })
afterAll(() => { if (before === undefined) delete process.env[KEY]; else process.env[KEY] = before })

describe('رفعُ الملفّات مطفأٌ حتّى يوجد مخزنٌ حقيقيّ', () => {
  it('المفتاحُ لا يشتعل إلّا بـ«on» صريحة', () => {
    delete process.env[KEY]
    expect(fileUploadsEnabled()).toBe(false)
    process.env[KEY] = 'true'
    expect(fileUploadsEnabled(), '«true» ليست «on» — الإشعالُ قرارٌ صريح').toBe(false)
    process.env[KEY] = 'on'
    expect(fileUploadsEnabled()).toBe(true)
    delete process.env[KEY]
  })

  it('والرفضُ يقول البديلَ ويحمل رمزَ ٥٠١', () => {
    delete process.env[KEY]
    try {
      assertFileUploadsEnabled('أضف المادّةَ برابطٍ خارجيّ.')
      throw new Error('لم يُرفض — والبوّابةُ مطفأة')
    } catch (e) {
      const err = e as { code?: string; status?: number; messageAr?: string }
      expect(err.code).toBe('uploads_unavailable')
      expect(err.status).toBe(501)
      expect(err.messageAr).toContain('أضف المادّةَ برابطٍ خارجيّ')
    }
  })

  it('ولا يُرفض شيءٌ وهي مشتعلة', () => {
    process.env[KEY] = 'on'
    expect(() => assertFileUploadsEnabled('بديل')).not.toThrow()
    delete process.env[KEY]
  })
})
