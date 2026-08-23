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

## النشر على Vercel

المشروع مضبوط للنشر مباشرةً (`vercel.json`): إطار Vite، البناء `npm run build`،
والمخرجات `dist`. وفيه **rewrite** يوجّه كل المسارات إلى `index.html` — لازمٌ لأن
الراوتر يعمل بـ`history mode`، فبدونه أي رابط داخلي (`/app/callcenter`) يعطي 404
عند التحديث أو الفتح المباشر.

### خطوات الربط
1. [vercel.com/new](https://vercel.com/new) → استورد مستودع `U-Contact` من GitHub.
2. اترك إعدادات البناء كما اكتشفها (Vite · `npm run build` · `dist`).
3. Deploy. أي `git push` بعدها ينشر تلقائياً.

### متغيّر البيئة (اختياري)
`VITE_API_BASE` — عنوان API الخاص بـU‑Serve. **غير مطلوب**: الكود يرتدّ إلى
`https://u-serve.uisapp.com/api` إن غاب. اضبطه من Vercel → Settings → Environment
Variables فقط إن أردت توجيه النسخة المنشورة لخادم آخر.

### ⚠️ خطوة لا غنى عنها بعد أول نشر
الـAPI يقبل الطلبات من الأصول المسجَّلة في `CORS_ORIGIN` ومن `localhost` وحدها.
فور ظهور دومين Vercel أضِفه إلى `CORS_ORIGIN` على خادم U‑Serve وأعد تشغيل الـAPI —
قبل ذلك تفتح الواجهة ويُرفَض كل نداء (تسجيل الدخول لن يعمل).
