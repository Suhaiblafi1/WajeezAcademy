# نشر وجيز على خادمٍ تملكه

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

## النشر التلقائي (اختياري)

`.github/workflows/deploy.yml` ينشر عند نجاح CI على `main`. يحتاج أسرارا في
Settings ← Secrets ← Actions: `SSH_HOST` · `SSH_USER` · `SSH_KEY` ·
`SSH_KNOWN_HOSTS` (من `ssh-keyscan -H <العنوان>`).

بلا هذه الأسراريبقى النشر يدويا بـ`deploy/deploy.sh` — وهو خيارٌ مشروع.

---

## ما بقي بلا حلّ

**لا مجدول يعمل.** المخطّط يكتب `scheduledPublishAt` و`nextFollowUpAt`
و`nextDueAt`، ومسار الخطّة يَعِد «نُعلمك عند فتحها» — ولا شيء ينفّذها. على
هذا الخادم صار الحلّ مؤقّت `systemd` واحدا على غرار مؤقّت النسخ الاحتياطي،
لكنّ **السكربت نفسه لم يُكتب بعد**. النقل لا يصلح هذا؛ يجعله سهلا فحسب.

**`/docs` مفتوح للعموم** كما هو على Vercel اليوم — يعرض سطح الواجهة كاملا.
لإغلاقه: انظر التعليق في `deploy/Caddyfile`.
