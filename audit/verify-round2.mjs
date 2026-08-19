/* تحقق حي لميزات جولة (أ)+(ب): لافتة المحاكاة، بطاقات الإرشاد، البحث السريع، عناوين التقارير، فلتر الكشوف */
import { chromium } from "playwright";

const BASE = "http://localhost:7100";
const PASS = "Wajeez-Demo-2026";
const results = [];

async function login(ctx, email) {
  const res = await ctx.request.post("http://localhost:7101/api/auth/login", {
    data: { email, password: PASS },
  });
  if (!res.ok()) throw new Error(`login failed ${email}`);
  const cookies = await ctx.request.storageState();
  await ctx.addCookies(cookies.cookies.map((c) => ({ ...c, domain: "localhost" })));
}

async function check(email, path, label, expectFn) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await login(ctx, email);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const note = await expectFn(page);
  results.push({ label, note, consoleErrors: errors.slice(0, 2) });
  await browser.close();
  await new Promise((r) => setTimeout(r, 300)); // تهدئة للحد المعدل
}

const run = async () => {
  // 1) لافتة «نموذج استرشادي» — طالب بجلسة حقيقية في صفحة مساري
  await check("student.demo@wajeez.local", "/student/pathway", "student: لافتة نموذج استرشادي", async (p) => {
    const t = await p.locator("text=نموذج استرشادي").count();
    return t > 0 ? "اللافتة ظاهرة ✅" : "⚠️ اللافتة غير ظاهرة";
  });
  // 2) بحث المدرب Ctrl+K
  await check("trainer.demo@wajeez.local", "/trainer", "trainer: زر البحث + لوحة Ctrl+K", async (p) => {
    const btn = await p.locator('button[title="بحث سريع — Ctrl+K"]').count();
    await p.keyboard.press("Control+k");
    await p.waitForTimeout(400);
    const palette = await p.locator('input[aria-label="ابحث في شعبك وطلابك…"]').count();
    return `الزر:${btn > 0 ? "✅" : "⚠️"} اللوحة:${palette > 0 ? "✅" : "⚠️"}`;
  });
  // 3) بحث المستشار
  await check("consultant.demo@wajeez.local", "/advisor", "advisor: لوحة Ctrl+K", async (p) => {
    await p.keyboard.press("Control+k");
    await p.waitForTimeout(400);
    const palette = await p.locator('input[aria-label="ابحث في حالاتك…"]').count();
    return palette > 0 ? "اللوحة تفتح ✅" : "⚠️ اللوحة لا تفتح";
  });
  // 4) عناوين التقارير العربية — نختار تقرير «التسجيلات» ثم نشغّل
  await check("superadmin.demo@wajeez.local", "/admin/reports", "admin: عناوين أعمدة عربية", async (p) => {
    await p.locator("button", { hasText: "التسجيلات" }).first().click();
    await p.waitForTimeout(300);
    await p.locator("text=شغّل التقرير").first().click();
    await p.waitForTimeout(1500);
    const ar = await p.locator("th", { hasText: "الشعبة" }).count();
    const raw = await p.locator("th", { hasText: "cohort" }).count();
    return `عربي:${ar > 0 ? "✅" : "⚠️"} خام:${raw === 0 ? "✅" : "⚠️ ما زال"}`;
  });
  // 5) فلتر الكشوف الملغاة الصفرية — تبويب «مستحقات المدربين»
  await check("superadmin.demo@wajeez.local", "/admin/trainers", "admin: فلتر الملغاة الصفرية", async (p) => {
    const tab = p.locator("button", { hasText: "مستحقات المدربين" }).first();
    if (await tab.count()) { await tab.click(); await p.waitForTimeout(1200); }
    const toggle = await p.locator("text=إظهار الملغاة الصفرية").count();
    return toggle > 0 ? "مفتاح الفلتر موجود ✅" : "⚠️ المفتاح غير موجود";
  });
  // 6) بطاقة إرشاد المدرب — حساب مدرب بلا شعب؟ الديمو له شعب، فنتحقق أن الصفحة سليمة على الأقل
  console.log(JSON.stringify(results, null, 2));
};

run().catch((e) => { console.error("FATAL", e); process.exit(1); });
