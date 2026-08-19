/* تحقق بصري: شاشة التكاملات الإدارية + صفحة فواتير الطالب بعد ربط المزود */
import { chromium } from "playwright";

const BASE = "http://localhost:7100";
const results = [];

async function login(ctx, email) {
  const res = await ctx.request.post("http://localhost:7101/api/auth/login", {
    data: { email, password: "Wajeez-Demo-2026" },
  });
  if (!res.ok()) throw new Error(`login failed ${email}`);
  const { cookies } = await ctx.request.storageState();
  await ctx.addCookies(cookies.map((c) => ({ ...c, domain: "localhost" })));
}

async function shot(email, path, file, label, probe) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await login(ctx, email);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const note = probe ? await probe(page) : "";
  await page.screenshot({ path: `audit/pages/${file}.png`, fullPage: false });
  results.push({ label, note, consoleErrors: errors.slice(0, 2) });
  await browser.close();
  await new Promise((r) => setTimeout(r, 300));
}

const run = async () => {
  await shot("superadmin.demo@wajeez.local", "/admin/integrations", "round3_admin_integrations", "admin: شاشة التكاملات", async (p) => {
    const pay = await p.locator("text=مزود الدفع").count();
    const mail = await p.locator("text=خادم البريد").count();
    return `بطاقة الدفع:${pay > 0 ? "✅" : "⚠️"} بطاقة البريد:${mail > 0 ? "✅" : "⚠️"}`;
  });
  await shot("student.demo@wajeez.local", "/student/billing", "round3_student_billing", "student: صفحة الفواتير بمزود اختباري", async (p) => {
    const btn = await p.locator("text=ادفع الآن").count();
    return btn > 0 ? "زر الدفع موجود ✅" : "لا زر دفع (قد لا توجد طلبات معلقة — مقبول)";
  });
  console.log(JSON.stringify(results, null, 2));
};

run().catch((e) => { console.error("FATAL", e); process.exit(1); });
