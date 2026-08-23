import { ref } from 'vue'

// i18n بسيط: لغة تفاعلية + t(ar,en) + ضبط الاتجاه. الحالة محفوظة محلياً.
type Lang = 'ar' | 'en'
const saved = localStorage.getItem('uc_lang')
export const lang = ref<Lang>(saved === 'en' ? 'en' : 'ar')

export const isAr = () => lang.value === 'ar'
export function t(ar: string, en: string) { return lang.value === 'ar' ? ar : en }

export function applyDir() {
  document.documentElement.lang = lang.value
  document.documentElement.dir = lang.value === 'ar' ? 'rtl' : 'ltr'
}
export function setLang(l: Lang) {
  lang.value = l
  localStorage.setItem('uc_lang', l)
  applyDir()
}
applyDir()
