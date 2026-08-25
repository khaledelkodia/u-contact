// ── مساعدات مشتركة (منقولة 1:1 من app.raw.js) ──

import { lang, locale } from './lang'
import { currentCompany } from '../api'

// ── العملة ───────────────────────────────────────────────────────────────────
// كانت «د.ك» بثلاث خانات لكل الشركات مهما كانت دولتها: شركةٌ مصرية أو عُمانية ترى
// مبالغها بعملةٍ ليست عملتها، وبدقّةٍ ليست دقّتها. العملة الآن من الشركة نفسها
// (`Company.currency`، تصل مع الدخول)، والرمز يتبع لغة الواجهة.
//
// الخانات جزءٌ من تعريف العملة لا تفضيلاً: الدينار والريال العُماني ثلاث خانات،
// وأكثر ما عداها اثنتان. طباعة «2770.000» لجنيهٍ مصري خطأٌ لا مجرّد زيادة صفر.
const CURRENCIES: Record<string, { ar: string; en: string; dp: number }> = {
  KWD: { ar: 'د.ك', en: 'KWD', dp: 3 },
  BHD: { ar: 'د.ب', en: 'BHD', dp: 3 },
  OMR: { ar: 'ر.ع', en: 'OMR', dp: 3 },
  JOD: { ar: 'د.أ', en: 'JOD', dp: 3 },
  TND: { ar: 'د.ت', en: 'TND', dp: 3 },
  LYD: { ar: 'د.ل', en: 'LYD', dp: 3 },
  IQD: { ar: 'د.ع', en: 'IQD', dp: 3 },
  SAR: { ar: 'ر.س', en: 'SAR', dp: 2 },
  AED: { ar: 'د.إ', en: 'AED', dp: 2 },
  QAR: { ar: 'ر.ق', en: 'QAR', dp: 2 },
  EGP: { ar: 'ج.م', en: 'EGP', dp: 2 },
  MAD: { ar: 'د.م', en: 'MAD', dp: 2 },
  DZD: { ar: 'د.ج', en: 'DZD', dp: 2 },
  LBP: { ar: 'ل.ل', en: 'LBP', dp: 2 },
  SYP: { ar: 'ل.س', en: 'SYP', dp: 2 },
  YER: { ar: 'ر.ي', en: 'YER', dp: 2 },
  SDG: { ar: 'ج.س', en: 'SDG', dp: 2 },
  USD: { ar: 'دولار', en: 'USD', dp: 2 },
  EUR: { ar: 'يورو', en: 'EUR', dp: 2 },
  GBP: { ar: 'جنيه إسترليني', en: 'GBP', dp: 2 },
  TRY: { ar: 'ليرة تركية', en: 'TRY', dp: 2 },
}

/**
 * عملة الشركة الحالية.
 *
 * جلسةٌ محفوظة قبل أن يرسل الخادم الحقل لا تحمله ⇒ نرتدّ إلى الدينار الكويتي،
 * وهو سلوك اليوم بالضبط: لا ينكسر شيء حتى يعيد الوكيل الدخول. وعملةٌ غير معروفة
 * تُطبع بكودها («SDG 12.00») لا بفراغ.
 */
function currency(): { ar: string; en: string; dp: number } {
  const code = String((currentCompany() as any)?.currency || '').toUpperCase()
  if (!code) return CURRENCIES.KWD
  return CURRENCIES[code] || { ar: code, en: code, dp: 2 }
}

export function formatCurrency(amount: any): string {
  const c = currency()
  const n = parseFloat(amount)
  return (isNaN(n) ? 0 : n).toFixed(c.dp) + ' ' + (lang.value === 'ar' ? c.ar : c.en)
}

// نفس formatDate الأصلي — واللغة تختار الرموز (كان `ar-KW` دائماً)
export function formatDate(dateString: any): string {
  const options: any = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }
  return new Date(dateString).toLocaleDateString(locale(), options)
}

/**
 * قيمة `datetime-local` (`YYYY-MM-DDTHH:mm`) — تُقرأ **محليّاً** وتُعرض بلغة الواجهة.
 * كانت تُطبع كما هي في مراجعة الطلب: «2026-08-23T13:00».
 */
export function formatDateTimeLocal(v: any): string {
  if (!v) return '-'
  const d = new Date(String(v))
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString(locale(), {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// نفس formatTransactionTime الأصلي (وقت تعيين السائق في لوحة التفاصيل)
export function formatTransactionTime(iso: any): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const date = d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return `${date} • ${time}`
}
