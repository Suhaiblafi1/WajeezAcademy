/* محرّرُ الملفّ العامّ في الإدارة — بنيةٌ لا نصّ.

   ═══ العطبُ الذي كُتب له ═══

   `headline` و`bioPublic` يُبذران مرّةً من نصّ الطلب ثمّ لا يُعدَّلان أبدا،
   و`photoUrl` عمودٌ لا يكتبه شيء. وصفحةُ الفريق تعرض الثلاثةَ للعامّة.

   ═══ وما يُفحص ═══

   أنّ الشاشةَ تنادي المسارَين القائمَين، وأنّ حقلَ الرفع يقبل صيغَ الصور
   وحدَها، وأنّ صفحةَ الفريق تعرض الصورةَ حين توجد. والفحصُ على البنية:
   تعليقٌ يذكر «صورة» لا يُمرّره، وحذفُ النداء يُسقطه. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const code = (p: string) =>
  readFileSync(join(root, p), 'utf8').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

const screen = code('src/pages/admin/TrainerRunOps.tsx')
const routes = code('server/http/routes/admin-trainer.routes.ts')
const publicRoutes = code('server/http/routes/trainer-applications.routes.ts')
const teamPage = code('src/pages/Trainers.tsx')

describe('محرّرُ الملفّ العامّ', () => {
  it('يُعرض لكلّ مدرّبٍ في الشاشة — لا لواحدٍ مختار', () => {
    expect(screen).toMatch(/<PublicProfileEditor\s+trainer=\{t\}/)
  })

  it('وينادي مسارَي الحفظ والرفع، وهما مسجَّلان في الخادم', () => {
    expect(screen, 'لا ينادي الحفظ').toMatch(/\/public-profile`/)
    expect(screen, 'لا ينادي الرفع').toMatch(/\/photo-upload`/)
    expect(routes).toContain("app.put('/api/admin/trainers/:profileId/public-profile'")
    expect(routes).toContain("app.post('/api/admin/trainers/:profileId/photo-upload'")
  })

  it('وكلاهما خلف `trainer.publish` — من يعتمد الظهورَ يحرّر ما يَظهر', () => {
    for (const path of ['public-profile', 'photo-upload']) {
      const at = routes.indexOf(`/api/admin/trainers/:profileId/${path}'`)
      expect(at, `${path}: لا مسار`).toBeGreaterThan(-1)
      expect(routes.slice(at, at + 300), `${path}: بلا حارس`).toContain("requirePermission('trainer.publish')")
    }
  })

  it('وحقلُ الملفّ يقبل صيغَ الصور وحدَها', () => {
    expect(screen).toMatch(/accept="image\/jpeg,image\/png,image\/webp"/)
  })

  it('والبايتاتُ تُرفع إلى الرابط الموقّت مباشرةً — لا في جسم JSON', () => {
    /* الجسمُ مُعرِّفٌ مجرّد — لا `JSON.stringify`. وكان الحارسُ يشترط اسمَ
       المتغيّر `file` بعينه، فسقط يومَ صار المرفوعُ قالبا مؤطَّرا اسمُه
       `blob`: اشتراطُ اسمٍ يقيس التسميةَ لا البنية. */
    expect(screen, 'الملفُّ يمرّ في JSON فيضخم ويُقرأ نصّا').toMatch(/method:\s*"PUT"[\s\S]{0,160}body:\s*[A-Za-z_$][\w$]*\s*,/)
    const put = screen.indexOf('method: "PUT"')
    expect(screen.slice(put, put + 200), 'الجسمُ مُسلسَلٌ نصّا').not.toContain('JSON.stringify')
  })
})

describe('المسارُ العامُّ للصورة', () => {
  it('مسجَّلٌ ويحرسه شرطُ النشر بعينه لا توقيعٌ موقَّت', () => {
    expect(publicRoutes).toContain("app.get('/api/v1/trainer-photos/:storageKey'")
    const at = publicRoutes.indexOf("app.get('/api/v1/trainer-photos/:storageKey'")
    const body = publicRoutes.slice(at, at + 900)
    expect(body, 'بلا شرطِ النشر').toContain('PUBLIC_TRAINER_WHERE')
    expect(body, 'المفتاحُ من العنوان بلا تحقّقٍ من شكله').toContain('assertSafeKey')
    expect(body, 'توقيعٌ موقَّتٌ على صورةٍ تُعرض في صفحةٍ عامّة').not.toContain('verifySignature')
  })
})

describe('صفحةُ الفريق', () => {
  it('تعرض الصورةَ حين توجد', () => {
    expect(teamPage).toMatch(/t\.photoUrl\s*\?/)
    expect(teamPage).toMatch(/src=\{t\.photoUrl\}/)
  })
})
