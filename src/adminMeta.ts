// ──────────────────────────────────────────────────────────────────────────────
// عدّادات الشريط الجانبي للمشرف العام.
//
// بند القائمة الذي يحمل رقمه يجيب «كم وكيلاً؟ كم شركة؟» قبل فتح الصفحة — وهو
// أوّل سؤالٍ يُفتح لأجله هذا الكونسول. والعدّاد يُسحب **مرّةً واحدة** عند أول
// دخولٍ بوضع الإدارة، ثم تحدّثه الصفحات نفسها بعد كل تحميلٍ لها (فإنشاء وكيلٍ
// يرفع الرقم فوراً بلا طلبٍ إضافي).
//
// `null` ≠ صفر: الأولى «لم يُعرَف بعد» فلا تُعرض حبّةٌ كاذبة، والثانية «لا يوجد».
// ──────────────────────────────────────────────────────────────────────────────

import { reactive } from 'vue'
import { listAgents, listCompanies } from './api'

export const adminMeta = reactive<{ agents: number | null; companies: number | null }>({
  agents: null,
  companies: null,
})

let pulled = false

/** يسحب العدّادين مرّةً واحدة. الفشل العابر لا يُجمِّدهما للأبد — يُعاد المحاولة. */
export async function ensureAdminCounts() {
  if (pulled) return
  pulled = true
  try {
    const [a, c] = await Promise.all([listAgents(), listCompanies()])
    adminMeta.agents = a.length
    adminMeta.companies = c.length
  } catch {
    pulled = false
  }
}

/** عند الخروج — حتى لا يرى الداخلُ التالي أرقام من قبله. */
export function resetAdminCounts() {
  pulled = false
  adminMeta.agents = null
  adminMeta.companies = null
}
