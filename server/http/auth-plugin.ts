/* إضافة المصادقة — تحل رمز الجلسة من الكوكي في كل طلب،
   وتوفر requirePermission كحراسة صلاحيات دقيقة على المسارات. */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AuthService, type AuthContext } from '../services/auth.service'
import { permissionDescriptionAr, rolesWithPermissionAr, type PermissionKey } from '../auth/permissions'

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null
    sessionToken?: string
  }
}

export const SESSION_COOKIE = 'wajeez_session'

export function registerAuth(app: FastifyInstance, auth: AuthService) {
  app.decorateRequest('auth', null)

  app.addHook('onRequest', async (req) => {
    const token = req.cookies[SESSION_COOKIE]
    req.sessionToken = token
    req.auth = token ? await auth.resolve(token) : null
  })
}

/** حارس صلاحية — 401 بلا جلسة، 403 بلا صلاحية */
export function requirePermission(key: PermissionKey) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) {
      return reply.status(401).send({ error: { code: 'unauthenticated', message_ar: 'سجّل الدخول أولا' } })
    }
    if (!req.auth.permissions.includes(key)) {
      /* «لا تملك الصلاحية المطلوبة» لا يقول أيَّ صلاحيّة ولا من يملكها، فكانت
         كلُّ شاشةٍ ممنوعةٍ تعرض النصَّ نفسَه — ولوحاتُ الواجهة تزيد عليه
         «تتطلّب مدير النظام» وهو خطأٌ في صفحاتٍ تخصّ الماليّةَ أو الدعم.
         والوصفُ موجودٌ في فهرس الصلاحيّات أصلا، فيُقال. */
      const what = permissionDescriptionAr(key)
      const who = rolesWithPermissionAr(key)
      const message_ar = what
        ? `هذا الإجراء يتطلّب صلاحيّة «${what}»${who.length ? ` — يملكها: ${who.join('، ')}` : ''}.`
        : 'لا تملك الصلاحية المطلوبة لهذا الإجراء'
      return reply.status(403).send({ error: { code: 'forbidden', message_ar, required: key } })
    }
  }
}

/* ═══ وحارسُ «أيٍّ منهما» — لفعلٍ واحدٍ يملكه دوران بحبّتين مختلفتين (٢٦ أكتوبر ٢٠٢٦) ═══

   أوّلُ ما احتاجه: أجرُ المدرّب. قال صاحبُ المنصّة «C»: يضبطه المديرُ الأكاديميّ (`trainer.contract.manage`) أو
   الماليّة (`trainer.compensation.manage`)، والأثرُ يقول من فعل. ولا تُمنح إحداهما الحبّةَ الأخرى: تلك تفتح عليها
   ما ليس من شأنها. والردُّ يسمّي الحبّتين ومن يملك كلّا منهما، كما يسمّي `requirePermission` حبّتَه. */
export function requireAnyPermission(...keys: PermissionKey[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) {
      return reply.status(401).send({ error: { code: 'unauthenticated', message_ar: 'سجّل الدخول أولا' } })
    }
    if (!keys.some((k) => req.auth!.permissions.includes(k))) {
      const each = keys.map((k) => {
        const what = permissionDescriptionAr(k) ?? k
        const who = rolesWithPermissionAr(k)
        return `«${what}»${who.length ? ` (يملكها: ${who.join('، ')})` : ''}`
      })
      const message_ar = `هذا الإجراء يتطلّب إحدى صلاحيّتين: ${each.join(' أو ')}.`
      return reply.status(403).send({ error: { code: 'forbidden', message_ar, required: keys } })
    }
  }
}

/** حارس دخول فقط — أي مستخدم موثق */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth) {
    return reply.status(401).send({ error: { code: 'unauthenticated', message_ar: 'سجّل الدخول أولا' } })
  }
}
