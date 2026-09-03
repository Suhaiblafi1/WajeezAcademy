/* ── السلّةُ والتسعير: «بكم هذه، وأيجوز شراؤها؟» ──

   خدمةُ التجارة كانت ألفا ومئةً وواحدا وتسعين سطرا في صنفٍ واحد: السلّةُ
   والتسعيرُ والطلباتُ والدفعُ والاستردادُ والكوبوناتُ والخُطط. وهي **أرجحُ
   ملفٍّ في المستودع أن يُخفي خطأَ المال القادم** — لأنّ من يقرؤه باحثا عن
   سببِ فاتورةٍ خاطئة يمرّ على ألفِ سطرٍ لا علاقةَ لها بالفاتورة.

   والقطعُ هنا على أوضح فصلٍ في المعنى: **سؤالُ «بكم هذه وأيجوز شراؤها؟»
   منفصلٌ عن فعلِ «حرِّك المال»**. فما في هذا الملفّ **لا يكتب صفّا واحدا**:
   يقرأ الشعبَ والكوبونَ والهديّةَ ويحسب. وما بقي في `commerce.service`
   يُنشئ الطلبَ ويقبض ويستردّ.

   والقطعُ **بلا تغييرِ سلوك**: التسعُ المنقولةُ لا تستعمل من الخدمة إلّا
   `prisma` وبعضَها بعضا — لا حالةَ مشتركةً ولا نداءً عائدا. نُقلت كما هي،
   وخدمةُ التجارة تُركّبها.

   ولمَ حاجزُ البريد معها: «أيجوز شراؤها؟» سؤالٌ من أسئلة السلّة لا من
   تحريك المال. وشرطُه الثالثُ موضعُ الدقّة: يسقط الحاجزُ حين لا تكون قناةُ
   البريد موصولةً أصلا — وإلّا صار قفلا بلا مفتاح. */

import type { PrismaClient } from '@prisma/client'
import { AuthError } from '../auth.service'
import { priceCart } from '../../../src/application/commerce/cart-pricing'
import { LEDGER_CURRENCY } from '../../../src/application/commerce/presentment'
import { getEmailConfig } from '../integrations.service'
import { assertCouponUsable, cartTitleOf, num, type CartCohort } from './cart-types'

export class CartService {
  private prisma: PrismaClient
  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /** هل بريد صاحب الطلب موثَّق؟ — قراءةٌ واحدة، والحاجز يقرّر بها */
  async emailVerified(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } })
    return u?.emailVerifiedAt != null
  }

  /** هل تستطيع المنصّة إرسال بريد أصلا؟ — بها وحدها يصير الحاجز قفلا له مفتاح */
  async emailChannelEnabled(): Promise<boolean> {
    const cfg = await getEmailConfig(this.prisma)
    return Boolean(cfg.enabled && cfg.host && cfg.fromEmail)
  }

  /* ── الخطّة كاملةً: طلبٌ واحد، وفاتورةٌ واحدة (التوصيتان ٢ و٣) ── */

  /**
   * يطلب التسجيل في كل دورات الخطّة الفعّالة التي لها شعبة مفتوحة، دفعةً واحدة.
   *
   * قبل هذا لم يكن للخطّة بابٌ على الخادم أصلا: زرُّ الشراء في صفحة المسار
   * يفتح نافذةً تحيل المتعلّم إلى «تصفّح الشعب المفتوحة» فيبدأ اختياره من
   * جديد، دورةً دورة. فالخطّة التي بناها بالتشخيص تموت عند الزر.
   *
   * وما لا شعبة له لا يُسكَت عنه: يعود باسمه في `awaiting` ليُقال للمتعلّم
   * قبل أن يدفع أيّ دورةٍ من خطّته لم تُفتح بعد — لا أن يكتشفها بعد الدفع.
   */

  async cohortBlocker(
    userId: string,
    c: CartCohort,
  ): Promise<{ reason: string; messageAr: string } | null> {
    if (!['open', 'full', 'active'].includes(c.status) || !c.registrationOpen) {
      return { reason: 'closed', messageAr: `التسجيل مغلق في «${c.title}»` }
    }
    if (c.price === null) return { reason: 'no_price', messageAr: `«${c.title}» بلا سعر معلن` }

    const already = await this.prisma.enrollment.findFirst({
      where: { userId, cohortId: c.id, status: { in: ['enrolled', 'completed'] } },
    })
    if (already) return { reason: 'already_enrolled', messageAr: `أنت مسجّل في «${c.title}» بالفعل` }

    /* حجزُ مقعدٍ مربوطٌ بطلبٍ حيّ — لا طلبَ ثانيا فوقه.

       القيدُ `userId_cohortId` على `enrollmentRequest` واحدٌ لا يُثنّى، فكان
       الشراءُ الثاني للشعبة نفسِها يُنشئ طلبا جديدا ثمّ **يُحوّل** الحجزَ
       القائم إليه (`upsert` في `checkout`). فمن دفع طلبَه الأوّل ثمّ عاد
       إلى «مساري» — وكانت الشاشةُ لا تزال تعرض «اشترِ الآن» لأنّ الحجزَ لا
       يظهر فيها — ضغط مرّةً أخرى، فانتقل الحجزُ إلى الطلب الثاني، ثمّ وصل
       webhook الأوّل فوجد `seat_held` بلا حجزٍ يحوّله: فاتورةٌ مدفوعةٌ
       وشعبةٌ لا تُفتح، ومطالبةٌ بدفعٍ ثانٍ عن مقعدٍ دُفع ثمنُه.

       فالحجزُ المربوطُ بطلبٍ حيّ يمنع شراءً ثانيا ويقول أين يُكمَل: المدفوعُ
       يُنتظر تأكيدُه، والذي لم يكتمل دفعُه يُكمَل من «الفواتير» بطلبه
       نفسِه لا بطلبٍ جديد.

       وحجزٌ بلا طلب (طلبُ مراجعةٍ إداريّة) لا يمنع شيئا: لا مالَ فيه
       يُفقد، والشراءُ المباشر يتقدّم عليه كما كان. */
    const hold = await this.prisma.enrollmentRequest.findUnique({
      where: { userId_cohortId: { userId, cohortId: c.id } },
    })
    if (hold?.status === 'seat_held' && hold.orderId) {
      const holdOrder = await this.prisma.order.findUnique({ where: { id: hold.orderId } })
      if (holdOrder?.status === 'paid') {
        return {
          reason: 'settling',
          messageAr: `دفعتُك عن «${c.title}» وصلت ونحن نفتح مقعدك — لا تدفع مرّةً أخرى`,
        }
      }
      if (holdOrder?.status === 'pending_payment') {
        return {
          reason: 'order_pending',
          messageAr: `لك طلبٌ لم يكتمل دفعُه عن «${c.title}» ومقعدُك محجوزٌ به — أكمل دفعه من «الفواتير»`,
        }
      }
    }

    if (c.capacity) {
      const [enrolled, held] = await Promise.all([
        this.prisma.enrollment.count({ where: { cohortId: c.id, status: 'enrolled' } }),
        this.prisma.enrollmentRequest.count({ where: { cohortId: c.id, status: 'seat_held' } }),
      ])
      if (enrolled + held >= c.capacity) {
        return { reason: 'capacity_full', messageAr: `لا مقاعد متاحة في «${c.title}»` }
      }
    }
    return null
  }

  /* تصنيفُ السلّة: ما يُشترى وما استُبعد وبأيّ سبب — بلا رمي.

     ويبقى الرميُ لما ليس سببَ استبعادٍ أصلا بل خللٌ في الطلب نفسِه: سلّةٌ
     فارغة، أو معرّفُ شعبةٍ لا وجودَ لها. */
  async classifyCart(userId: string, cohortIds: string[]) {
    if (cohortIds.length === 0) throw new AuthError('empty_cart', 'لا شعبة في طلبك')
    const unique = [...new Set(cohortIds)]

    const cohorts = await this.prisma.cohort.findMany({
      where: { id: { in: unique } },
      include: { course: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
    })
    if (cohorts.length !== unique.length) throw new AuthError('not_found', 'شعبة غير موجودة ضمن طلبك', 404)

    const buyable: CartCohort[] = []
    const excluded: { cohortId: string; courseId: string; titleAr: string; reason: string; messageAr: string }[] = []
    for (const c of cohorts) {
      const blocker = await this.cohortBlocker(userId, c)
      if (blocker) {
        excluded.push({
          cohortId: c.id, courseId: c.courseId, titleAr: cartTitleOf(c),
          reason: blocker.reason, messageAr: blocker.messageAr,
        })
        continue
      }
      buyable.push(c)
    }
    return { unique, cohorts, buyable, excluded }
  }

  /* عملةُ السلّة — واحدةٌ لا تُخلط: جمعُ مئةِ دولارٍ إلى مئةِ ريالٍ يعطي
     فاتورةً كاذبة. والسلّةُ الفارغةُ تأخذ عملةَ ما طُلب لتُعرض الأصفارُ
     بعملةٍ مفهومة. */
  cartCurrency(buyable: CartCohort[], requested: CartCohort[]): string {
    const currency = buyable[0]?.currency ?? requested[0]?.currency ?? LEDGER_CURRENCY
    if (buyable.some((c) => c.currency !== currency)) {
      throw new AuthError('mixed_currency', 'لا تُجمع شعبٌ بعملاتٍ مختلفة في طلبٍ واحد', 409)
    }
    return currency
  }

  /* السلّةُ المتحقَّقة للشراء — «كلُّ شيءٍ أو لا شيء».

     `checkout` يبقى صارما: أيُّ مانعٍ في أيّ شعبةٍ يرمي قبل أيّ كتابة. فهو
     ما يمنع طلبا ثانيا فوق مقعدٍ دُفع ثمنُه — والاستبعادُ الصامت هنا يعني
     فاتورةً بغير ما ضغط عليه المشتري. */
  async validatedCart(userId: string, cohortIds: string[], requireVerifiedEmail: boolean) {
    /* حاجز توثيق البريد — نفسه الذي في `requestEnrollment`، ولنفس السبب:
       الفاتورة والمواعيد تُرسل إلى عنوان. ويسقط حين تكون قناة البريد معطّلة،
       وإلّا صار قفلا بلا مفتاح.

       ولا يُرفع عند التسعير: من لم يوثّق بريده يرى سعرَه كاملا ثمّ يُطالَب
       بالتوثيق في اللوح نفسِه. ومنعُه من **رؤية** الرقم يجعل الحاجزَ يبدو
       عطبا — وهو شرطٌ مفهومٌ حين يُقال في موضعه. */
    if (requireVerifiedEmail && !(await this.emailVerified(userId)) && (await this.emailChannelEnabled())) {
      throw new AuthError('email_unverified', 'وثّق بريدك أولا — الشراء يُفتح بمجرّد فتح رابط التوثيق', 403)
    }

    const { unique, cohorts, buyable, excluded } = await this.classifyCart(userId, cohortIds)
    if (excluded.length > 0) {
      const first = excluded[0]
      throw new AuthError(first.reason, first.messageAr, 409)
    }
    return { unique, cohorts: buyable, currency: this.cartCurrency(buyable, cohorts) }
  }

  /* الهديّة المستحقّة في هذه السلّة — أو لا هديّة.

     `plan.giftCourseId` كان **رايةَ عرضٍ** وحدَها: تُظهر شارة «هديّة» في
     شاشة الخطّة، والدورةُ تُحاسَب بسعرها الكامل. فصار الخادمُ يفي بها.

     والشرطُ هو نصُّ الوعد حرفيّا: «ودورةٌ من اختيارك هديّة **داخل الخطّة**».
     فالهديّةُ تأتي مع الخطّة لا وحدَها — ولولا هذا لجعل المتعلّمُ أغلى دورةٍ
     هديّتَه ثمّ اشتراها منفردة، فصارت الهديّةُ بابا لأخذ أيّ دورةٍ مجّانا.

     ودورةٌ من الخطّة سُجّل فيها من قبلُ تُحتسب مغطّاة: من اشترى نصفَ خطّته
     الشهر الماضي لا يُحرم هديّتَه لأنّه لم يشترِ كلَّ شيءٍ دفعةً واحدة.

     ومثلُها دورةٌ **دُفع ثمنُها ولم يصل تأكيدُها بعد**: صارت السلّةُ تستبعد
     ما حُجز مقعدُه بطلبٍ حيّ (فلا يُدفع ثمنُه مرّتين)، فلو لم تُحتسب مغطّاةً
     لسقطت الهديّةُ في الدقائق التي بين الدفع وتأكيده — ويُسعَّر عليه الباقي
     بأغلى ممّا وُعد لأنّ الـwebhook تأخّر.

     والمعتبَرُ حجزٌ بطلبٍ **مدفوع** لا بأيّ حجز: لو كفى طلبٌ لم يُدفع لصار
     فتحُ طلبٍ ثمّ إلغاؤه بابا لأخذ الهديّة بلا خطّة. */
  async giftFor(userId: string, orderedCourseIds: Set<string>): Promise<string | null> {
    const plan = await this.prisma.learnerPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      include: { items: { select: { courseId: true } } },
    })
    const giftId = plan?.giftCourseId ?? null
    if (!plan || !giftId) return null
    /* الهديّةُ نفسُها يجب أن تكون في السلّة — لا تُمنح غيابيّا */
    if (!orderedCourseIds.has(giftId)) return null

    const paidPlanCourses = plan.items.map((i) => i.courseId).filter((id) => id !== giftId)
    if (paidPlanCourses.length === 0) return null

    const missing = paidPlanCourses.filter((id) => !orderedCourseIds.has(id))
    if (missing.length > 0) {
      const [enrolled, held] = await Promise.all([
        this.prisma.enrollment.findMany({
          where: { userId, status: { in: ['enrolled', 'completed'] }, cohort: { courseId: { in: missing } } },
          select: { cohort: { select: { courseId: true } } },
        }),
        this.prisma.enrollmentRequest.findMany({
          where: { userId, status: 'seat_held', cohort: { courseId: { in: missing } } },
          select: { orderId: true, cohort: { select: { courseId: true } } },
        }),
      ])
      const paidOrderIds = new Set(
        (await this.prisma.order.findMany({
          where: { id: { in: [...new Set(held.map((h) => h.orderId).filter((x): x is string => !!x))] }, status: 'paid' },
          select: { id: true },
        })).map((o) => o.id),
      )
      const covered = new Set([
        ...enrolled.map((e) => e.cohort.courseId),
        ...held.filter((h) => h.orderId && paidOrderIds.has(h.orderId)).map((h) => h.cohort.courseId),
      ])
      if (missing.some((id) => !covered.has(id))) return null
    }
    return giftId
  }

  async couponFor(userId: string, couponCode?: string) {
    if (!couponCode) return null
    const coupon = await this.prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } })
    assertCouponUsable(coupon, userId)
    /* الفحصُ يرمي عند الغياب — فما بعده كوبونٌ موجود */
    if (!coupon) throw new AuthError('bad_coupon', 'الكوبون غير صالح')
    return coupon
  }

  async priceFor(
    userId: string,
    cohorts: CartCohort[],
    couponCode?: string,
  ) {
    const gift = await this.giftFor(userId, new Set(cohorts.map((c) => c.courseId)))
    const coupon = await this.couponFor(userId, couponCode)
    const pricing = priceCart(
      cohorts.map((c) => ({
        cohortId: c.id, courseId: c.courseId, titleAr: cartTitleOf(c), listPrice: num(c.price),
      })),
      gift,
      coupon ? { percentOff: coupon.percentOff, amountOff: coupon.amountOff === null ? null : num(coupon.amountOff) } : null,
    )
    return { pricing, couponId: coupon?.id, couponCode: coupon?.code ?? null }
  }
}
