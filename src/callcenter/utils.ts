// ── مساعدات مشتركة (منقولة 1:1 من app.raw.js) ──

// نفس formatCurrency الأصلي: 3 خانات عشرية + " د.ك"
export function formatCurrency(amount: any): string {
  return parseFloat(amount).toFixed(3) + ' د.ك'
}

// نفس formatDate الأصلي
export function formatDate(dateString: any): string {
  const options: any = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }
  return new Date(dateString).toLocaleDateString('ar-KW', options)
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// نفس formatTransactionTime الأصلي (وقت تعيين السائق في لوحة التفاصيل)
export function formatTransactionTime(iso: any): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const date = d.toLocaleDateString('ar-KW', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return `${date} • ${time}`
}
