// ──────────────────────────────────────────────────────────────────────────────
// شاشات مركز الاتصال ↔ مسارات المتصفّح.
//
// كان المركز كلّه مساراً واحداً (`/app/callcenter`) والتنقّل بين عشر شاشاتٍ يجري في
// متغيّرٍ بالذاكرة: فالرابط لا يتغيّر أبداً — لا يُرسَل لزميل، والتحديث يعيدك للبداية،
// وزرّ الرجوع يقذفك خارج التطبيق. صار لكل شاشةٍ مسارُها، وهذا الجدول مصدرُهما الواحد:
// يقرؤه الراوتر (للمسارات وحراسة الصلاحية) وتقرؤه القشرة (لمزامنة الشاشة بالمسار).
//
// `anyOf`: يكفي مفتاحٌ واحد منها. مطابقةٌ لما في قائمة السايدبار — فما يُخفى من
// القائمة يُمنع من الرابط المباشر كذلك، ولا يبقى بابٌ خلفيّ لشاشةٍ بلا صلاحية.
// ──────────────────────────────────────────────────────────────────────────────

export const ORDER_PERMS = ['callcenter.view', 'callcenter.create', 'callcenter.edit']
export const DASH_PERMS = ['callcenter.users', 'complaints.view', 'complaints.manage', 'callcenter.manage']

export interface CcRoute { view: string; path: string; anyOf: string[] }

export const CC_ROUTES: CcRoute[] = [
  { view: 'dashboard',        path: '/app',                  anyOf: DASH_PERMS },
  { view: 'new-order',        path: '/app/callcenter',       anyOf: ORDER_PERMS },
  { view: 'orders',           path: '/app/orders',           anyOf: ['callcenter.view'] },
  { view: 'scheduled-orders', path: '/app/scheduled-orders', anyOf: ['callcenter.view', 'callcenter.create'] },
  { view: 'complaints',       path: '/app/complaints',       anyOf: ['complaints.view', 'complaints.manage'] },
  { view: 'settings',         path: '/app/settings',         anyOf: ['callcenter.settings', 'callcenter.manage', 'callcenter.open', 'callcenter.close'] },
  { view: 'day-settings',     path: '/app/day-settings',     anyOf: ['callcenter.day_settings'] },
  { view: 'cc-roles',         path: '/app/roles',            anyOf: ['callcenter.roles'] },
  { view: 'users',            path: '/app/users',            anyOf: ['callcenter.users'] },
  // شاشةٌ يُدخَل إليها من الإعدادات لا من القائمة — ولها مسارُها كالبقيّة
  { view: 'stopped-items',    path: '/app/stopped-items',    anyOf: ['callcenter.view_stopped', 'callcenter.stop_items', 'callcenter.manage'] },
]

const BY_VIEW = new Map(CC_ROUTES.map((r) => [r.view, r] as const))
const BY_PATH = new Map(CC_ROUTES.map((r) => [r.path, r] as const))

export const pathForView = (view: string): string | null => BY_VIEW.get(view)?.path ?? null
export const viewForPath = (path: string): string | null => BY_PATH.get(path)?.view ?? null

/** أوّل شاشةٍ يملك صاحبُ هذه الصلاحيات مفتاحَها — أو `null` إن لم يملك شيئاً. */
export function firstAllowed(perms: string[]): CcRoute | null {
  return CC_ROUTES.find((r) => r.anyOf.some((p) => perms.includes(p))) ?? null
}
