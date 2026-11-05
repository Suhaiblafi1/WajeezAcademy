/* النسخةُ الخفيفةُ من الكتالوج العامّ (`?lite=1`، ٥ نوفمبر ٢٠٢٦) — بلا متون الدروس، وما سواها كما هو.
   والكاملةُ بلا المعامل لا تتغيّر: صفحاتُ الدروس تقرأ متونَها منها. والعلّةُ في `public.routes.ts`. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { setupTestDb, testPrisma } from '../helpers/db'
import { buildApp } from '../../http/app'

let app: FastifyInstance
const HEAVY = ['module_body_ar', 'module_scenario_ar', 'module_checks_ar', 'module_practice_ar', 'module_rubric_ar', 'module_video_ar']

beforeAll(async () => {
  await setupTestDb()
  app = await buildApp(await testPrisma())
}, 240_000)
afterAll(async () => { await app?.close() })

describe('الكتالوج الخفيف', () => {
  it('⚠️ بلا متون الدروس، وبالمسارات والدورات وعناوين الوحدات نفسها — والكاملة كما هي', async () => {
    const full = (await app.inject({ method: 'GET', url: '/api/public/core-catalog' })).json()
    const lite = (await app.inject({ method: 'GET', url: '/api/public/core-catalog?lite=1' })).json()
    expect(full.modules.some((m: Record<string, unknown>) => typeof m.module_body_ar === 'string' && m.module_body_ar.length > 0), 'الكاملة بلا متون — الاختبار بلا معنى').toBe(true)
    for (const m of lite.modules) for (const k of HEAVY) expect(m, `${k} في الخفيفة`).not.toHaveProperty(k)
    expect(lite.courses).toEqual(full.courses)
    expect(lite.launch_pathways).toEqual(full.launch_pathways)
    expect(lite.modules.map((m: { module_id: string; title_ar: string }) => [m.module_id, m.title_ar]))
      .toEqual(full.modules.map((m: { module_id: string; title_ar: string }) => [m.module_id, m.title_ar]))
    expect(JSON.stringify(lite).length, 'لم تخف').toBeLessThan(JSON.stringify(full).length / 3)
  })
})
