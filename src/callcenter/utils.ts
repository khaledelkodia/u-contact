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

// ── توقيت الشركة ─────────────────────────────────────────────────────────────
// الوكيل قد يجلس في مصر ويخدم شركةً في عُمان. كل وقتٍ يخصّ الشركة — عرضاً وإدخالاً —
// يتبع منطقتها هي لا ساعة جهازه: أوردرٌ نزل ٨م عند الفرع كان يُعرض ٧م للوكيل المصري،
// وحجزٌ يكتبه «٨م» كان ينزل الفرع ١٠م.
//
// بلا منطقةٍ معروفة (شركةٌ بلا دولة، أو جلسةٌ قديمة قبل أن يبعث الخادم `timezone`)
// نرتدّ لساعة الجهاز — سلوك اليوم بالضبط، فلا ينكسر شيء.

/** منطقة الشركة الحالية — أو null. */
export function companyTz(): string | null {
  const tz = currentCompany()?.timezone
  return tz ? String(tz) : null
}

/** خيارُ `timeZone` لدوال `toLocale*` — كائنٌ فارغ حين لا منطقة. */
const tzOpt = (): any => { const z = companyTz(); return z ? { timeZone: z } : {} }

/**
 * إزاحة منطقةٍ عن UTC بالدقائق **عند لحظةٍ بعينها** — فتصحّ تحت التوقيت الصيفي وتغيّراته.
 * نقرأ مكوّنات اللحظة نفسها في المنطقتين ثم نطرح؛ أوثق من تحليل اسم الإزاحة نصّاً.
 * (نفس أسلوب `cloud/api/src/common/timezone.ts` — مصدرٌ واحد للمنطق في الطرفين.)
 */
export function tzOffsetMinutes(tz: string, at: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const p: Record<string, string> = {}
    for (const part of dtf.formatToParts(at)) if (part.type !== 'literal') p[part.type] = part.value
    // `hour` قد تعود "24" مع hour12:false عند منتصف الليل — تُعامَل كصفرٍ في اليوم نفسه
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second)
    return Math.round((asUTC - Math.floor(at.getTime() / 1000) * 1000) / 60000)
  } catch { return 0 }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * لحظةٌ حقيقية ← ساعة حائط الشركة نصّاً (`YYYY-MM-DDTHH:mm`) — قيمةُ حقل
 * `datetime-local`. بلا منطقة: مكوّنات الجهاز كما كانت.
 */
export function toCompanyWall(at: Date = new Date()): string {
  const tz = companyTz()
  if (!tz) return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}T${pad2(at.getHours())}:${pad2(at.getMinutes())}`
  const w = new Date(at.getTime() + tzOffsetMinutes(tz, at) * 60000)
  return w.toISOString().slice(0, 16)   // مكوّنات UTC = ساعة الحائط هناك
}

/**
 * ساعة حائط الشركة نصّاً ← اللحظة الحقيقية.
 *
 * التصحيح مرّتان: الإزاحة تُقاس عند لحظةٍ تقريبية أولاً، ثم تُعاد قياساً عند اللحظة
 * المصحَّحة — فيصحّ الحساب في ليلة تغيّر التوقيت الصيفي حيث تختلف الإزاحة قبل
 * الموعد وبعده.
 */
export function fromCompanyWall(wall: string): Date {
  const m = String(wall || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!m) return new Date(NaN)
  const tz = companyTz()
  const asIfUTC = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  if (!tz) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`)   // الجهاز كما كان
  const off1 = tzOffsetMinutes(tz, new Date(asIfUTC))
  const off2 = tzOffsetMinutes(tz, new Date(asIfUTC - off1 * 60000))
  return new Date(asIfUTC - off2 * 60000)
}

/** تاريخ اليوم عند الشركة (`YYYY-MM-DD`). */
export function companyToday(): string { return toCompanyWall().slice(0, 10) }

// نفس formatDate الأصلي — واللغة تختار الرموز (كان `ar-KW` دائماً)
export function formatDate(dateString: any): string {
  const options: any = { ...tzOpt(), year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }
  return new Date(dateString).toLocaleDateString(locale(), options)
}

/**
 * قيمة `datetime-local` (`YYYY-MM-DDTHH:mm`) — تُقرأ بساعة **الشركة** وتُعرض بلغة الواجهة.
 * كانت تُطبع كما هي في مراجعة الطلب: «2026-08-23T13:00».
 */
export function formatDateTimeLocal(v: any): string {
  if (!v) return '-'
  const raw = String(v)
  // نصُّ حقل `datetime-local` ساعةُ حائطٍ لا لحظة: يُحوَّل بمنطقة الشركة قبل العرض،
  // وإلا قرأه المتصفّح بمنطقة الجهاز فانزاح الموعد ساعةً أو ساعتين.
  const d = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw) && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)
    ? fromCompanyWall(raw)
    : new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleString(locale(), {
    ...tzOpt(),
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

/** تاريخ اليوم — **عند الشركة** لا عند الجهاز (يُقارَن بيوم عمل الفرع). */
export function todayISO(): string { return companyToday() }

// نفس formatTransactionTime الأصلي (وقت تعيين السائق في لوحة التفاصيل)
export function formatTransactionTime(iso: any): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const date = d.toLocaleDateString(locale(), { ...tzOpt(), weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString(locale(), { ...tzOpt(), hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
  return `${date} • ${time}`
}
