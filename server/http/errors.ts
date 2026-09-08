/* معالجة الأخطاء الموحدة — كل رد خطأ بصيغة { error: { code, message_ar } } */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError, type ZodIssue } from 'zod'
import { AuthError } from '../services/auth.service'

/* ═══ لمَ تُترجَم رسالةُ التحقّق ═══

   كان الردُّ يُلصق نصَّ Zod كما هو، فيقرأ المتقدّمُ العربيُّ في نموذج
   الانضمام:

     «حقل غير صالح: availability.seasons — Invalid input: expected array,
      received undefined»

   وهي جملةٌ إنجليزيّةٌ في واجهةٍ عربيّةٍ كلُّها، تصف حالةَ متغيّرٍ في
   الخادم لا ما يفعله القارئ. رصدَتها جولةُ البند ③ في أخطر موضعٍ ممكن:
   زرُّ «أرسل طلب الانضمام».

   والقاعدةُ هنا: **ما كُتب بالعربيّة في المخطَّط يُقدَّم كما هو** — فالرسالةُ
   التي كتبها مؤلّفُ الحقل أدقُّ من أيّ ترجمةٍ عامّة (مثل «اختر فصلا واحدا على
   الأقلّ تستطيع التدريس فيه»). وما لم يُكتب له نصٌّ عربيٌّ يُترجَم من **صنف
   العطب** لا من نصّ Zod.

   والتمييزُ بحرفٍ عربيٍّ في الرسالة: لا حاجةَ إلى سجلٍّ يُمسك بالتوازي، ولا
   إلى تغليف كلّ `z.string()` في المستودَع. */

/** أفيه حرفٌ عربيّ؟ — فالرسالةُ حينئذٍ مكتوبةٌ بيد مؤلّف الحقل لا من Zod */
const HAS_ARABIC = /[؀-ۿ]/

function issueAr(issue: ZodIssue): string {
  if (issue.message && HAS_ARABIC.test(issue.message)) return issue.message
  switch (issue.code) {
    case 'invalid_type':
      /* الغائبُ ليس «نوعا خاطئا» عند من يقرأ — هو حقلٌ لم يُملأ.
         و Zod لا يضع `input` على هذا العطب حين يكون الحقلُ غائبا (قِيس على
         4.4.3: مفاتيحُ العطب `expected · code · path · message` لا غير)،
         فالغيابُ يُستدلّ عليه من رسالته الافتراضيّة. وإن تغيّرت صيغتُها
         سقط الاستدلالُ إلى الرسالة العامّة — لا إلى نصٍّ إنجليزيّ. */
      return /received undefined/i.test(issue.message ?? '')
        ? 'حقلٌ مطلوبٌ لم يصل'
        : 'نوعُ القيمة غير متوقَّع'
    case 'too_small': return 'القيمةُ دون الحدّ الأدنى'
    case 'too_big': return 'القيمةُ فوق الحدّ الأعلى'
    case 'invalid_format': return 'الصيغةُ غير صحيحة'
    case 'invalid_value': return 'قيمةٌ غير مقبولة في هذا الحقل'
    case 'unrecognized_keys': return 'حقلٌ لا يعرفه هذا الطلب'
    case 'invalid_union': return 'القيمةُ لا تطابق أيّا من الصيغ المقبولة'
    case 'not_multiple_of': return 'القيمةُ ليست من مضاعفات المطلوب'
    default: return 'قيمةٌ غير صالحة'
  }
}

export function errorHandler(err: FastifyError | AuthError | ZodError, _req: FastifyRequest, reply: FastifyReply) {
  if (err instanceof ZodError) {
    const first = err.issues[0]
    /* المسارُ يبقى: هو أدلُّ ما يُعطى للدعم حين يسأل «أيُّ حقل؟». ويسبقه
       نصٌّ عربيٌّ يفهمه صاحبُ الشاشة بلا وسيط. */
    const path = first?.path.join('.') ?? ''
    return reply.status(422).send({
      error: {
        code: 'validation',
        message_ar: path
          ? `${issueAr(first)} — الحقل «${path}»`
          : issueAr(first),
      },
    })
  }
  if (err instanceof AuthError) {
    return reply.status(err.status).send({ error: { code: err.code, message_ar: err.messageAr } })
  }
  const fe = err as FastifyError
  const status = fe.statusCode && fe.statusCode >= 400 ? fe.statusCode : 500
  if (status >= 500) console.error('[api]', fe)
  return reply.status(status).send({
    error: {
      code: fe.code ?? 'internal',
      message_ar: status >= 500 ? 'خطأ داخلي غير متوقع' : fe.message,
    },
  })
}
