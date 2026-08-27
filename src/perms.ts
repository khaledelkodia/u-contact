// مفاتيح صلاحيات الكول‑سنتر + تسمياتها (عربي/إنجليزي). نفس المفاتيح في الباك‑إند.
//
// `group` للعرض وحده: ثلاث عشرة حبّةً في صفٍّ واحد كتلةٌ تُمسح بالعين ولا تُقرأ،
// فيُمنح المفتاح الخطأ لأن «إلغاء طلب» جاور «فتح اليوم» بلا رابط. المجموعات لا
// تُخزَّن ولا تُرسَل — الباك‑إند لا يعرف إلا المفاتيح.
export const PERM_GROUPS = [
  { key: 'orders',     ar: 'الطلبات',       en: 'Orders' },
  { key: 'day',        ar: 'يوم العمل',       en: 'Business day' },
  { key: 'catalog',    ar: 'الأصناف والرسوم', en: 'Items & fees' },
  { key: 'admin',      ar: 'الإدارة',         en: 'Administration' },
  { key: 'complaints', ar: 'الشكاوى',         en: 'Complaints' },
]

export const PERMS = [
  { key: 'callcenter.view', group: 'orders', ar: 'عرض الطلبات', en: 'View orders' },
  { key: 'callcenter.create', group: 'orders', ar: 'إنشاء طلب', en: 'Create order' },
  { key: 'callcenter.edit', group: 'orders', ar: 'تعديل / تعيين فرع', en: 'Edit / assign branch' },
  { key: 'callcenter.cancel', group: 'orders', ar: 'إلغاء طلب', en: 'Cancel order' },
  // تعديل محتوى طلبٍ قائم قبل أن يصير جاهزاً — مستقلٌّ عن «تعديل/تعيين فرع»:
  // تغيير ما يُطبخ قرارٌ آخر غير توجيه الطلب.
  { key: 'callcenter.edit_order', group: 'orders', ar: 'تعديل طلب قائم', en: 'Edit an open order' },
  { key: 'callcenter.open', group: 'day', ar: 'فتح اليوم', en: 'Open day' },
  { key: 'callcenter.close', group: 'day', ar: 'قفل اليوم', en: 'Close day' },
  { key: 'callcenter.users', group: 'admin', ar: 'إدارة المستخدمين', en: 'Manage users' },
  { key: 'callcenter.manage', group: 'admin', ar: 'إدارة كاملة', en: 'Full manage' },
  // مفتاحان مستقلّان لزرَّين مختلفين — كانا محكومَين بـ`manage` معاً.
  // غيابهما عن هذه القائمة كان يمنع منحهما أصلاً: الشاشة تبنى منها، فما ليس فيها
  // لا يظهر ولا يُختار ولا يدخل سقف الشركة — فيبقى الزرّ معطّلاً للجميع بلا سبب ظاهر.
  { key: 'callcenter.stop_items', group: 'catalog', ar: 'إيقاف/تشغيل الأصناف', en: 'Stop / resume items' },
  // `callcenter.delivery_fee` أُزيل: الكول‑سنتر لا يعدّل رسوم التوصيل إطلاقاً —
  // الرسوم رسومُ ربط (فرع ↔ مكان) من لوحة التحكم، و«المفتوحة» يحدّدها الفرع. المفتاح
  // يبقى في الباك‑إند حارساً يرفض أي تجاوزٍ يصل، ولا يُعرَض هنا فلا يُمنَح بلا أثر.
  // «إصلاح يوم»: فتح تاريخٍ بعينه (جديدٍ أو قديم) للمراجعة بلا ضربِ طلبات عليه.
  // مستقلٌّ عن «فتح اليوم»: ذاك عملٌ يوميّ، وهذا قرارٌ إداريّ.
  { key: 'callcenter.fix_day', group: 'day', ar: 'إصلاح يوم', en: 'Fix a day' },
  { key: 'callcenter.day_settings', group: 'day', ar: 'إعدادات اليوم', en: 'Day settings' },
  // سياسة أخذ الطلب (إلزام طريقة الدفع) — قرارٌ تشغيليٌّ مستقلّ عن إعدادات اليوم
  { key: 'callcenter.order_settings', group: 'admin', ar: 'سياسة أخذ الطلب', en: 'Order-taking policy' },
  { key: 'callcenter.roles', group: 'admin', ar: 'إدارة الأدوار', en: 'Manage roles' },
  // قيمة الطلب النهائية في القائمة — مفتاحٌ مستقلّ: من يتابع الحالات ليس بالضرورة
  // من يرى الأرقام. ولا يُمنَح لأحدٍ افتراضياً.
  { key: 'callcenter.view_totals', group: 'admin', ar: 'عرض قيمة الطلب', en: 'View order value' },
  { key: 'complaints.view', group: 'complaints', ar: 'عرض الشكاوى', en: 'View complaints' },
  { key: 'complaints.manage', group: 'complaints', ar: 'إدارة الشكاوى', en: 'Manage complaints' },
]

/** مفاتيح مجموعةٍ بعينها بترتيبها في `PERMS`. */
export const permsOfGroup = (g: string) => PERMS.filter((p) => p.group === g)
export const permLabel = (k: string, ar: boolean) => {
  const p = PERMS.find((x) => x.key === k)
  return p ? (ar ? p.ar : p.en) : k
}
// تقاطع: يحفظ ترتيب a
export const intersect = (a: string[], b: string[]) => { const s = new Set(b); return a.filter((k) => s.has(k)) }
