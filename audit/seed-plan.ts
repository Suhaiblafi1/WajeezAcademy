/* إنشاء خطة تقديم للشعبة — يحاكي ناتج «اقتراح مدرب معتمد» (سلسلة الاقتراحات مختبرة وحدها) */
import { getPrisma, disconnectPrisma } from '../server/db/client'

const [cohortId, trainerId] = process.argv.slice(2)
if (!cohortId) throw new Error('cohortId مطلوب')
const prisma = await getPrisma()
const plan = await prisma.cohortDeliveryPlan.create({
  data: {
    cohortId,
    trainerId: trainerId || null,
    status: 'published',
    content: { schedule: 'أسبوعي', examples: [], extraMaterials: [], activities: [], ordering: 'default' },
  },
})
console.log('plan:', plan.id, plan.status)
await disconnectPrisma()
