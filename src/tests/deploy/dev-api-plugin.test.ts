/* ملحق خادم التطوير لا يعمل تحت الاختبار.

   `withApi` في vite.config.ts يشعل خادم API في `configureServer`. وVitest
   ينشئ خادم Vite داخليا، وvitest.server.config.ts يدمج vite.config.ts نفسه —
   فكان الملحق يشتعل عند كل تشغيل اختبارات.

   والخادم المشتعل يتصل بقاعدة `wajeez` المدمجة، وهي لا تُهاجَر في CI:
   المهاجَرة `wajeez_test` وحدها. فيسقط بـ«الجدول public.Permission غير موجود»
   وينهي العملية برمز 1 — فتحمرّ وظيفة «اختبارات الخادم بقاعدة حقيقية» بينما
   كل اختبار فيها ناجح. وقع هذا على e173905: نجح على main وسقط على الفرع،
   الالتزام نفسه — لأنّ السقوط سباقٌ لا حتمية.

   ومحلّيا كان الخادم يزاحم الاختبارات على PostgreSQL المدمج، فتسقط ملفات
   بـ«the database system is shutting down» وتُقرأ فشلا زائفا.

   والحارس على النصّ لا على السلوك: إشعال خادمٍ داخل اختبارٍ ليُفحص إشعالُه
   يعيد المشكلة نفسها. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8')

describe('ملحق خادم التطوير', () => {
  it('يخرج فورا تحت Vitest — قبل أي إشعال', () => {
    const body = SRC.slice(SRC.indexOf('function withApi'))
    const hook = body.slice(body.indexOf('configureServer'))
    const guard = hook.indexOf('process.env.VITEST')
    const spawn = hook.indexOf('spawn(')
    expect(guard, 'لا حارس VITEST في configureServer').toBeGreaterThan(-1)
    expect(spawn, 'لا إشعال في configureServer — تغيّر الملحق').toBeGreaterThan(-1)
    expect(guard, 'الحارس بعد الإشعال — لا يمنع شيئا').toBeLessThan(spawn)
  })

  it('وإعداد اختبارات الخادم ما زال يدمج الأساس — فالحارس ضروريّ لا زائد', () => {
    const cfg = readFileSync(join(process.cwd(), 'vitest.server.config.ts'), 'utf8')
    expect(cfg).toMatch(/from\s+'\.\/vite\.config'/)
  })
})
