'use client'
import { useState, useCallback } from 'react'
import { createClient, calcVaad, calcParking, calcTotal, ROLE_PERMISSIONS, ROLE_LABELS, PAYMENT_METHODS } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────
type Profile = { id: string; full_name: string; email: string; role: string; apartment_id?: string }
type Apartment = { id: string; sqm: number; parking_spots: number; owner_name?: string; owner_phone?: string }
type Payment = { id?: string; apartment_id: string; month: string; amount: number; vaad_amount: number; parking_amount: number; method?: string; status: string; reference?: string; paid_date?: string }
type Supplier = { id: string; name: string; category: string; phone?: string; email?: string }
type Invoice = { id: string; supplier_id: string; description: string; amount: number; invoice_date: string; status: string; suppliers?: { name: string; category: string } }
type Issue = { id: string; apartment_id?: string; title: string; category: string; priority: string; status: string; supplier_id?: string; suppliers?: { name: string }; created_at: string }
type BudgetItem = { id: string; name: string; monthly_amount: number; notes?: string }

interface Props {
  profile: Profile
  apartments: Apartment[]
  payments: Payment[]
  suppliers: Supplier[]
  invoices: Invoice[]
  issues: Issue[]
  budgetItems: BudgetItem[]
  profiles: Profile[]
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  app: { maxWidth: 960, margin: '0 auto', padding: '0 16px 40px' } as React.CSSProperties,
  header: { borderBottom: '0.5px solid #e0ddd6', padding: '1rem 0', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8 },
  h1: { fontSize: 18, fontWeight: 500 },
  sub: { fontSize: 12, color: '#888', marginTop: 3 },
  tabs: { display: 'flex', gap: 4, marginBottom: '1rem', flexWrap: 'wrap' as const },
  tab: (active: boolean, locked: boolean): React.CSSProperties => ({
    padding: '5px 13px', borderRadius: 8, border: '0.5px solid #ddd',
    background: active ? '#111' : 'transparent', color: active ? '#fff' : locked ? '#bbb' : '#444',
    cursor: locked ? 'not-allowed' : 'pointer', fontSize: 13,
  }),
  card: { background: '#fff', border: '0.5px solid #e0ddd6', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem' } as React.CSSProperties,
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' } as React.CSSProperties,
  cardTitle: { fontSize: 14, fontWeight: 500 },
  metric: { background: '#f5f4f0', borderRadius: 8, padding: '11px 13px' } as React.CSSProperties,
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: '1rem' } as React.CSSProperties,
  btn: (variant: 'default' | 'primary' | 'green' | 'red' | 'sm'): React.CSSProperties => ({
    padding: variant === 'sm' ? '3px 8px' : '6px 12px',
    borderRadius: 8, border: '0.5px solid #ccc',
    background: variant === 'primary' ? '#111' : variant === 'green' ? '#1D9E75' : variant === 'red' ? '#D85A30' : 'transparent',
    color: ['primary','green','red'].includes(variant) ? '#fff' : '#111',
    cursor: 'pointer', fontSize: variant === 'sm' ? 11 : 12,
  }),
  badge: (color: 'green' | 'red' | 'amber' | 'blue' | 'gray'): React.CSSProperties => {
    const map = {
      green: { bg: '#E1F5EE', color: '#0F6E56' }, red: { bg: '#FAECE7', color: '#993C1D' },
      amber: { bg: '#FAEEDA', color: '#854F0B' }, blue: { bg: '#E6F1FB', color: '#185FA5' },
      gray: { bg: '#F1EFE8', color: '#5F5E5A' },
    }
    return { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, background: map[color].bg, color: map[color].color }
  },
  input: { width: '100%', padding: '7px 10px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 11, color: '#666', display: 'block', marginBottom: 4 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: { textAlign: 'right' as const, padding: '7px 8px', color: '#888', fontWeight: 400, borderBottom: '0.5px solid #e0ddd6', fontSize: 11 },
  td: { padding: '8px 8px', borderBottom: '0.5px solid #e5e2da', verticalAlign: 'middle' as const },
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardClient({ profile, apartments, payments: initPayments, suppliers: initSuppliers, invoices: initInvoices, issues: initIssues, budgetItems, profiles: initProfiles }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const role = profile.role as keyof typeof ROLE_PERMISSIONS
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.readonly

  const [tab, setTab] = useState('dash')
  const [curMonth, setCurMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [payments, setPayments] = useState(initPayments)
  const [suppliers, setSuppliers] = useState(initSuppliers)
  const [invoices, setInvoices] = useState(initInvoices)
  const [issues, setIssues] = useState(initIssues)
  const [profiles, setProfiles] = useState(initProfiles)
  const [payMethod, setPayMethod] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<string | null>(null)

  // Form states
  const [payForm, setPayForm] = useState({ apt: apartments[0]?.id || '', month: curMonth, method: 'bank', reference: '', bankName: '', checkNumber: '', checkDate: '', last4: '' })
  const [supForm, setSupForm] = useState({ name: '', category: 'ניקיון', phone: '', email: '' })
  const [invForm, setInvForm] = useState({ supplierId: '', description: '', amount: '', invoiceDate: new Date().toISOString().slice(0,10), status: 'pending' })
  const [issForm, setIssForm] = useState({ aptId: '', title: '', category: 'שרברבות', priority: 'medium', supplierId: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'readonly', aptId: '' })

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  function refresh() { router.refresh() }

  // ─── Tab definitions ───────────────────────────────────────────────────────
  const TABS = [
    { id: 'dash', label: 'לוח בקרה', allowed: true },
    { id: 'vaad', label: 'גבייה', allowed: perms.editPayments || perms.viewAll },
    { id: 'payments', label: 'תשלומים', allowed: perms.editPayments },
    { id: 'budget', label: 'תקציב', allowed: perms.viewBudget },
    { id: 'suppliers', label: 'ספקים', allowed: perms.manageSuppliers },
    { id: 'issues', label: 'תקלות', allowed: perms.manageIssues },
    { id: 'users', label: 'משתמשים', allowed: perms.manageUsers },
    { id: 'docs', label: 'חוזה', allowed: perms.viewContract },
  ]

  // ─── Payment helpers ───────────────────────────────────────────────────────
  function getPayment(aptId: string, month: string) {
    return payments.find(p => p.apartment_id === aptId && p.month === month)
  }
  function getApt(id: string) { return apartments.find(a => a.id === id) }

  async function markPaid(aptId: string, method: string, ref: string, extras: Record<string, string> = {}) {
    const apt = getApt(aptId)
    if (!apt) return
    const vaadAmt = calcVaad(apt.sqm)
    const parkAmt = calcParking(apt.parking_spots)
    const totalAmt = vaadAmt + parkAmt
    const existing = getPayment(aptId, curMonth)
    const payload = {
      apartment_id: aptId, month: curMonth,
      amount: totalAmt, vaad_amount: vaadAmt, parking_amount: parkAmt,
      method, status: 'confirmed', reference: ref,
      paid_date: new Date().toISOString().slice(0, 10),
      ...extras
    }
    let result
    if (existing?.id) {
      result = await supabase.from('payments').update(payload).eq('id', existing.id).select().single()
    } else {
      result = await supabase.from('payments').upsert(payload, { onConflict: 'apartment_id,month' }).select().single()
    }
    if (result.error) { showToast('שגיאה: ' + result.error.message); return }
    setPayments(prev => {
      const filtered = prev.filter(p => !(p.apartment_id === aptId && p.month === curMonth))
      return [...filtered, result.data]
    })
    showToast('תשלום נרשם ✓')
  }

  async function cancelPayment(aptId: string) {
    const p = getPayment(aptId, curMonth)
    if (!p?.id) return
    await supabase.from('payments').update({ status: 'cancelled', paid_date: null, method: null }).eq('id', p.id)
    setPayments(prev => prev.map(x => x.apartment_id === aptId && x.month === curMonth ? { ...x, status: 'cancelled', paid_date: undefined } : x))
    showToast('תשלום בוטל')
  }

  async function markAllPaid() {
    for (const apt of apartments) {
      const p = getPayment(apt.id, curMonth)
      if (!p || p.status !== 'confirmed') {
        await markPaid(apt.id, 'bank', 'אוטומטי')
      }
    }
    showToast('כל הדירות סומנו ✓')
  }

  async function registerPaymentForm() {
    const { apt, method, reference, bankName, checkNumber, checkDate, last4 } = payForm
    await markPaid(apt, method, reference, { bank_name: bankName, check_number: checkNumber, check_date: checkDate || undefined, last4 })
    setModal(null)
    setPayMethod(null)
  }

  // ─── Supplier helpers ──────────────────────────────────────────────────────
  async function addSupplier() {
    if (!supForm.name) return showToast('נא להזין שם ספק')
    const { data, error } = await supabase.from('suppliers').insert({ name: supForm.name, category: supForm.category, phone: supForm.phone, email: supForm.email }).select().single()
    if (error) return showToast('שגיאה')
    setSuppliers(prev => [...prev, data])
    setModal(null)
    setSupForm({ name: '', category: 'ניקיון', phone: '', email: '' })
    showToast('ספק נוסף ✓')
  }

  async function addInvoice() {
    if (!invForm.supplierId || !invForm.amount) return showToast('נא למלא שדות חובה')
    const { data, error } = await supabase.from('invoices').insert({ supplier_id: invForm.supplierId, description: invForm.description, amount: parseFloat(invForm.amount), invoice_date: invForm.invoiceDate, status: invForm.status }).select('*, suppliers(name,category)').single()
    if (error) return showToast('שגיאה')
    setInvoices(prev => [data, ...prev])
    setModal(null)
    showToast('חשבונית נוספה ✓')
  }

  async function payInvoice(id: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_date: new Date().toISOString().slice(0,10) }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' } : i))
    showToast('חשבונית סומנה כשולמה ✓')
  }

  // ─── Issue helpers ─────────────────────────────────────────────────────────
  async function addIssue() {
    if (!issForm.title) return showToast('נא להזין כותרת')
    const { data, error } = await supabase.from('issues').insert({ apartment_id: issForm.aptId || null, title: issForm.title, category: issForm.category, priority: issForm.priority, supplier_id: issForm.supplierId || null, reported_by: profile.id }).select('*, suppliers(name)').single()
    if (error) return showToast('שגיאה')
    setIssues(prev => [data, ...prev])
    setModal(null)
    showToast('תקלה נפתחה ✓')
  }

  async function advanceIssue(id: string, current: string) {
    const next: Record<string, string> = { open: 'inprogress', inprogress: 'done', done: 'open' }
    const newStatus = next[current] || 'open'
    await supabase.from('issues').update({ status: newStatus, resolved_at: newStatus === 'done' ? new Date().toISOString() : null }).eq('id', id)
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
    showToast('סטטוס עודכן')
  }

  // ─── User helpers ──────────────────────────────────────────────────────────
  async function addUser() {
    if (!userForm.name || !userForm.email || !userForm.password) return showToast('נא למלא שם, אימייל וסיסמה')
    const { data, error } = await supabase.auth.admin?.createUser?.({
      email: userForm.email, password: userForm.password,
      user_metadata: { full_name: userForm.name, role: userForm.role }
    }) as any
    if (error) {
      // Fallback: insert directly (if admin API unavailable client-side)
      showToast('ניתן להוסיף משתמשים רק מ-Supabase Dashboard → Authentication')
      return
    }
    setModal(null)
    showToast('משתמש נוסף ✓')
    refresh()
  }

  // ─── Logout ────────────────────────────────────────────────────────────────
  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ─── CSV Export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [['דירה','מ"ר','חניות','דמי ועד','חניה','סה"כ','שולם','שיטה','תאריך']]
    apartments.forEach(a => {
      const p = getPayment(a.id, curMonth)
      rows.push([a.id, String(a.sqm), String(a.parking_spots), String(calcVaad(a.sqm)), String(calcParking(a.parking_spots)), String(calcTotal(a.sqm, a.parking_spots)), p?.status === 'confirmed' ? 'כן' : 'לא', p?.method || '', p?.paid_date || ''])
    })
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `mgdal1_${curMonth}.csv`
    a.click()
    showToast('CSV יוצא ✓')
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-')
    const names = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
    return `${names[parseInt(mo)]} ${y}`
  }
  const aptLabel = (id: string) => id === 'מסחר' ? 'מסחר' : `דירה ${id}`
  const prioColor = (p: string): 'red'|'amber'|'gray' => p === 'urgent' || p === 'high' ? 'red' : p === 'medium' ? 'amber' : 'gray'
  const prioLabel: Record<string,string> = { urgent: 'דחוף', high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' }
  const statusColor = (s: string): 'amber'|'blue'|'green'|'red' => ({ open: 'amber', inprogress: 'blue', done: 'green', confirmed: 'green', pending: 'amber', paid: 'green', cancelled: 'red' } as any)[s] || 'gray'
  const statusLabel: Record<string,string> = { open: 'פתוח', inprogress: 'בטיפול', done: 'נסגר', confirmed: 'שולם', pending: 'ממתין', paid: 'שולם', cancelled: 'בוטל' }

  const monthPayments = apartments.map(a => {
    const p = getPayment(a.id, curMonth)
    return { apt: a, payment: p, paid: p?.status === 'confirmed' }
  })
  const paidCount = monthPayments.filter(x => x.paid).length
  const totalMonth = apartments.reduce((s, a) => s + calcTotal(a.sqm, a.parking_spots), 0)
  const collectedMonth = monthPayments.filter(x => x.paid).reduce((s, x) => s + calcTotal(x.apt.sqm, x.apt.parking_spots), 0)
  const pendingInvAmt = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0)
  const openIssuesCount = issues.filter(i => i.status !== 'done' && i.status !== 'cancelled').length

  // ─── Render helpers ────────────────────────────────────────────────────────
  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>{children}</div>
  )
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label style={S.label}>{label}</label>{children}</div>
  )
  const ModalWrap = ({ id, title, onSave, children }: { id: string; title: string; onSave: () => void; children: React.ReactNode }) => (
    modal === id ? (
      <div onClick={e => { if (e.target === e.currentTarget) setModal(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e0ddd6', padding: '1.25rem', width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: '1rem' }}>{title}</h3>
          {children}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button style={S.btn('default')} onClick={() => setModal(null)}>ביטול</button>
            <button style={S.btn('primary')} onClick={onSave}>שמור</button>
          </div>
        </div>
      </div>
    ) : null
  )

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={S.app} dir="rtl">

      {/* HEADER */}
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>מגדל 1 תל אביב — ניהול נכס</h1>
          <p style={S.sub}>{ROLE_LABELS[role]} · {profile.full_name} · {profile.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={curMonth} onChange={e => setCurMonth(e.target.value)} style={{ fontSize: 12, padding: '5px 10px', border: '0.5px solid #ccc', borderRadius: 8 }}>
            {['2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'].map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button style={S.btn('green')} onClick={exportCSV}>CSV ↓</button>
          <button style={S.btn('default')} onClick={logout}>יציאה</button>
        </div>
      </div>

      {/* TABS */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id, !t.allowed)} onClick={() => t.allowed && setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ═══════════════ DASHBOARD ═══════════════ */}
      {tab === 'dash' && (
        <>
          <div style={S.metricsGrid}>
            {[
              { label: 'נגבה החודש', value: `₪${collectedMonth.toLocaleString()}`, sub: `${paidCount}/${apartments.length} יחידות`, color: '#1D9E75' },
              { label: 'ממתין לגבייה', value: `₪${(totalMonth-collectedMonth).toLocaleString()}`, sub: `${apartments.length-paidCount} יחידות`, color: '#BA7517' },
              { label: 'חשבוניות ממתינות', value: `₪${pendingInvAmt.toLocaleString()}`, sub: `${invoices.filter(i=>i.status==='pending').length} ספקים`, color: '#D85A30' },
              { label: 'תקלות פתוחות', value: String(openIssuesCount), sub: `מתוך ${issues.length} סה"כ`, color: openIssuesCount > 3 ? '#D85A30' : '#BA7517' },
            ].map(m => (
              <div key={m.label} style={S.metric}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 500, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={S.card}>
              <div style={S.cardHeader}><span style={S.cardTitle}>גבייה — {monthLabel(curMonth)}</span></div>
              <table style={S.table}><tbody>
                {monthPayments.map(({ apt, paid, payment }) => (
                  <tr key={apt.id}>
                    <td style={{ ...S.td, color: '#888', fontSize: 12 }}>{aptLabel(apt.id)}</td>
                    <td style={S.td}><span style={S.badge(paid ? 'green' : 'amber')}>{paid ? 'שולם' : 'ממתין'}</span></td>
                    <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{payment?.method || ''}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
            <div style={S.card}>
              <div style={S.cardHeader}><span style={S.cardTitle}>תקלות פתוחות</span></div>
              {issues.filter(i => i.status !== 'done').slice(0,6).length === 0
                ? <p style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '1.5rem 0' }}>אין תקלות פתוחות</p>
                : <table style={S.table}><tbody>
                  {issues.filter(i => i.status !== 'done').slice(0,6).map(i => (
                    <tr key={i.id}>
                      <td style={{ ...S.td, fontSize: 12 }}>{i.apartment_id ? aptLabel(i.apartment_id) : 'שטח משותף'} — {i.title.slice(0,28)}</td>
                      <td style={S.td}><span style={S.badge(statusColor(i.status) as any)}>{statusLabel[i.status]}</span></td>
                    </tr>
                  ))}
                </tbody></table>
              }
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ VAAD ═══════════════ */}
      {tab === 'vaad' && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>גבייה — {monthLabel(curMonth)}</span>
            {perms.editPayments && <button style={S.btn('primary')} onClick={markAllPaid}>✓ סמן הכל כשולם</button>}
          </div>
          <table style={S.table}>
            <thead><tr>
              {['דירה','מ"ר','חניות','דמי ועד','חניה','סה"כ','סטטוס','שיטה','תאריך',''].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {monthPayments.map(({ apt, paid, payment }) => (
                <tr key={apt.id}>
                  <td style={S.td}>{aptLabel(apt.id)}</td>
                  <td style={{ ...S.td, color: '#888' }}>{apt.sqm}</td>
                  <td style={{ ...S.td, color: '#888' }}>{apt.parking_spots}</td>
                  <td style={S.td}>₪{calcVaad(apt.sqm).toLocaleString()}</td>
                  <td style={S.td}>{apt.parking_spots ? `₪${calcParking(apt.parking_spots).toLocaleString()}` : '-'}</td>
                  <td style={{ ...S.td, fontWeight: 500 }}>₪{calcTotal(apt.sqm, apt.parking_spots).toLocaleString()}</td>
                  <td style={S.td}><span style={S.badge(paid ? 'green' : 'amber')}>{paid ? 'שולם' : 'ממתין'}</span></td>
                  <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{payment?.method || '-'}</td>
                  <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{payment?.paid_date || '-'}</td>
                  <td style={S.td}>
                    {perms.editPayments && !paid && (
                      <button style={S.btn('green')} onClick={() => { setPayForm(f => ({ ...f, apt: apt.id, month: curMonth })); setModal('pay-modal') }}>
                        רשום תשלום
                      </button>
                    )}
                    {perms.editPayments && paid && (
                      <button style={{ ...S.btn('default'), fontSize: 11 }} onClick={() => cancelPayment(apt.id)}>בטל</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '0.5px solid #e0ddd6' }}>
            <span style={{ fontSize: 12, color: '#888' }}>שולם: {paidCount}/{apartments.length} · ₪{collectedMonth.toLocaleString()} / ₪{totalMonth.toLocaleString()}</span>
            <div style={{ height: 5, width: 120, background: '#eee', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(paidCount/apartments.length*100)}%`, background: '#1D9E75', borderRadius: 99 }} />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ PAYMENTS ═══════════════ */}
      {tab === 'payments' && perms.editPayments && (
        <>
          <div style={S.card}>
            <div style={S.cardHeader}><span style={S.cardTitle}>רישום תשלום — בחר שיטה</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginBottom: '1rem' }}>
              {PAYMENT_METHODS.map(pm => (
                <div key={pm.id} onClick={() => setPayMethod(pm.id)}
                  style={{ border: payMethod === pm.id ? '2px solid #185FA5' : '0.5px solid #ddd', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', background: '#fff' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{pm.label}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{pm.desc}</div>
                </div>
              ))}
            </div>
            {payMethod && (
              <div style={{ borderTop: '0.5px solid #e0ddd6', paddingTop: '1rem' }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: '0.75rem' }}>פרטי תשלום — {PAYMENT_METHODS.find(p=>p.id===payMethod)?.label}</p>
                <Row>
                  <Field label="דירה">
                    <select value={payForm.apt} onChange={e => setPayForm(f => ({ ...f, apt: e.target.value }))} style={S.input}>
                      {apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>)}
                    </select>
                  </Field>
                  <Field label="חודש">
                    <select value={payForm.month} onChange={e => setPayForm(f => ({ ...f, month: e.target.value }))} style={S.input}>
                      {['2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'].map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                    </select>
                  </Field>
                </Row>
                <Row>
                  <Field label="אסמכתא / מס' אישור">
                    <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="מס' עסקה..." style={S.input} />
                  </Field>
                  {(payMethod === 'bank' || payMethod === 'wire' || payMethod === 'check') && (
                    <Field label="בנק">
                      <select value={payForm.bankName} onChange={e => setPayForm(f => ({ ...f, bankName: e.target.value }))} style={S.input}>
                        {['הפועלים','לאומי','דיסקונט','מזרחי-טפחות','ירושלים','אחר'].map(b => <option key={b}>{b}</option>)}
                      </select>
                    </Field>
                  )}
                  {payMethod === 'check' && (
                    <Field label="מספר שיק">
                      <input value={payForm.checkNumber} onChange={e => setPayForm(f => ({ ...f, checkNumber: e.target.value }))} style={S.input} />
                    </Field>
                  )}
                  {payMethod === 'cc' && (
                    <Field label="4 ספרות אחרונות">
                      <input value={payForm.last4} onChange={e => setPayForm(f => ({ ...f, last4: e.target.value }))} maxLength={4} style={S.input} />
                    </Field>
                  )}
                </Row>
                <button style={S.btn('primary')} onClick={registerPaymentForm}>אשר תשלום ✓</button>
              </div>
            )}
          </div>
          <div style={S.card}>
            <div style={S.cardHeader}><span style={S.cardTitle}>היסטוריית תשלומים</span></div>
            <table style={S.table}>
              <thead><tr>{['חודש','דירה','שיטה','אסמכתא','סכום','סטטוס'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {payments.filter(p => p.status === 'confirmed').slice(0,30).map(p => {
                  const apt = getApt(p.apartment_id)
                  return apt ? (
                    <tr key={`${p.apartment_id}-${p.month}`}>
                      <td style={{ ...S.td, color: '#888' }}>{monthLabel(p.month)}</td>
                      <td style={S.td}>{aptLabel(p.apartment_id)}</td>
                      <td style={S.td}><span style={S.badge('blue')}>{PAYMENT_METHODS.find(x=>x.id===p.method)?.label || p.method || '-'}</span></td>
                      <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{p.reference || '-'}</td>
                      <td style={S.td}>₪{p.amount?.toLocaleString()}</td>
                      <td style={S.td}><span style={S.badge('green')}>אושר</span></td>
                    </tr>
                  ) : null
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════ BUDGET ═══════════════ */}
      {tab === 'budget' && perms.viewBudget && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>תוכנית תקציבית — {monthLabel(curMonth)}</span>
            <span style={{ fontSize: 12, color: '#888' }}>סה"כ מטרג': 1,086 מ"ר</span>
          </div>
          <table style={S.table}>
            <thead><tr>{['סעיף','עלות חודשית','הערות'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {budgetItems.map(b => (
                <tr key={b.id}>
                  <td style={S.td}>{b.name}</td>
                  <td style={S.td}>₪{b.monthly_amount.toLocaleString()}</td>
                  <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{b.notes}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...S.td, fontWeight: 500, borderTop: '0.5px solid #ccc' }}>סה"כ</td>
                <td style={{ ...S.td, fontWeight: 500, color: '#185FA5', borderTop: '0.5px solid #ccc' }}>
                  ₪{budgetItems.reduce((s,b) => s + b.monthly_amount, 0).toLocaleString()}
                </td>
                <td style={{ ...S.td, borderTop: '0.5px solid #ccc' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════ SUPPLIERS ═══════════════ */}
      {tab === 'suppliers' && perms.manageSuppliers && (
        <>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>ספקים</span>
              <button style={S.btn('primary')} onClick={() => setModal('sup-modal')}>+ ספק</button>
            </div>
            <table style={S.table}>
              <thead><tr>{['ספק','קטגוריה','טלפון','חשבונית אחרונה','סכום','סטטוס'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {suppliers.map(s => {
                  const last = [...invoices].filter(i=>i.supplier_id===s.id).sort((a,b)=>b.invoice_date.localeCompare(a.invoice_date))[0]
                  return (
                    <tr key={s.id}>
                      <td style={{ ...S.td, fontWeight: 500 }}>{s.name}</td>
                      <td style={S.td}><span style={S.badge('blue')}>{s.category}</span></td>
                      <td style={{ ...S.td, color: '#888' }}>{s.phone || '-'}</td>
                      <td style={{ ...S.td, color: '#888', fontSize: 11 }}>{last?.invoice_date || '-'}</td>
                      <td style={S.td}>{last ? `₪${last.amount.toLocaleString()}` : '-'}</td>
                      <td style={S.td}>{last ? <span style={S.badge(last.status==='paid'?'green':'amber')}>{statusLabel[last.status]}</span> : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>חשבוניות</span>
              <button style={S.btn('primary')} onClick={() => setModal('inv-modal')}>+ חשבונית</button>
            </div>
            <table style={S.table}>
              <thead><tr>{['תאריך','ספק','תיאור','סכום','סטטוס',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {[...invoices].sort((a,b)=>b.invoice_date.localeCompare(a.invoice_date)).map(inv => (
                  <tr key={inv.id}>
                    <td style={{ ...S.td, color: '#888', fontSize: 11 }}>{inv.invoice_date}</td>
                    <td style={S.td}>{inv.suppliers?.name || '-'}</td>
                    <td style={S.td}>{inv.description}</td>
                    <td style={S.td}>₪{inv.amount.toLocaleString()}</td>
                    <td style={S.td}><span style={S.badge(inv.status==='paid'?'green':'amber')}>{statusLabel[inv.status]}</span></td>
                    <td style={S.td}>
                      {inv.status === 'pending' && <button style={{ ...S.btn('green'), fontSize: 11, padding: '3px 8px' }} onClick={() => payInvoice(inv.id)}>שלם</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════ ISSUES ═══════════════ */}
      {tab === 'issues' && perms.manageIssues && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>תקלות ופניות</span>
            <button style={S.btn('primary')} onClick={() => setModal('iss-modal')}>+ תקלה</button>
          </div>
          <table style={S.table}>
            <thead><tr>{['דירה','כותרת','קטגוריה','עדיפות','ספק','תאריך','סטטוס',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {issues.sort((a,b) => {const o: Record<string,number>={urgent:0,high:1,medium:2,low:3};return o[a.priority]-o[b.priority]}).map(i => (
                <tr key={i.id}>
                  <td style={S.td}>{i.apartment_id ? aptLabel(i.apartment_id) : 'משותף'}</td>
                  <td style={S.td}>{i.title}</td>
                  <td style={S.td}><span style={S.badge('blue')}>{i.category}</span></td>
                  <td style={S.td}><span style={S.badge(prioColor(i.priority))}>{prioLabel[i.priority]}</span></td>
                  <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{i.suppliers?.name || '-'}</td>
                  <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{i.created_at?.slice(0,10)}</td>
                  <td style={S.td}><span style={S.badge(statusColor(i.status) as any)}>{statusLabel[i.status]}</span></td>
                  <td style={S.td}>
                    <button style={{ ...S.btn('default'), fontSize: 11, padding: '3px 8px' }} onClick={() => advanceIssue(i.id, i.status)}>
                      {{ open: 'התחל', inprogress: 'סגור', done: 'פתח מחדש' }[i.status] || 'עדכן'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════ USERS ═══════════════ */}
      {tab === 'users' && perms.manageUsers && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>משתמשים וגישה</span>
            <button style={S.btn('primary')} onClick={() => setModal('user-modal')}>+ משתמש</button>
          </div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: '0.75rem' }}>להוסיף משתמשים: Supabase Dashboard → Authentication → Users → Invite user</p>
          <table style={S.table}>
            <thead><tr>{['שם','אימייל','תפקיד','דירה','פעולות'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {profiles.map(p => (
                <tr key={p.id}>
                  <td style={{ ...S.td, fontWeight: 500 }}>{p.full_name}</td>
                  <td style={{ ...S.td, fontSize: 11, color: '#888' }}>{p.email}</td>
                  <td style={S.td}><span style={S.badge('blue')}>{ROLE_LABELS[p.role] || p.role}</span></td>
                  <td style={{ ...S.td, color: '#888' }}>{p.apartment_id ? aptLabel(p.apartment_id) : '-'}</td>
                  <td style={S.td}><button style={{ ...S.btn('default'), fontSize: 11, padding: '3px 8px' }}>ערוך</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════ DOCS ═══════════════ */}
      {tab === 'docs' && perms.viewContract && (
        <div style={S.card}>
          <div style={S.cardHeader}><span style={S.cardTitle}>פרטי ההסכם — עידן ש.נ.י.</span></div>
          <table style={S.table}><tbody>
            {[
              ['חברת ניהול', 'עידן (ש.נ.י.) שירותי ניהול ואחזקת מבנים בע"מ'],
              ['מורשה חתימה', 'אמיר רוזנבלום, ת.ז. 024381659'],
              ['נציגות ועד', 'שי טופף · הילה גולן · מרחב זוארץ'],
              ['תמורה חודשית', '₪3,357 + מע"מ'],
              ['תקופת הסכם', 'שנה — מתחדש אוטומטית (הודעה 60 יום)'],
              ['ביטול הסכם', '30 יום הודעה מראש בכתב'],
              ['קופה קטנה', '₪1,000 + חידוש עם דוח מלא'],
              ['קריאת שירות חריגה', '₪350 + מע"מ (מחוץ לשעות א\'-ה\' 08:00-16:30)'],
              ['SLA תקלה דחופה', 'טיפול תוך 4 שעות'],
              ['ביטוח צד ג\'', '₪10,000,000 למקרה ולתקופה'],
              ['ביטוח מעבידים', '₪20,000,000 לתובע'],
              ['חלקה / גוש', 'חלקה 92 / גוש 6927'],
            ].map(([k,v]) => (
              <tr key={k as string}>
                <td style={{ ...S.td, color: '#888', width: '35%' }}>{k}</td>
                <td style={S.td}>{v}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}
      <ModalWrap id="pay-modal" title="רישום תשלום" onSave={registerPaymentForm}>
        <Row>
          <Field label="דירה">
            <select value={payForm.apt} onChange={e => setPayForm(f => ({ ...f, apt: e.target.value }))} style={S.input}>
              {apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>)}
            </select>
          </Field>
          <Field label="שיטת תשלום">
            <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} style={S.input}>
              {PAYMENT_METHODS.map(pm => <option key={pm.id} value={pm.id}>{pm.label}</option>)}
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="אסמכתא">
            <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} style={S.input} placeholder="מס' אישור..." />
          </Field>
          {(payForm.method === 'check') && (
            <Field label="מספר שיק">
              <input value={payForm.checkNumber} onChange={e => setPayForm(f => ({ ...f, checkNumber: e.target.value }))} style={S.input} />
            </Field>
          )}
        </Row>
      </ModalWrap>

      <ModalWrap id="sup-modal" title="ספק חדש" onSave={addSupplier}>
        <Row>
          <Field label="שם ספק"><input value={supForm.name} onChange={e => setSupForm(f => ({ ...f, name: e.target.value }))} style={S.input} /></Field>
          <Field label="קטגוריה">
            <select value={supForm.category} onChange={e => setSupForm(f => ({ ...f, category: e.target.value }))} style={S.input}>
              {['ניקיון','מעלית','גנרטור','חשמל','אינסטלציה','שרברבות','חניון','גילוי אש','אחר'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="טלפון"><input value={supForm.phone} onChange={e => setSupForm(f => ({ ...f, phone: e.target.value }))} style={S.input} /></Field>
          <Field label="אימייל"><input type="email" value={supForm.email} onChange={e => setSupForm(f => ({ ...f, email: e.target.value }))} style={S.input} /></Field>
        </Row>
      </ModalWrap>

      <ModalWrap id="inv-modal" title="חשבונית חדשה" onSave={addInvoice}>
        <Row>
          <Field label="ספק">
            <select value={invForm.supplierId} onChange={e => setInvForm(f => ({ ...f, supplierId: e.target.value }))} style={S.input}>
              <option value="">בחר ספק...</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="תאריך"><input type="date" value={invForm.invoiceDate} onChange={e => setInvForm(f => ({ ...f, invoiceDate: e.target.value }))} style={S.input} /></Field>
        </Row>
        <Row>
          <Field label="תיאור"><input value={invForm.description} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} style={S.input} /></Field>
          <Field label="סכום ₪"><input type="number" value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} style={S.input} /></Field>
        </Row>
        <Field label="סטטוס">
          <select value={invForm.status} onChange={e => setInvForm(f => ({ ...f, status: e.target.value }))} style={S.input}>
            <option value="pending">ממתין לתשלום</option><option value="paid">שולם</option>
          </select>
        </Field>
      </ModalWrap>

      <ModalWrap id="iss-modal" title="תקלה חדשה" onSave={addIssue}>
        <Row>
          <Field label="דירה">
            <select value={issForm.aptId} onChange={e => setIssForm(f => ({ ...f, aptId: e.target.value }))} style={S.input}>
              <option value="">שטח משותף</option>
              {apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>)}
            </select>
          </Field>
          <Field label="קטגוריה">
            <select value={issForm.category} onChange={e => setIssForm(f => ({ ...f, category: e.target.value }))} style={S.input}>
              {['שרברבות','חשמל','ניקיון','מעלית','גנרטור','חניון','אחר'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </Row>
        <Field label="כותרת / תיאור">
          <input value={issForm.title} onChange={e => setIssForm(f => ({ ...f, title: e.target.value }))} style={S.input} placeholder="תאר את התקלה..." />
        </Field>
        <Row>
          <Field label="עדיפות">
            <select value={issForm.priority} onChange={e => setIssForm(f => ({ ...f, priority: e.target.value }))} style={S.input}>
              <option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="urgent">דחוף</option>
            </select>
          </Field>
          <Field label="ספק מטפל">
            <select value={issForm.supplierId} onChange={e => setIssForm(f => ({ ...f, supplierId: e.target.value }))} style={S.input}>
              <option value="">— ללא —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </Row>
      </ModalWrap>

      <ModalWrap id="user-modal" title="הוספת משתמש" onSave={addUser}>
        <p style={{ fontSize: 12, color: '#888', marginBottom: '0.75rem', background: '#f5f4f0', padding: '8px 10px', borderRadius: 8 }}>
          להוסיף משתמשים: Supabase → Authentication → Users → "Invite user"<br/>
          הגדר תפקיד דרך: Table Editor → profiles
        </p>
        <Row>
          <Field label="שם מלא"><input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} style={S.input} /></Field>
          <Field label="תפקיד">
            <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))} style={S.input}>
              <option value="admin">מנהל ראשי</option><option value="committee">נציג ועד</option>
              <option value="manager">חברת ניהול</option><option value="resident">דייר</option><option value="readonly">צפייה בלבד</option>
            </select>
          </Field>
        </Row>
      </ModalWrap>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '9px 18px', borderRadius: 8, fontSize: 12, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
