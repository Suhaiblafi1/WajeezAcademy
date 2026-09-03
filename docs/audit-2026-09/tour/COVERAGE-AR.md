# مصفوفةُ التغطية — جولةُ الأدوار بالمتصفّح

> أُنتجت آليّا من `findings.json` في 2026-09-03 11:13 · 382 لقطة · 1209 ثانية.
>
> ✅ تعمل وفيها محتوى · ⚠️ تعمل وعليها ملاحظة (خطأ كونسول، نداءٌ فاشل، نصٌّ مسرَّب، انسيابٌ أفقيّ) · ⬜ تعمل لكنّها شبهُ فارغة · ⛔ مسدودة («لا صلاحيات») · 🔒 تحوّل إلى الدخول · ↪️ تحوّل إلى صفحةٍ أخرى · ❌ لم تُحمَّل · — لم تُفتح بهذا الدور

| الشاشة | زائر | طالب | مدرّب | مستشار | مدير أكاديميّ | عمليات | تشخيص | مالية | دعم | مدير النظام |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | ✅ | — | — | — | — | — | — | — | — | — |
| `/methodology` | ✅ | — | — | — | — | — | — | — | — | — |
| `/pathways` | ✅ | — | — | — | — | — | — | — | — | — |
| `/courses` | ✅ | — | — | — | — | — | — | — | — | — |
| `/diagnostic` | ✅ | — | — | — | — | — | — | — | — | — |
| `/trainers` | ✅ | — | — | — | — | — | — | — | — | — |
| `/join-trainer` | ✅ | — | — | — | — | — | — | — | — | — |
| `/contact` | ✅ | — | — | — | — | — | — | — | — | — |
| `/auth` | ✅ | — | — | — | — | — | — | — | — | — |
| `/verify` | ⬜ | — | — | — | — | — | — | — | — | — |
| `/stories` | ✅ | — | — | — | — | — | — | — | — | — |
| `/student` | 🔒 | ✅ | ↪️ | ↪️ | — | — | — | — | — | ✅ |
| `/trainer` | 🔒 | ↪️ | ✅ | — | — | — | — | — | — | ⚠️ |
| `/admin` | 🔒 | ↪️ | ↪️ | ↪️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| `/student/learning` | — | ✅ | — | — | — | — | — | — | — | ✅ |
| `/student/learning?stage=C-AUT-101` | — | ✅ | — | — | — | — | — | — | — | ✅ |
| `/student/course/C-AUT-101/module/C-AUT-101-M1` | — | ✅ | — | — | — | — | — | — | — | ✅ |
| `/student/review` | — | ✅ | — | — | — | — | — | — | — | ✅ |
| `/student/skills` | — | ✅ | — | — | — | — | — | — | — | ✅ |
| `/student/certificates` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/billing` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/support` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/inbox` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/notifications` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/account` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/cv` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/vault` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/library` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/rate` | — | ✅ | — | — | — | — | — | — | — | — |
| `/student/pathway` | — | ↪️ | — | — | — | — | — | — | — | — |
| `/trainer/board` | — | — | ✅ | — | — | — | — | — | — | ⚠️ |
| `/trainer/grading` | — | — | ✅ | — | — | — | — | — | — | ⚠️ |
| `/trainer/learners` | — | — | ✅ | — | — | — | — | — | — | ✅ |
| `/trainer/proposals` | — | — | ✅ | — | — | — | — | — | — | ⚠️ |
| `/trainer/earnings` | — | — | ✅ | — | — | — | — | — | — | ⚠️ |
| `/trainer/ratings` | — | — | ✅ | — | — | — | — | — | — | ⚠️ |
| `/advisor` | — | — | — | ✅ | — | — | — | — | — | ✅ |
| `/advisor/learners` | — | — | — | ✅ | — | — | — | — | — | ✅ |
| `/advisor/ratings` | — | — | — | ✅ | — | — | — | — | — | ⚠️ |
| `/advisor/earnings` | — | — | — | ✅ | — | — | — | — | — | ✅ |
| `/admin/catalog` | — | — | — | — | ✅ | ✅ | ✅ | ⛔ | ✅ | ✅ |
| `/admin/authoring` | — | — | — | — | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| `/admin/publishing` | — | — | — | — | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ |
| `/admin/cohorts` | — | — | — | — | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| `/admin/learners` | — | — | — | — | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| `/admin/learner-requests` | — | — | — | — | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/admin/trainers` | — | — | — | — | ✅ | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| `/admin/advisor-requests` | — | — | — | — | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/admin/advisors` | — | — | — | — | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| `/admin/exceptions` | — | — | — | — | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| `/admin/quality` | — | — | — | — | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ |
| `/admin/ratings` | — | — | — | — | ⚠️ | ⛔ | ⛔ | ⛔ | ⛔ | ⚠️ |
| `/admin/finance` | — | — | — | — | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/admin/reports` | — | — | — | — | ✅ | ✅ | ✅ | ✅ | ⛔ | ✅ |
| `/admin/support` | — | — | — | — | ✅ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| `/admin/notifications` | — | — | — | — | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/admin/tasks` | — | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/admin/integrations` | — | — | — | — | ⚠️ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| `/admin/users` | — | — | — | — | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| `/admin/audit` | — | — | — | — | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |

## الملاحظات (48 شاشة)

### مدير أكاديميّ · `/admin` — «الرئيسية — نظرة عامة»
- نصٌّ مسرَّب — حالة إنجليزية خام: «متعلمين (attachedAt) ⏎  ⏎ التسجيلات بحالتها ⏎ enrolled ⏎ 1تسجيل ⏎ completed ⏎ 1تسجيل ⏎  ⏎ التسجيلات مجمعة بالشعبة وا»
- الصورة: `admin.desktop.jpg` · الهاتف: `admin.mobile.jpg`

### مدير أكاديميّ · `/admin/publishing` — «النشر المحكوم وجودة التشخيص»
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_publishing.desktop.jpg` · الهاتف: `admin_publishing.mobile.jpg`

### مدير أكاديميّ · `/admin/advisors` — «المستشارون»
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_advisors.desktop.jpg` · الهاتف: `admin_advisors.mobile.jpg`

### مدير أكاديميّ · `/admin/quality` — «جودة التشخيص والمحاكي»
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_quality.desktop.jpg` · الهاتف: `admin_quality.mobile.jpg`

### مدير أكاديميّ · `/admin/ratings` — «مراجعة تعليقات التقييم»
- نصٌّ مسرَّب — UUID ظاهر: «نتظار المراجعة ⏎ معتمَدة ⏎ محجوبة ⏎ مدرّب ⏎ 5 ★ ⏎ def2f942-5144-4f40-937b-3a6fff0f888e ⏎  ⏎ شرحٌ عمليّ ومباشر — تق»
- الصورة: `admin_ratings.desktop.jpg` · الهاتف: `admin_ratings.mobile.jpg`

### مدير أكاديميّ · `/admin/integrations` — «التكاملات — الدفع والبريد»
- كونسول: The final argument passed to %s changed size between renders. The order and size of this array must remain constant.

Previous: %s
Incoming: %s useEffect [0] [0, super_admin,academic_manager,diagnosti
- الصورة: `admin_integrations.desktop.jpg` · الهاتف: `admin_integrations.mobile.jpg`

### عمليات · `/admin` — «الرئيسية — نظرة عامة»
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- نصٌّ مسرَّب — حالة إنجليزية خام: «متعلمين (attachedAt) ⏎  ⏎ التسجيلات بحالتها ⏎ enrolled ⏎ 1تسجيل ⏎ completed ⏎ 1تسجيل ⏎  ⏎ التسجيلات مجمعة بالشعبة وا»
- الصورة: `admin.desktop.jpg` · الهاتف: `admin.mobile.jpg`

### عمليات · `/admin/authoring` — «تأليف متون الوحدات»
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_authoring.desktop.jpg` · الهاتف: `admin_authoring.mobile.jpg`

### عمليات · `/admin/publishing` — «النشر المحكوم وجودة التشخيص»
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_publishing.desktop.jpg` · الهاتف: `admin_publishing.mobile.jpg`

### عمليات · `/admin/advisors` — «المستشارون»
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_advisors.desktop.jpg` · الهاتف: `admin_advisors.mobile.jpg`

### عمليات · `/admin/exceptions` — «الاستثناءات — حالات بلا مستشار»
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_exceptions.desktop.jpg` · الهاتف: `admin_exceptions.mobile.jpg`

### عمليات · `/admin/quality` — «جودة التشخيص والمحاكي»
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_quality.desktop.jpg` · الهاتف: `admin_quality.mobile.jpg`

### عمليات · `/admin/users` — «المستخدمون والأدوار»
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_users.desktop.jpg` · الهاتف: `admin_users.mobile.jpg`

### عمليات · `/admin/audit` — «سجلّ الأثر»
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_audit.desktop.jpg` · الهاتف: `admin_audit.mobile.jpg`

### تشخيص · `/admin` — «الرئيسية — نظرة عامة»
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- نصٌّ مسرَّب — حالة إنجليزية خام: «متعلمين (attachedAt) ⏎  ⏎ التسجيلات بحالتها ⏎ enrolled ⏎ 1تسجيل ⏎ completed ⏎ 1تسجيل ⏎  ⏎ التسجيلات مجمعة بالشعبة وا»
- الصورة: `admin.desktop.jpg` · الهاتف: `admin.mobile.jpg`

### تشخيص · `/admin/authoring` — «تأليف متون الوحدات»
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_authoring.desktop.jpg` · الهاتف: `admin_authoring.mobile.jpg`

### تشخيص · `/admin/learners` — «الطلبة المسجَّلون»
- نداءٌ فاشل: `403 /api/staff/learners`
- نداءٌ فاشل: `403 /api/staff/learners`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_learners.desktop.jpg` · الهاتف: `admin_learners.mobile.jpg`

### تشخيص · `/admin/advisors` — «المستشارون»
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_advisors.desktop.jpg` · الهاتف: `admin_advisors.mobile.jpg`

### تشخيص · `/admin/exceptions` — «الاستثناءات»
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_exceptions.desktop.jpg` · الهاتف: `admin_exceptions.mobile.jpg`

### تشخيص · `/admin/users` — «المستخدمون والأدوار»
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_users.desktop.jpg` · الهاتف: `admin_users.mobile.jpg`

### تشخيص · `/admin/audit` — «سجلّ الأثر»
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_audit.desktop.jpg` · الهاتف: `admin_audit.mobile.jpg`

### مالية · `/admin` — «الرئيسية — نظرة عامة»
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/support/tickets`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- نصٌّ مسرَّب — حالة إنجليزية خام: «متعلمين (attachedAt) ⏎  ⏎ التسجيلات بحالتها ⏎ enrolled ⏎ 1تسجيل ⏎ completed ⏎ 1تسجيل ⏎  ⏎ التسجيلات مجمعة بالشعبة وا»
- الصورة: `admin.desktop.jpg` · الهاتف: `admin.mobile.jpg`

### مالية · `/admin/authoring` — «تأليف متون الوحدات»
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_authoring.desktop.jpg` · الهاتف: `admin_authoring.mobile.jpg`

### مالية · `/admin/publishing` — «النشر المحكوم وجودة التشخيص»
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_publishing.desktop.jpg` · الهاتف: `admin_publishing.mobile.jpg`

### مالية · `/admin/learners` — «الطلبة المسجَّلون»
- نداءٌ فاشل: `403 /api/staff/learners`
- نداءٌ فاشل: `403 /api/staff/learners`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_learners.desktop.jpg` · الهاتف: `admin_learners.mobile.jpg`

### مالية · `/admin/advisors` — «المستشارون»
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_advisors.desktop.jpg` · الهاتف: `admin_advisors.mobile.jpg`

### مالية · `/admin/exceptions` — «الاستثناءات»
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_exceptions.desktop.jpg` · الهاتف: `admin_exceptions.mobile.jpg`

### مالية · `/admin/quality` — «جودة التشخيص والمحاكي»
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_quality.desktop.jpg` · الهاتف: `admin_quality.mobile.jpg`

### مالية · `/admin/users` — «المستخدمون والأدوار»
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_users.desktop.jpg` · الهاتف: `admin_users.mobile.jpg`

### مالية · `/admin/audit` — «سجلّ الأثر»
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_audit.desktop.jpg` · الهاتف: `admin_audit.mobile.jpg`

### دعم · `/admin` — «الرئيسية — نظرة عامة»
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/enrollment-requests`
- نداءٌ فاشل: `403 /api/admin/refunds`
- نداءٌ فاشل: `403 /api/admin/invoices`
- نداءٌ فاشل: `403 /api/admin/cohorts`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/reports/diagnostic-funnel`
- نداءٌ فاشل: `403 /api/admin/reports/progress-completion`
- نداءٌ فاشل: `403 /api/admin/reports/revenue`
- نداءٌ فاشل: `403 /api/admin/reports/diagnostic`
- نداءٌ فاشل: `403 /api/admin/reports/enrollments`
- نداءٌ فاشل: `403 /api/admin/reports/diagnostic-funnel`
- نداءٌ فاشل: `403 /api/admin/reports/progress-completion`
- نداءٌ فاشل: `403 /api/admin/reports/diagnostic`
- نداءٌ فاشل: `403 /api/admin/reports/revenue`
- نداءٌ فاشل: `403 /api/admin/reports/enrollments`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin.desktop.jpg` · الهاتف: `admin.mobile.jpg`

### دعم · `/admin/authoring` — «تأليف متون الوحدات»
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- نداءٌ فاشل: `403 /api/admin/authoring/worklist?body=missing&limit=400`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_authoring.desktop.jpg` · الهاتف: `admin_authoring.mobile.jpg`

### دعم · `/admin/publishing` — «النشر المحكوم وجودة التشخيص»
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- نداءٌ فاشل: `403 /api/admin/publishing/versions`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_publishing.desktop.jpg` · الهاتف: `admin_publishing.mobile.jpg`

### دعم · `/admin/learners` — «الطلبة المسجَّلون»
- نداءٌ فاشل: `403 /api/staff/learners`
- نداءٌ فاشل: `403 /api/staff/learners`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_learners.desktop.jpg` · الهاتف: `admin_learners.mobile.jpg`

### دعم · `/admin/advisors` — «المستشارون»
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- نداءٌ فاشل: `403 /api/admin/advisors`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_advisors.desktop.jpg` · الهاتف: `admin_advisors.mobile.jpg`

### دعم · `/admin/exceptions` — «الاستثناءات»
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/advisor-cases/unassigned`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_exceptions.desktop.jpg` · الهاتف: `admin_exceptions.mobile.jpg`

### دعم · `/admin/quality` — «جودة التشخيص والمحاكي»
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- نداءٌ فاشل: `403 /api/admin/quality/regression-runs`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_quality.desktop.jpg` · الهاتف: `admin_quality.mobile.jpg`

### دعم · `/admin/users` — «المستخدمون والأدوار»
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- نداءٌ فاشل: `403 /api/admin/users`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_users.desktop.jpg` · الهاتف: `admin_users.mobile.jpg`

### دعم · `/admin/audit` — «سجلّ الأثر»
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- نداءٌ فاشل: `403 /api/admin/audit?page=1&pageSize=25`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `admin_audit.desktop.jpg` · الهاتف: `admin_audit.mobile.jpg`

### مدير النظام · `/admin` — «الرئيسية — نظرة عامة»
- نصٌّ مسرَّب — حالة إنجليزية خام: «متعلمين (attachedAt) ⏎  ⏎ التسجيلات بحالتها ⏎ enrolled ⏎ 1تسجيل ⏎ completed ⏎ 1تسجيل ⏎  ⏎ التسجيلات مجمعة بالشعبة وا»
- الصورة: `admin.desktop.jpg` · الهاتف: `admin.mobile.jpg`

### مدير النظام · `/admin/ratings` — «مراجعة تعليقات التقييم»
- نصٌّ مسرَّب — UUID ظاهر: «نتظار المراجعة ⏎ معتمَدة ⏎ محجوبة ⏎ مدرّب ⏎ 5 ★ ⏎ def2f942-5144-4f40-937b-3a6fff0f888e ⏎  ⏎ شرحٌ عمليّ ومباشر — تق»
- الصورة: `admin_ratings.desktop.jpg` · الهاتف: `admin_ratings.mobile.jpg`

### مدير النظام · `/trainer` — «الرئيسية»
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `404 /api/trainer/me`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `404 /api/trainer/me`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- الصورة: `trainer.desktop.jpg` · الهاتف: `trainer.mobile.jpg`

### مدير النظام · `/trainer/board` — «شعبي وجلساتها»
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `trainer_board.desktop.jpg` · الهاتف: `trainer_board.mobile.jpg`

### مدير النظام · `/trainer/grading` — «طابور التقييم»
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- نداءٌ فاشل: `403 /api/trainer/grading-queue`
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- كونسول: Failed to load resource: the server responded with a status of 403 (Forbidden)
- الصورة: `trainer_grading.desktop.jpg` · الهاتف: `trainer_grading.mobile.jpg`

### مدير النظام · `/trainer/proposals` — «اقتراحات التعديل»
- نداءٌ فاشل: `404 /api/trainer/change-requests`
- نداءٌ فاشل: `404 /api/trainer/me/qualifications`
- نداءٌ فاشل: `404 /api/trainer/catalog-scope`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `404 /api/trainer/change-requests`
- نداءٌ فاشل: `404 /api/trainer/catalog-scope`
- نداءٌ فاشل: `404 /api/trainer/me/qualifications`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `404 /api/trainer/change-requests`
- نداءٌ فاشل: `404 /api/trainer/catalog-scope`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- نداءٌ فاشل: `404 /api/trainer/me/qualifications`
- نداءٌ فاشل: `404 /api/trainer/me/qualifications`
- نداءٌ فاشل: `404 /api/trainer/change-requests`
- نداءٌ فاشل: `404 /api/trainer/catalog-scope`
- نداءٌ فاشل: `403 /api/trainer/my-cohorts`
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- الصورة: `trainer_proposals.desktop.jpg` · الهاتف: `trainer_proposals.mobile.jpg`

### مدير النظام · `/trainer/earnings` — «مستحقاتي»
- نداءٌ فاشل: `404 /api/trainer/earnings`
- نداءٌ فاشل: `404 /api/trainer/earnings`
- نداءٌ فاشل: `404 /api/trainer/earnings`
- نداءٌ فاشل: `404 /api/trainer/earnings`
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- الصورة: `trainer_earnings.desktop.jpg` · الهاتف: `trainer_earnings.mobile.jpg`

### مدير النظام · `/trainer/ratings` — «ما قيل عنّي»
- نداءٌ فاشل: `404 /api/me/ratings`
- نداءٌ فاشل: `404 /api/me/ratings`
- نداءٌ فاشل: `404 /api/me/ratings`
- نداءٌ فاشل: `404 /api/me/ratings`
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- الصورة: `trainer_ratings.desktop.jpg` · الهاتف: `trainer_ratings.mobile.jpg`

### مدير النظام · `/advisor/ratings` — «ما قيل عنّي»
- نداءٌ فاشل: `404 /api/me/ratings`
- نداءٌ فاشل: `404 /api/me/ratings`
- نداءٌ فاشل: `404 /api/me/ratings`
- نداءٌ فاشل: `404 /api/me/ratings`
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- كونسول: Failed to load resource: the server responded with a status of 404 (Not Found)
- الصورة: `advisor_ratings.desktop.jpg` · الهاتف: `advisor_ratings.mobile.jpg`


## شاشاتٌ فارغة أو مسدودة (36)

| الدور | الشاشة | العنوان | النصّ (حرف) | ملاحظة |
|---|---|---|---|---|
| زائر | `/verify` | التحقق من شهادة | 146 | محتوى قليل |
| عمليات | `/admin/learner-requests` | طلبات المتعلّمين | 303 | «لا صلاحيات مفعّلة» |
| عمليات | `/admin/advisor-requests` | طلبات المستشارين | 303 | «لا صلاحيات مفعّلة» |
| عمليات | `/admin/ratings` | مراجعة تعليقات التقييم | 506 | «لا صلاحيات مفعّلة» |
| عمليات | `/admin/finance` | المالية | 286 | «لا صلاحيات مفعّلة» |
| عمليات | `/admin/support` | الدعم الفني | 290 | «لا صلاحيات مفعّلة» |
| عمليات | `/admin/notifications` | الإشعارات | 288 | «لا صلاحيات مفعّلة» |
| عمليات | `/admin/integrations` | التكاملات | 288 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/cohorts` | عمليات الشعب | 277 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/learner-requests` | طلبات المتعلّمين | 265 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/trainers` | طلبات انضمام المدربين | 286 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/advisor-requests` | طلبات المستشارين | 265 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/ratings` | مراجعة تعليقات التقييم | 468 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/finance` | المالية | 248 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/support` | الدعم الفني | 252 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/notifications` | الإشعارات | 250 | «لا صلاحيات مفعّلة» |
| تشخيص | `/admin/integrations` | التكاملات | 250 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/catalog` | إدارة الكتالوج الأكاديمي | 716 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/cohorts` | عمليات الشعب | 259 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/learner-requests` | طلبات المتعلّمين | 247 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/trainers` | طلبات انضمام المدربين | 268 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/advisor-requests` | طلبات المستشارين | 247 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/ratings` | مراجعة تعليقات التقييم | 450 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/finance` | المالية | 230 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/support` | الدعم الفني | 234 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/notifications` | الإشعارات | 232 | «لا صلاحيات مفعّلة» |
| مالية | `/admin/integrations` | التكاملات | 232 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/cohorts` | عمليات الشعب | 242 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/learner-requests` | طلبات المتعلّمين | 230 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/trainers` | طلبات انضمام المدربين | 251 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/advisor-requests` | طلبات المستشارين | 230 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/ratings` | مراجعة تعليقات التقييم | 433 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/finance` | المالية | 213 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/reports` | التقارير | 214 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/notifications` | الإشعارات | 215 | «لا صلاحيات مفعّلة» |
| دعم | `/admin/integrations` | التكاملات | 215 | «لا صلاحيات مفعّلة» |

## الأبطأ تحميلا (> ٤ ثوانٍ حتّى ظهور المحتوى)

| الدور | الشاشة | ms |
|---|---|---|
| زائر | `/verify` | 13233 |
| طالب | `/trainer` | 12976 |
| مدرّب | `/student` | 12963 |
| دعم | `/admin/learners` | 12962 |
| مستشار | `/student` | 12955 |
| مدرّب | `/admin` | 12952 |
| مستشار | `/admin` | 12951 |
| مدير النظام | `/trainer` | 12935 |
| طالب | `/admin` | 12928 |
| مدير النظام | `/trainer/earnings` | 12928 |

## الرحلاتُ التفاعليّة العشر

### J1 · من التشخيص إلى الشراء التجريبيّ — 16 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| فتح التشخيص | ✓ | بضع دقائق من الوضوح تختصر عليك شهورا من التشتت |
| بدء الحديث | ✓ | تجاوز إلى المحتوى الرئيسي العودة للرئيسية أكاديمية وجيز عن: من أنت سؤال 1 من 8–14 أي وصف يقترب أكثر من وضعك الحالي؟ لماذا هذا السؤال؟ المرحلة المهنية أول حقيقة <br><small>POST /api/events → 200</small> |
| الإجابة حتّى النهاية | ✓ | أسئلة/خطوات: 14 · انتهى؟ true · ظهرت التوصية؟ true<br><small>POST /api/events → 200 · POST /api/events → 200 · POST /api/events → 200</small> |
| شاشة النتيجة | ✓ | تجاوز إلى المحتوى الرئيسي الرئيسية أكاديمية وجيز دخول مسار مرشح لك أساسي نسختك المخصصة التحضير لأول وظيفة: من السيرة إلى قبول العرض ملف مهني مستهدف، مشروع إثبات، مقابلة موثقة، ونظام بحث عن فرصة لمدة 6 أسابيع. 9 أسابيع (م |
| الوصول إلى لوح الشراء | ✓ | /pathways/PW-STU-002 · زرُّ الشراء ظاهر؟ true «اشترِ المسار كاملا» |
| ضغطُ الشراء بلا حساب | ✓ | /pathways/PW-STU-002 · تجاوز إلى المحتوى الرئيسي الرئيسية أكاديمية وجيز دخول مسار مرشح لك أساسي نسختك المخصصة التحضير لأول وظيفة: من السيرة إلى قبول العرض ملف مهني مستهدف، مشروع إثبات، مقابلة موثقة، ونظام بحث عن فرصة لمد |
| الشراء بحساب الطالب (test) | ✓ | quote 200 · checkout 409 {"error":{"code":"order_pending","message_ar":"لك طلبٌ لم يكتمل دفعُه عن «دورة أساسيات الذكاء الاصطناعي وهندسة الأوامر — · pay - "" |

### J2 · الوحدة: المتن والفيديو داخل الصفحة — 2 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| فتح الوحدة الأولى | ✓ | /student/course/C-AUT-101/module/C-AUT-101-M1 · «العملية الحالية ونقطة الألم» |
| هل الفيديو مُدمَج؟ | ✓ | iframes: 1 · https://www.youtube-nocookie.com/embed/aircAruvnKk |
| فتح فصلٍ من الفيديو | ✓ | ضُغط الفصل |
| تفتيشٌ بعد الفصل | ✓ | تجاوز إلى المحتوى الرئيسي أكاديمية وجيز الرئيسية تعلّمي خزانتي 3 ل ليان العملية الحالية ونقطة الألم بريدك غير موثَّق الدخول والتصفّح والتشخيص مفتوحة كلها. الموق |
| المتن والتمارين — طولُ الصفحة | ✓ | ارتفاع 2291px · 178 كلمة |

### J3 · الجلسة القادمة ورابطُ الدخول — 0 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| لوحة الطالب — التالي الآن | ✓ | بطاقةُ «التالي الآن» ظاهرة |
| رابط الانضمام | ✓ | href=/student/learning target=null |
| رحلة التعلّم — الجلسات | ✓ | لا زرَّ جلسة · رمزُ مرورٍ ظاهر؟ false |

### J4 · تذكرةُ دعم وطلبُ شهادة — 5 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| فتح الدعم | ✓ | الدعم الفني |
| فتح نموذج التذكرة | ✓ | فُتح |
| تعبئةٌ وإرسال | ✓ | تجاوز إلى المحتوى الرئيسي أكاديمية وجيز الرئيسية تعلّمي خزانتي 3 ل ليان الدعم الفني بريدك غير موثَّق الدخول والتصفّح والتشخيص مفتوحة كلها. الموقوف شيئان فقط: شراء الشعب واستلام الشهادة، حتى تُوثّق عنوانكstudent.demo@waje<br><small>POST /api/auth/email/verify/request → 200</small> |
| طلبُ شهادة من الرحلة | ✓ | لا زرَّ طلبِ شهادةٍ ظاهر في هذه المرحلة |

### J5 · لوحُ الشعبة: حضور وتأجيل ورفع تسجيل — 10 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| فتح لوح الشعبة | ✓ | شعبي وجلساتها |
| تسجيل حضور | ✓ | سُجل الحضور وأُعيد حساب التقدم شعبي دورة تحليل فرص الأتمتة والربط بين التطبيقات شعبة ديمو — اختيار العملية وجدوى الأتمتة · دورك: مدرب رئيس · 1 متعلما · 6 جلسة الجلسات والحضور الجلسة 1 — بيانات ديمو الخميس، 13 أغسطس، 10:2<br><small>POST /api/trainer/sessions/5715a2aa-c946-4d99-9335-c45a9106a0e5/attendance → 200</small> |
| اقتراح موعد | ✓ | اقتراحاتي مستحقاتي ما قيل عنّي بحث… Ctrl K أ أستاذ شعبي وجلساتها وصل اقتراحك الإدارة — والموعد لا يتغيّر حتى تعتمده شعبي دورة <br><small>POST /api/trainer/sessions/51ceceb8-f0ca-42fb-8780-a546ad16bff5/reschedule → 201</small> |
| رفعُ تسجيل (ملفّ صغير) | ✓ | تعذر رفع الملف بعد التسجيل شعبي دورة تحليل فرص الأتمتة والربط بين التطبيقات شعبة ديمو — اختيار العملية وجدوى الأتمتة · دورك: مدرب رئيس · 1 متعلما · <br><small>POST /api/trainer/sessions/5715a2aa-c946-4d99-9335-c45a9106a0e5/recordings → 201 · PUT /api/v1/uploads/_dSlKpFSP1Sof6RYzLJl5cadpcMMjZlY?exp=1788435672103&sig=I2-k6SdneaOoX62QTXJUKTQwejuNSbCIorG10tZez_M → 404</small> |
| رفعُ مادّةٍ (رابط) | ✓ | أُضيف الرابط إلى مواد الشعبة شعبي دورة تحليل فرص الأتمتة والربط بين التطبيقات شعبة ديمو — اختيار العملية وجدوى الأتمتة · دورك<br><small>POST /api/trainer/cohorts/0abebcac-7aaa-47e7-991f-20306d2f278b/materials → 201</small> |

### J6 · تصحيحُ تسليمٍ منتظر — 0 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| فتح طابور التصحيح | ✓ | تجاوز إلى المحتوى الرئيسي وجيز — بوابة المدرب الرئيسية شعبي طلبتي طابور التقييم اقتراحاتي مستحقاتي ما قيل عنّي بحث… Ctrl K أ أستاذ طابور التقييم الطابور نظيف — لا تسليمات بانتظارك كل ما وصلك قيّمته. أ |
| بدءُ المراجعة | ✓ | لا تسليمَ منتظرا |
| درجةٌ وقبول | ✓ | تجاوز إلى المحتوى الرئيسي وجيز — بوابة المدرب الرئيسية شعبي طلبتي طابور التقييم اقتراحاتي مستحقاتي ما قيل عنّي بحث… Ctrl K أ أستاذ طابور التقييم الطابور نظيف —  |

### J7 · إنشاء شعبة: الحقول والمعرّفات — 20 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| فتح الشعب وعدُّ حقول النموذج | ✓ | حقول: 5 · التسميات: الدورة (المنشورة فقط) ، عنوان الشعبة ، السعة ، السعر (USD) ، وقت البدء |
| تعبئةُ النموذج وإنشاءُ المسودة | ✓ | دورات في القائمة: 81 · أُنشئت الشعبة كمسودة — أكمل شروط الفتح الستة جاهزيّة العرض — لماذا لا تظهر بعض الأسعار السعر يُقرأ من الشعب لا من الكتالوج، فم<br><small>POST /api/admin/cohorts → 201</small> |
| فتح الشعبة الجديدة وإضافةُ جلسة | ✓ | أُنشئت الشعبة كمسودة — أكمل شروط الفتح الستة جاهزيّة العرض — لماذا لا تظهر بعض الأسعار السعر يُقرأ من الشع |
| تسجيلُ طالبٍ — الحقلُ يطلب UUID | ✓ | الحقل يطلب UUID (placeholder «معرف المستخدم (UUID)») · مسجَّلون طلبات المدربين طلبات المستشارين طلبات المتعلّمين الاستثناءات مراجعة التقييمات الأمور الفنّية الطلبات والفواتير التقار<br><small>POST /api/admin/cohorts/0abebcac-7aaa-47e7-991f-20306d2f278b/enrollments → 409</small> |
| ربطُ Zoom — الحقلُ يطلب معرّف الجلسة | ✓ | معرّفُ الجلسة غيرُ متاح على الشاشة · بلا رسالة |

### J8 · الاعتمادات: تأجيلٌ وشهادة — 3 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| اقتراحاتُ التأجيل في الشعب | ✓ | اقتراحاتٌ معلّقة داخل بطاقة شعبة الديمو: 1 · (لا مؤشّرَ على مستوى القائمة — يجب فتحُ كلِّ بطاقةٍ لمعرفة ما ينتظر) |
| اعتمادُ اقتراح | ✓ | اعتُمد الموعد الجديد — وأُخبر المتعلّمون جاهزيّة العرض — لماذا لا تظهر بعض الأسعار السعر يُقرأ من الشعب لا من الكتالوج، فما لا<br><small>POST /api/admin/session-reschedules/888c868a-9283-455b-9fda-c1ebd0e80b74/review → 200</small> |
| طلباتُ المتعلّمين | ✓ | تجاوز إلى المحتوى الرئيسي وجيز — الإدارة والعمليات بحث… Ctrl K م مدير الأكاديمية الرئيسية الكتالوج تأليف المتون النشر والإصدارات الشعب الطلبة المسجَّلون طلبات المدربين طلبات المستشارين طلبات المتعلّمين الاستثناءات مراجعة |
| البتّ في طلب | ✓ | لا طلبَ يُبتّ فيه |

### J9 · المستخدمون: دعوةٌ وصلاحيّةٌ وإيقافٌ وحذف — 13 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| فتح المستخدمين | ✓ | المستخدمون والأدوار |
| إنشاءُ حساب — ما تقوله الرسالة | ✓ | أُنشئ الحساب، ولم تُرسل الدعوة — قناةُ البريد غير مفعّلة. اطلب منه «نسيت كلمة المرور» ببريده. الحسابات النشطة (10) الحسابات الموقوفة (3) 1–10 من 10 حسابا موظّفُ الجولة tour<br><small>POST /api/admin/users → 201</small> |
| منحُ صلاحيّةٍ بسبب | ✓ | ضُغط «امنحها» · استثناءات جودة التشخيص مراجعة التقييمات الأمور الفنّية الطلبات والفواتير التقارير والتصدير تذاكر الدعم الإشعارات المهامّ والتكل · عدّادُ الصلاحيّات: 53<br><small>POST /api/admin/users/ca505b77-e683-4a91-8eb1-8e18abc5a3f6/permissions → 200</small> |
| إيقافٌ ثمّ إعادة | ✓ | أُوقف الحساب وأُبطلت جلساته فورا الحسابات النشطة (9) الحسابات الموقوفة (4) لا نتائج ل → نشطة (9) الحسابات الموقوفة (4) لا نتائج لا حساب يطابق «الجولة».<br><small>POST /api/admin/users/ca505b77-e683-4a91-8eb1-8e18abc5a3f6/suspend → 200</small> |
| محاولةُ حذفِ حسابٍ له سجلّ | ✓ | حوار: الحذفُ النهائيُّ لا رجعةَ فيه. اكتب بريدَ الحساب لتأكيده: student.demo@wajeez.local ،  ·  |

### J10 · الأدوار الإداريّة الأربعة — أوّل شاشة — 0 ضغطة

| الخطوة | النتيجة | ما شُوهد |
|---|---|---|
| operations: /admin | ✓ | لوحةٌ ظاهرة · بنودُ القائمة: الرئيسية · الكتالوج · النشر والإصدارات · الشعب · الطلبة المسجَّلون · طلبات المدربين · الاستثناءات · التقارير والتصدير · المهامّ والتكليفات |
| diagnostics: /admin | ✓ | لوحةٌ ظاهرة · بنودُ القائمة: الرئيسية · الكتالوج · النشر والإصدارات · جودة التشخيص · التقارير والتصدير · المهامّ والتكليفات |
| finance: /admin | ✓ | لوحةٌ ظاهرة · بنودُ القائمة: الرئيسية · الطلبات والفواتير · التقارير والتصدير · المهامّ والتكليفات |
| support: /admin | ✓ | لوحةٌ ظاهرة · بنودُ القائمة: الرئيسية · الكتالوج · تذاكر الدعم · المهامّ والتكليفات |

