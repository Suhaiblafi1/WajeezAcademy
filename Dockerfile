# صورة وجيز — خادم Fastify واحد يعمل طويلا، لا دالة سحابية.
#
# لماذا مرحلة واحدة وبكل الاعتماديات: أدوات الإنتاج هنا ليست أدوات تطوير.
# `prisma` تنشر الهجرات عند كل نشر، و`tsx` تشغّل الخادم، وكلتاهما في
# devDependencies. وتجريدُهما يوجب حزم الخادم بـesbuild — وهي ليست اعتمادية
# معلنة أصلا، فنكون قد بنينا على ما قد يختفي مع أول تحديث. والفرق مئات
# الميغابايت على قرصٍ سعته عشرات الغيغا: ثمنٌ زهيد مقابل خطوةِ بناءٍ أقل تنكسر.

FROM node:22-alpine

# openssl يحتاجها محرك Prisma · tini يجعل PID 1 يمرّر الإشارات فيتوقف
# الخادم بنظافة عند إعادة النشر بدل أن يُقتل بعد مهلة
#
# ── وchromium وخطُّ نوتو العربيّ: ملفُّ المتقدّم يُطبع بهما ──
#
# حين يحجز متقدّمٌ مقابلتَه يصل لجنةَ المراجعة ملفُّه PDF (`server/services/
# trainer-dossier.service.ts`). والعربيّةُ تُكتب متّصلةً — ومكتباتُ PDF في
# JavaScript تكتبها منفصلةً معكوسة. فالطباعةُ في متصفّحٍ بلا نافذة، وهو
# يحسن ذلك لأنّه عملُه.
#
# وchromium **من apk لا من Playwright**: متصفّحاتُ Playwright المنزَّلة
# مبنيّةٌ على glibc، وهذه الصورةُ musl — فلا تعمل عندنا أصلا. ولهذا
# يُمنع تنزيلُها أدناه.
#
# والخطُّ لازمٌ بقدر المتصفّح: صورةُ node الأساسُ **بلا خطوطٍ البتّة**،
# ومتصفّحٌ بلا خطٍّ عربيٍّ يطبع مربّعاتٍ فارغة — ملفًّا يُفتح ولا يُقرأ.
RUN apk add --no-cache openssl tini chromium font-noto font-noto-arabic

WORKDIR /app

# طبقة الاعتماديات وحدها أولا: تعديل الشيفرة لا يُبطل ذاكرة npm ci
#
# ولا تُنزَّل متصفّحاتُ Playwright: المستعمَلُ chromium الذي ثُبّت أعلاه من
# apk (والسببُ مكتوبٌ هناك). وبلا هذا المتغيّر يُنزَّل نحوُ ١٥٠MB في كلّ
# بناءٍ لتُهمَل كلُّها.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ── بصمةُ الالتزام تدخل من الخارج ──
# `.dockerignore` يستثني `.git` بقصد، فلا نسخةَ Git داخل البناء ولا يستطيع
# `write-build-stamp.ts` قراءةَ الالتزام. وبلا هذين الوسيطَين يقول
# `/api/version` «الالتزام: null» فلا يُعرف أهو آخرُ ما دُمج أم نشرةٌ لم تصل.
# ويبقى البناءُ ناجحا بدونهما — الغيابُ يُعلَن ولا يُسقط شيئا.
ARG GIT_COMMIT_SHA=""
ARG GIT_COMMIT_REF=""
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA \
    GIT_COMMIT_REF=$GIT_COMMIT_REF

# توليد عميل Prisma ثم بناء الواجهة. dist تُنسخ عند الإقلاع إلى حجم
# مشترك يقرؤه Caddy — انظر deploy/docker-entrypoint.sh
#
# ⚠️ ولماذا `build:image` لا `build`: الفرقُ `tsc -b` وحدَه.
#
# `build` هو `tsc -b && vite build`، و`tsc -b` **لا يُخرج ملفّا**: كلا
# `tsconfig.app.json` و`tsconfig.node.json` فيهما `noEmit: true`، فهو فحصُ
# أنواعٍ خالص وvite يترجم بنفسه. فلا يعتمد على ناتجه شيءٌ في الصورة.
#
# وقد قِيس على هذا الخادم: من ٨٧ ثانيةِ نشرةٍ كاملة، `tsc -b` وحدَه ~٤٠.
# أي نصفُ زمن النشر في فحصٍ **جرى بالفعل** — CI يشغّل `tsc --noEmit` على
# الملفَّين قبل أيّ دمج، وخضرتُها هي إذنُ الدمج (CLAUDE.md).
#
# ⚠️ وحدُّه صريح: من دفع إلى `main` بلا مرورٍ بـCI لا يُمسك خطؤه هنا.
# والحاجزُ إذن حاجزُ CI لا حاجزُ الصورة — فلا يُضعَّف ذاك.
#
# و`prebuild:image` يبقى: خطّافُ npm يكتب ختمَ البناء قبل البناء، وبلا الختم
# يقول `/api/version` «الالتزام: null» فلا يُعرف أوصلت النشرةُ أم لا.
RUN npx prisma generate && npm run build:image

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=7101

EXPOSE 7101

# فحص الصحة من داخل الحاوية: Compose لا يرفع Caddy قبل أن يجيب الخادم
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||7101)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/app/deploy/docker-entrypoint.sh"]
CMD ["npx", "tsx", "server/index.ts"]
