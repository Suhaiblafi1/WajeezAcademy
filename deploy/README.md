# نشر وجيز على خادمٍ تملكه

> ## ⚠️ هذا هو الإنتاج — وقد حُذف مرّةً بحجّةٍ خاطئة
>
> **ما في هذا المجلّد هو ما يخدم `www.wajeezacademy.com` فعلا.**
>
> حُذف كلُّه في `edc7576` (#25) بوصفه «تصميما لم يُستعمل قطّ»، وكان هذا
> الوصفُ مكتوبا في هذا الملفّ نفسِه — ادّعاءً لم يُقابَل بقياس. والقياسُ
> يكذّبه: النطاقُ كان يُحلّ يومَها (٥ سبتمبر ٢٠٢٦) إلى عنوانٍ في نطاق Hetzner،
> وCloudways لا تقدّم Hetzner أصلا. وأكّده من يملك الخادم: حاويات Docker،
> ولا وجودَ لـ`/etc/supervisor/conf.d` عنده.
>
> **وقد انتقل الخادمُ بعدها** (٧ سبتمبر) إلى جهازٍ آخرَ داخل Hetzner —
> والتصميمُ نفسُه: حاويات Docker خلف Caddy. فالحكمُ باقٍ، والعنوانُ وحدَه
> تغيّر. **ولهذا لا يُكتب العنوانُ في وثيقة**: `dig +short www.wajeezacademy.com`.
>
> فأُعيد في `#29`. **ولا يُحذف ثانيةً إلّا بعد قياسٍ يُثبت أنّ النطاق انتقل**
> — لا بعد قراءةِ وثيقةٍ تقول ذلك.
>
> ### ولماذا حذفُه خطرٌ لا إزعاج
>
> `Caddyfile` هو **الموضعُ الوحيدُ الذي تُطبَّق فيه ترويساتُ الأمان على هذا
> الخادم**: سياسةُ المحتوى (CSP)، وHSTS، و`nosniff`. وقد نُقلت في #25 إلى
> `public/.htaccess` — **وCaddy لا يقرأ `.htaccess` بتاتا** (وهو ملفُّ Apache).
> فلو حُدِّث هذا الخادمُ إلى `main` بلا هذا المجلّد **لسقطت الترويساتُ كلُّها
> صامتةً**: لا خطأ، ولا اختبارٌ يحمرّ — فحارسُها
> `src/tests/deploy/htaccess-spa-rewrite.test.ts` يقرأ **نصَّ الملفّ** ولا
> يتحقّق من أنّ خادمَ ويبٍ يقرؤه.
>
> **والمرجعُ للواقع الحاليّ: [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) §١.**

خادمٌ واحد يشغّل ثلاث حاويات: **Postgres 16** · **خادم وجيز** (Fastify) ·
**Caddy** (شهادة TLS تلقائية وواجهة ساكنة).

الحدّ الأدنى: نواتان و٤ غيغا ذاكرة و٤٠ غيغا قرصا. Ubuntu 24.04 LTS.

---

## ١ · تجهيز الخادم (مرّة واحدة)

```bash
# مستخدمٌ غير root في مجموعة docker
adduser wajeez && usermod -aG docker,sudo wajeez

# Docker و rclone
curl -fsSL https://get.docker.com | sh
apt install -y rclone

# الجدار: لا شيء مفتوح إلا الويب و SSH
ufw default deny incoming && ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# SSH بالمفاتيح وحدها
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh

# ترقيعات الأمان تلقائيا
apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

> **لا تنشر منفذ Postgres إلى المضيف.** `compose.prod.yml` لا ينشره بقصد —
> قاعدةٌ مكشوفة على 5432 تجدها الماسحات الآلية خلال ساعات، وهي تحمل سجلّات الدفع.

## ٢ · الشيفرة والإعدادات

```bash
sudo mkdir -p /opt/wajeez && sudo chown wajeez: /opt/wajeez
git clone <رابط المستودع> /opt/wajeez && cd /opt/wajeez

cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
nano deploy/.env.production      # املأ كل حقلٍ فارغ
```

توليد الأسرار:

```bash
openssl rand -base64 32   # POSTGRES_PASSWORD
openssl rand -hex 32      # STORAGE_SECRET
```

> **`STORAGE_SECRET` اضبطه صراحةً.** يُولَّد تلقائيا اليوم ويُكتب في
> `storage/private/.secret` — وخادمٌ جديد يولّد غيره، فتنكسر كلّ روابط الملفّات
> الموقَّعة سابقا.

## ٣ · وجهة النسخ الاحتياطي — قبل أيّ نشر

```bash
rclone config                 # أنشئ وجهة: S3 · Backblaze B2 · صندوق تخزين
# ثم في deploy/.env.production:
#   BACKUP_REMOTE=wajeez-backup:wajeez/db
```

`deploy/backup.sh` **يرفض العمل** بلا هذه الوجهة. نسخةٌ على القرص نفسه ليست
نسخةً احتياطية: عطبُ القرص يأخذ الأصل والنسخة معا.

## ٤ · وجّه النطاق ثم انشر

`A` من نطاقك إلى عنوان الخادم. Caddy يجلب الشهادة تلقائيا عند أوّل إقلاع.

```bash
bash deploy/deploy.sh
```

ثم فعّل النسخة الليلية:

```bash
sudo cp deploy/wajeez-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wajeez-backup.timer
systemctl list-timers wajeez-backup
```

## ٥ · أثبت الاسترجاع — قبل تحويل النطاق نهائيا

```bash
bash deploy/backup.sh              # خذ نسخة
bash deploy/backup.sh --verify     # نزّلها واسترجعها في قاعدة خدش
```

يجب أن يقول: `✓ استُرجعت النسخة: N مستخدما · M طلبا`.
**قبل أن ترى هذا السطر مرّة واحدة، ليس عندك نسخٌ احتياطي.** أعده شهريا.

---

## نقل البيانات من Neon

```bash
# على جهازك — لا تضع رابط Neon في أيّ ملفٍّ داخل المستودع
pg_dump "$NEON_URL" --clean --if-exists -Fp | gzip -9 > neon.sql.gz
scp neon.sql.gz wajeez@<الخادم>:/tmp/

# على الخادم
cd /opt/wajeez
C="docker compose -f deploy/compose.prod.yml --env-file deploy/.env.production"
gunzip -c /tmp/neon.sql.gz | $C exec -T db psql -U wajeez -d wajeez
$C run --rm --no-deps app npx prisma migrate deploy
rm /tmp/neon.sql.gz
```

الجلسات مخزَّنة في جدولٍ بـ`tokenHash` لا في كعكةٍ موقَّعة — فنقلُ البيانات
**لا يُخرج أحدا من حسابه**.

## سترايب — الخطوة التي تُفقد المال إن أُخطئت

١. أضف نقطة webhook جديدة: `https://<نطاقك>/api/payments/webhook`
٢. انسخ `whsec_…` إلى `PAYMENT_WEBHOOK_SECRET` وأعد النشر
٣. **أرسل حدث اختبار من لوحة سترايب وتأكّد من ٢٠٠**
٤. أبقِ نقطة Vercel القديمة حتّى تتيقّن

> Caddy هنا يمرّر الجسم كما وصل. لا تُدخل أيّ وسيطٍ يعيد ترميز الجسم على
> مسار `/api` — التوقيع يُحسب على البايتات نفسها، وأيّ تعديلٍ يُسقط كلّ حدث:
> مالٌ يُقبض ولا تسجيلَ يُنشأ.

---

## التشغيل اليوميّ

```bash
C="docker compose -f deploy/compose.prod.yml --env-file deploy/.env.production"

$C ps                    # الحالة
$C logs -f app           # سجلّ الخادم
$C logs -f caddy         # الشهادة والوصول
$C restart app           # إعادة تشغيل
bash deploy/deploy.sh    # نشر إصدار جديد
```

**الرجوع إلى إصدارٍ سابق:**

```bash
git log --oneline -10
git checkout <الإصدار>
SKIP_PULL=1 bash deploy/deploy.sh
```

> الرجوع يُعيد الشيفرة لا القاعدة. هجرةٌ حذفت عمودا لا يردّها `git checkout` —
> ولهذا يأخذ `deploy.sh` نسخةً قبل كلّ هجرة.

## النشر التلقائي — **الخادمُ يسأل، ولا يُسأل**

> **صُحّح في ٧ سبتمبر ٢٠٢٦.** كان هذا القسمُ يقول إنّ
> `.github/workflows/deploy.yml` ينشر عند خضرة CI، ويطلب أربعةَ أسرارِ SSH.
> **وذلك الملفُّ لا وجودَ له في `main`** — مجلّدُ `.github/workflows/` فيه
> `ci.yml` وحدَه، ولا شيءَ في المستودَع يستدعي `deploy.sh` تلقائيّا. (الملفُّ
> موجودٌ في فرعٍ لم يُدمج قطّ.)
>
> وهذه أخطرُ صيغةٍ للوثيقة الكاذبة: **تجعل قارئَها يظنّ أنّ شيئا يحدث ولا
> يحدث.** فيُدمج العملُ ويُظنّ أنّه وصل الموقعَ، وهو لم يبرح المستودَع.

**الطريقُ الموصى به لا يحتاج سرّا واحدا.**

النشرُ من GitHub يقتضي أن يحمل GitHub مفتاحَ خادمك — أي أن تثق بكلّ من يملك
صلاحيّةَ الكتابة في المستودَع. وقرارُ صاحب المنصّة أن **لا تخرج مفاتيحُ
الخادم منه**. فقُلب الاتّجاه: الخادمُ يسأل `main` كلَّ خمس دقائق، فإن تحرّكت
نشر نفسَه، وإلّا خرج صامتا. لا مفتاحَ في GitHub، ولا منفذَ مفتوحٌ لأحد.

### أمرٌ واحد، مرّةً واحدة، على الخادم

```bash
cd /opt/wajeez
bash scripts/install-auto-deploy.sh
```

يفحص الشروطَ ويقف عند أوّل نقص · ثمّ ينشر ما في `main` الآن أمام عينك ·
ثمّ يركّب سطرَ الجدولة. **وآمنُ الإعادة**: تشغيلُه مرّتين لا يضع سطرَين.

- **السجلّ:** `~/wajeez-deploy.log`
- **التراجع:** `crontab -e` ثمّ احذف السطر. لا شيءَ غيرُه يتغيّر.
- **فحصٌ بلا تنفيذ:** `bash scripts/deploy-watch.sh --check`

> ولمن لا طرفيّةَ عنده: طرفيّةُ Hetzner في المتصفّح تكفي —
> [console.hetzner.cloud](https://console.hetzner.cloud) ← الخادم ← **Console**.
> لا SSH ولا أدواتٌ تُنزَّل.

### وهل النشرُ يعمل الآن؟ — فحصٌ بلا طرفيّة

افتح `‎/api/version` على نطاقك، أو انظر السطرَ في أسفل أيّ شاشةِ إدارة، وقارن
البصمةَ بآخر التزامٍ دُمج إلى `main`. تطابقُهما هو الجواب — وهو ما بُني له
ختمُ البناء (البند ٦).

### والمسارُ الآخر — بأسرارِ SSH

يبقى ممكنا وموصوفا في الفرع الذي يحمله، **ولا يُنصح به ما دام البديلُ أعلاه
قائما**: يُخرج مفتاحَ الخادم إلى طرفٍ ثالث، وهو ما امتنع عنه القرارُ أصلا.

---

## ما بقي بلا حلّ

> ### ⚠️ صُحّح في ٧ سبتمبر ٢٠٢٦ — المجدولُ يعمل، وهذا القسمُ كان يقول إنّه لا يعمل
>
> **كان هنا: «لا مجدول يعمل … والسكربتُ نفسه لم يُكتب بعد».** وهو خطأ،
> وخطؤه من جنس ما صُحّح في #41: وثيقةٌ تَعِد بآليّةٍ لا وجودَ لها — إلّا أنّ
> هذه تنفي آليّةً **موجودة**.
>
> **والقياسُ في المستودَع نفسِه:** [`compose.prod.yml`](compose.prod.yml)
> فيه خدمةُ `worker` (السطر ٩٣) — الصورةُ نفسُها بأمرٍ آخر
> (`npx tsx server/worker/index.ts`)، و`WORKER_ENABLED: "on"`، و
> `restart: unless-stopped`. **وتُقلع مع أوّل `bash deploy/deploy.sh`**، ولا
> تحتاج يدا. ووظائفُها الستُّ موصوفةٌ ومُجرَّبةٌ على قاعدةٍ حقيقيّةٍ في
> [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) §١٠، ويحرسها
> [`server/tests/worker/jobs.test.ts`](../server/tests/worker/jobs.test.ts).
>
> **ولا يُكتب لها مؤقّتُ `systemd`** — وهو ما كان هذا القسمُ يطلبه. الحاويةُ
> تحمل الحلقةَ بنفسها، ومؤقّتٌ فوقها يعني عمليّتين على الطابور نفسِه: يُخرج
> الثانيةَ قفلٌ في القاعدة (`pg_advisory_lock`) بلا ضجيج — **فيضيع الجهدُ
> ويبقى القارئُ موهوما أنّه أصلح شيئا**.

**`/docs` مفتوح للعموم** — يعرض سطح الواجهة كاملا. لإغلاقه: انظر التعليق في
[`deploy/Caddyfile`](Caddyfile).
