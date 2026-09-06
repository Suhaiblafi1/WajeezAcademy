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
RUN apk add --no-cache openssl tini

WORKDIR /app

# طبقة الاعتماديات وحدها أولا: تعديل الشيفرة لا يُبطل ذاكرة npm ci
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
RUN npx prisma generate && npm run build

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=7101

EXPOSE 7101

# فحص الصحة من داخل الحاوية: Compose لا يرفع Caddy قبل أن يجيب الخادم
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||7101)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/app/deploy/docker-entrypoint.sh"]
CMD ["npx", "tsx", "server/index.ts"]
