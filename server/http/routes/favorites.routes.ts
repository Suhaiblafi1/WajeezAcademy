/* مفضّلةُ الزائر المسجَّل (ع-٨).

   و`requireAuth` لا صلاحيّةٌ بعينها: المفضّلةُ ليست بابا في بوّابةٍ يملكه
   دورٌ — هي شيءُ صاحبِ الحساب مهما كان دورُه. ومن أنشأ حسابَه قبل لحظةٍ من
   قلبٍ ضغطه على بطاقةِ مسار يجب أن يُحفظ له، لا أن يُردّ لأنّه لم يُسنَد
   إليه شيء. */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { requireAuth } from '../auth-plugin'
import { FavoritesService } from '../../services/favorites.service'
import { FAVORITE_KINDS, MAX_REF_LEN } from '../../../src/application/catalog/favorites'

const refSchema = z.object({
  kind: z.enum(FAVORITE_KINDS),
  refId: z.string().trim().min(1).max(MAX_REF_LEN),
})

export function registerFavoriteRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const favorites = new FavoritesService(prisma)

  app.get('/api/favorites', {
    preHandler: requireAuth,
    schema: { tags: ['favorites'], summary: 'ما حفظه في مفضّلته — مساراتٍ ودورات' },
  }, async (req) => favorites.mine(req.auth!.userId))

  app.post('/api/favorites', {
    preHandler: requireAuth,
    schema: { tags: ['favorites'], summary: 'يُحفظ مسارٌ أو دورة' },
  }, async (req) => {
    const body = refSchema.parse(req.body)
    return favorites.add(req.auth!.userId, body.kind, body.refId)
  })

  app.delete('/api/favorites', {
    preHandler: requireAuth,
    schema: { tags: ['favorites'], summary: 'يُزال من المفضّلة' },
  }, async (req) => {
    const body = refSchema.parse(req.body)
    return favorites.remove(req.auth!.userId, body.kind, body.refId)
  })

  /* ما حُفظ في المتصفّح قبل أن تصير المفضّلةُ في الحساب — يُرفع مرّةً.
     والسقفُ لأنّه مدخَلٌ يقبل قائمةً: خمسون ضِعفُ ما يحفظه إنسانٌ فعلا. */
  app.post('/api/favorites/merge', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: { tags: ['favorites'], summary: 'رفعُ مفضّلةٍ كانت في المتصفّح — مرّةً واحدة' },
  }, async (req) => {
    const body = z.object({ refs: z.array(refSchema).max(50) }).parse(req.body)
    return favorites.merge(req.auth!.userId, body.refs)
  })
}
