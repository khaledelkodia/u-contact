// مفاتيح صلاحيات الكول‑سنتر + تسمياتها (عربي/إنجليزي). نفس المفاتيح في الباك‑إند.
export const PERMS = [
  { key: 'callcenter.view', ar: 'عرض الأوردرات', en: 'View orders' },
  { key: 'callcenter.create', ar: 'إنشاء أوردر', en: 'Create order' },
  { key: 'callcenter.edit', ar: 'تعديل / تعيين فرع', en: 'Edit / assign branch' },
  { key: 'callcenter.cancel', ar: 'إلغاء أوردر', en: 'Cancel order' },
  { key: 'callcenter.open', ar: 'فتح اليوم', en: 'Open day' },
  { key: 'callcenter.close', ar: 'قفل اليوم', en: 'Close day' },
  { key: 'callcenter.users', ar: 'إدارة المستخدمين', en: 'Manage users' },
  { key: 'callcenter.manage', ar: 'إدارة كاملة', en: 'Full manage' },
  // مفتاحان مستقلّان لزرَّين مختلفين — كانا محكومَين بـ`manage` معاً.
  // غيابهما عن هذه القائمة كان يمنع منحهما أصلاً: الشاشة تبنى منها، فما ليس فيها
  // لا يظهر ولا يُختار ولا يدخل سقف الشركة — فيبقى الزرّ معطّلاً للجميع بلا سبب ظاهر.
  { key: 'callcenter.stop_items', ar: 'إيقاف/تشغيل الأصناف', en: 'Stop / resume items' },
  { key: 'callcenter.delivery_fee', ar: 'تغيير رسوم التوصيل', en: 'Change delivery fee' },
  { key: 'complaints.view', ar: 'عرض الشكاوى', en: 'View complaints' },
  { key: 'complaints.manage', ar: 'إدارة الشكاوى', en: 'Manage complaints' },
]
export const permLabel = (k: string, ar: boolean) => {
  const p = PERMS.find((x) => x.key === k)
  return p ? (ar ? p.ar : p.en) : k
}
// تقاطع: يحفظ ترتيب a
export const intersect = (a: string[], b: string[]) => { const s = new Set(b); return a.filter((k) => s.has(k)) }
