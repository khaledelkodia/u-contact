# U‑Contact

مشروع فرونت‑إند **منفصل** للكول‑سنتر. بيكلّم **API بتاع U‑Serve فقط** (`/contact/*`)، ويتشارك نفس الداتابيز عبره — من غير أي كود مشترك.

## الوضع الحالي (المرحلة الأولى)
**داشبورد السوبر‑أدمن** (بدخول المشرف العام لـU‑Serve):
- إدارة وكلاء الكول‑سنتر: إضافة/تعديل/إيقاف.
- ضبط **صلاحيات** كل وكيل.
- **ربط الوكيل بأكتر من شركة**.
- **تقارير الوكلاء** (عبر كل الشركات).

> تطبيق الكول‑سنتر التشغيلي (أخذ الأوردرات) **لسه** — هيتعمل لاحقاً بتصميم منفصل.

## التشغيل
```bash
npm install
npm run dev      # http://localhost:5180
```
بيكلّم الـAPI اللايف المحدّد في `.env` (`VITE_API_BASE`). غيّره للوكال لو حبيت.

## البناء
```bash
npm run build
```

## ملاحظات
- **مش مرفوع** — لوكال على جهاز التطوير لحد ما يتظبط الدومين والاستضافة.
- الباك‑إند بتاعه كله جوّه U‑Serve (`cloud/api` — وحدة `contact`).
- Endpoints المستخدمة: `POST /auth/admin/login` · `GET/POST/PATCH /contact/admin/agents…` · `PUT /contact/admin/agents/:id/companies` · `GET /contact/admin/companies` · `GET /contact/admin/reports/agents`.

## النشر — على خادم U‑Serve نفسِه

الإنتاج على `https://u-contact.uisapp.com`، على نفس صندوق EC2 الذي يحمل الـAPI.

```bash
export GIT_SSH_COMMAND='ssh -i "/c/Users/UIS-Wesam/Desktop/server linux/uiscom.pem" -o StrictHostKeyChecking=no'
git push production main
```

الدفعُ يُشغّل خطّافاً على الخادم: سحبٌ ← `npm ci` ← بناء ← نسخُ `dist/` إلى جذر
الموقع. مخرجاتُه تظهر في نتيجة الدفع، وآخرُها «تم النشر بنجاح».

### الـAPI من نفس الأصل — لا CORS

nginx يمرّر `/api/` من هذا الدومين إلى الـAPI نفسِه، والبناءُ على الخادم يستعمل
`VITE_API_BASE=/api`. فالطلبُ من نفس الأصل، ولا حاجةَ لإضافة الدومين إلى
`CORS_ORIGIN` ولا لإعادة تشغيل الـAPI.

> **لذلك يختلف هاشُ بندل الخادم عن أيّ بناءٍ محليّ افتراضيّ** — قاعدةُ الـAPI
> مختلفة. للتحقّق ابنِ محلياً بنفس المتغيّر:

```bash
MSYS_NO_PATHCONV=1 VITE_API_BASE=/api npm run build
```

> **`MSYS_NO_PATHCONV=1` ليست زينة**: Git Bash على ويندوز يحوّل أيّ قيمةٍ تبدأ
> بشَرطةٍ مائلة إلى مسار ويندوز، فيصير الأساس `C:/Program Files/Git/api` ويُبنى
> بندلٌ لا ينادي شيئاً. الخطأُ **صامت**: البناء ينجح، والهاشُ يختلف عن الخادم بلا
> سببٍ ظاهر. (وقع فعلاً عند التحقّق من أوّل نشرة.)

### قطعُ الإعداد على الخادم

| ماذا | أين |
|---|---|
| موقع nginx | `/etc/nginx/sites-available/ucontact` |
| جذر الموقع | `/var/www/ucontact` |
| مستودع النشر | `/srv/ucontact.git` (خطّاف `post-receive`) |
| نسخة العمل والبناء | `/srv/ucontact` |
| الشهادة | Let's Encrypt، تجديدٌ تلقائيّ بـcertbot |

> الصندوق يستضيف مشاريع عملاء آخرين: `sudo nginx -t` قبل أيّ `reload`، ولا تُمَسّ
> ملفاتُ مواقعَ أخرى.

### Vercel (قديم — للاختبار)

`https://u-contact.vercel.app` مربوطةٌ بـ`origin` على GitHub وتنشر تلقائياً مع كلّ
دفع. كانت للاختبار قبل الانتقال، وتُركت شغّالةً كاحتياطٍ مؤقّت. بناؤها يستعمل
القاعدة المطلقة `https://u-serve.uisapp.com/api`، فيلزمه بقاءُ الدومين في
`CORS_ORIGIN`.
