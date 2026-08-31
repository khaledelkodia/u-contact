import { ref } from 'vue'

// i18n بسيط: لغة تفاعلية + t(ar,en) + ضبط الاتجاه. الحالة محفوظة محلياً.
type Lang = 'ar' | 'en'
// تفضيلُ اللغة كان مخزَّناً في مفتاحين (`uc_lang` هنا و`cc_lang` في مركز الاتصال).
// وحّدناهما في هذا؛ ونقرأ القديم مرّةً إن لم يكن الجديد مضبوطاً فلا يفقد المستخدم
// اختياره عند أوّل فتحٍ بعد التحديث.
const saved = localStorage.getItem('uc_lang') ?? localStorage.getItem('cc_lang')
export const lang = ref<Lang>(saved === 'en' ? 'en' : 'ar')

export const isAr = () => lang.value === 'ar'
export function t(ar: string, en: string) { return lang.value === 'ar' ? ar : en }

/** كروم لا يُبطل ستايل عناصر النماذج (input/select/button) حين يتغيّر `dir` على
 *  الجذر أثناء التشغيل: الحاوية تنعكس فوراً بينما يبقى الحقل بحشوه واستدارته
 *  وسهم الـselect من الاتجاه القديم حتى إعادة تحميل الصفحة. إخفاءٌ وإظهارٌ في
 *  نفس الإطار يُجبر إعادة حساب الستايل — لا وميض، ولا يُنفَّذ إلا حين يتغيّر الاتجاه. */
function forceRestyle() {
  const b = document.body
  if (!b) return
  const prev = b.style.display
  b.style.display = 'none'
  void b.offsetHeight
  b.style.display = prev
}

export function applyDir() {
  const el = document.documentElement
  const dir = lang.value === 'ar' ? 'rtl' : 'ltr'
  const changed = el.dir !== dir
  el.lang = lang.value
  el.dir = dir
  if (changed) forceRestyle()
}
export function setLang(l: Lang) {
  lang.value = l
  localStorage.setItem('uc_lang', l)
  applyDir()
}
applyDir()
