'use client'
import { useState, useEffect } from 'react'
import { createClient, calcVaad, calcParking, calcTotal, ROLE_PERMISSIONS, ROLE_LABELS, PAYMENT_METHODS } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Profile = { id: string; full_name: string; email: string; role: string; apartment_id?: string; phone?: string }
type Apartment = { id: string; sqm: number; parking_spots: number; owner_name?: string; owner_phone?: string; owner_email?: string }
type Payment = { id?: string; apartment_id: string; month: string; amount: number; vaad_amount: number; parking_amount: number; method?: string; status: string; reference?: string; paid_date?: string }
type Supplier = { id: string; name: string; category: string; phone?: string; email?: string; reason?: string; contract_start?: string; contract_end?: string; payment_terms?: string; contact_name?: string; notes?: string }
type Invoice = { id: string; supplier_id: string; description: string; amount: number; invoice_date: string; status: string; suppliers?: { name: string; category: string } }
type Issue = { id: string; apartment_id?: string; title: string; category: string; priority: string; status: string; supplier_id?: string; suppliers?: { name: string }; created_at: string }
type BudgetItem = { id: string; name: string; monthly_amount: number; actual_amount?: number; notes?: string }
type PaymentRequest = { id: string; apartment_id: string; month: string; amount: number; method: string; status: string; phone?: string; created_at: string }

interface Props {
  profile: Profile
  apartments: Apartment[]
  payments: Payment[]
  suppliers: Supplier[]
  invoices: Invoice[]
  issues: Issue[]
  budgetItems: BudgetItem[]
  profiles: Profile[]
  paymentRequests: PaymentRequest[]
}

const COLORS = {
  cream: '#FBF8F3', cream2: '#F5EFE6', warm: '#E8DDD0',
  teal: '#1A7A6E', teal2: '#2A9B8C', tealLight: '#E6F5F3',
  coral: '#E86A3A', coralLight: '#FDF0EA',
  amber: '#D4860A', amberLight: '#FEF6E4',
  text: '#2C2118', text2: '#7A6A5A', text3: '#A89A8A',
}

const S: Record<string, React.CSSProperties> = {
  app: { fontFamily: "'Nunito', system-ui, sans-serif", background: COLORS.cream, minHeight: '100vh', direction: 'rtl' as const },
  topbar: { background: '#fff', borderBottom: `1px solid ${COLORS.warm}`, padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  sidebar: { width: 200, background: '#fff', borderLeft: `1px solid ${COLORS.warm}`, minHeight: 'calc(100vh - 60px)', padding: '1rem 0', flexShrink: 0 },
  main: { flex: 1, padding: '1.5rem', minWidth: 0, overflowX: 'hidden' as const },
  card: { background: '#fff', border: `1px solid ${COLORS.warm}`, borderRadius: 16, padding: '1.25rem', marginBottom: '1rem' },
  metric: { background: '#fff', border: `1px solid ${COLORS.warm}`, borderRadius: 16, padding: '1.1rem 1.25rem' },
  btn: (v: string = 'default'): React.CSSProperties => ({
    padding: v === 'sm' ? '5px 12px' : '8px 16px',
    borderRadius: 8, fontFamily: 'inherit', fontWeight: 600,
    fontSize: v === 'sm' ? 12 : 13, cursor: 'pointer',
    border: v === 'primary' ? 'none' : v === 'teal' ? 'none' : `1.5px solid ${COLORS.warm}`,
    background: v === 'primary' ? COLORS.teal : v === 'teal' ? COLORS.teal : v === 'coral' ? COLORS.coral : '#fff',
    color: ['primary','teal','coral'].includes(v) ? '#fff' : COLORS.text,
  }),
  input: { fontFamily: 'inherit', fontSize: 13, padding: '9px 12px', border: `1.5px solid ${COLORS.warm}`, borderRadius: 8, background: COLORS.cream, color: COLORS.text, width: '100%' },
  label: { fontSize: 12, fontWeight: 600, color: COLORS.text2, display: 'block', marginBottom: 5 },
  th: { textAlign: 'right' as const, padding: '8px 10px', color: COLORS.text3, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: `2px solid ${COLORS.cream2}` },
  td: { padding: '10px 10px', color: COLORS.text, borderBottom: `1px solid ${COLORS.cream2}`, verticalAlign: 'middle' as const },
}

const badge = (color: string, text: string) => {
  const map: Record<string, [string, string]> = {
    green: ['#E6F7F1', '#0F6E56'], amber: [COLORS.amberLight, '#854F0B'],
    red: [COLORS.coralLight, '#993C1D'], blue: ['#E6F1FB', '#185FA5'], gray: [COLORS.cream2, COLORS.text2],
  }
  const [bg, fg] = map[color] || map.gray
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />
    {text}
  </span>
}

const statusBadge = (s: string) => {
  const map: Record<string, [string, string]> = {
    confirmed: ['green', 'שולם'], paid: ['green', 'שולם'], done: ['green', 'נסגר'],
    pending: ['amber', 'ממתין'], open: ['amber', 'פתוח'],
    inprogress: ['blue', 'בטיפול'], cancelled: ['red', 'בוטל'], sent: ['blue', 'נשלח'],
  }
  const [color, label] = map[s] || ['gray', s]
  return badge(color, label)
}

const prioBadge = (p: string) => {
  const map: Record<string, [string, string]> = {
    urgent: ['red', 'דחוף'], high: ['red', 'גבוהה'], medium: ['amber', 'בינונית'], low: ['gray', 'נמוכה']
  }
  const [color, label] = map[p] || ['gray', p]
  return badge(color, label)
}

export default function DashboardClient({ profile, apartments, payments: initPayments, suppliers: initSuppliers, invoices: initInvoices, issues: initIssues, budgetItems: initBudget, profiles: initProfiles, paymentRequests: initPR }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const role = profile.role as keyof typeof ROLE_PERMISSIONS
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.readonly
  const isManager = ['admin', 'committee'].includes(role)

  const [tab, setTab] = useState('dash')
  const [curMonth, setCurMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [payments, setPayments] = useState(initPayments)
  const [suppliers, setSuppliers] = useState(initSuppliers)
  const [invoices, setInvoices] = useState(initInvoices)
  const [issues, setIssues] = useState(initIssues)
  const [budget, setBudget] = useState(initBudget)
  const [profiles, setProfiles] = useState(initProfiles)
  const [payReqs, setPayReqs] = useState(initPR)
  const [modal, setModal] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [supForm, setSupForm] = useState({ name: '', category: 'ניקיון', phone: '', email: '', reason: '', contract_start: '', payment_terms: '', contact_name: '' })
  const [invForm, setInvForm] = useState({ supplierId: '', description: '', amount: '', invoiceDate: new Date().toISOString().slice(0,10), status: 'pending' })
  const [issForm, setIssForm] = useState({ aptId: '', title: '', category: 'שרברבות', priority: 'medium', supplierId: '' })
  const [payForm, setPayForm] = useState({ apt: apartments[0]?.id || '', method: 'bit', reference: '', phone: '' })
  const [budgetActual, setBudgetActual] = useState<Record<string, string>>({})
  const [editSup, setEditSup] = useState<Supplier | null>(null)
  const [issFilter, setIssFilter] = useState('all')
  const [issSearch, setIssSearch] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }
  function getPayment(aptId: string) { return payments.find(p => p.apartment_id === aptId && p.month === curMonth) }
  function aptLabel(id: string) { return id === 'מסחר' ? 'מסחר' : `דירה ${id}` }
  function monthLabel(m: string) {
    const names = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
    const [y, mo] = m.split('-'); return `${names[parseInt(mo)]} ${y}`
  }

  const monthPmts = apartments.map(a => ({ apt: a, payment: getPayment(a.id), paid: (getPayment(a.id)?.status === 'confirmed') }))
  const paidCount = monthPmts.filter(x => x.paid).length
  const totalMonth = apartments.reduce((s, a) => s + calcTotal(a.sqm, a.parking_spots), 0)
  const collectedMonth = monthPmts.filter(x => x.paid).reduce((s, x) => s + calcTotal(x.apt.sqm, x.apt.parking_spots), 0)
  const pendingInv = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0)
  const openIssues = issues.filter(i => i.status !== 'done' && i.status !== 'cancelled').length

  async function markPaid(aptId: string, method: string, ref: string) {
    const apt = apartments.find(a => a.id === aptId)
    if (!apt) return
    const payload = { apartment_id: aptId, month: curMonth, amount: calcTotal(apt.sqm, apt.parking_spots), vaad_amount: calcVaad(apt.sqm), parking_amount: calcParking(apt.parking_spots), method, status: 'confirmed', reference: ref || null, paid_date: new Date().toISOString().slice(0,10) }
    const existing = getPayment(aptId)
    let result
    if (existing?.id) { result = await supabase.from('payments').update(payload).eq('id', existing.id).select().single() }
    else { result = await supabase.from('payments').upsert(payload, { onConflict: 'apartment_id,month' }).select().single() }
    if (result.error) { showToast('שגיאה: ' + result.error.message); return }
    setPayments(prev => [...prev.filter(p => !(p.apartment_id === aptId && p.month === curMonth)), result.data])
    showToast('תשלום נרשם ✓')
  }

  async function sendBitRequest(aptId: string, phone: string) {
    const apt = apartments.find(a => a.id === aptId)
    if (!apt || !phone) return showToast('נא להזין מספר טלפון')
    const amount = calcTotal(apt.sqm, apt.parking_spots)
    const msg = `שלום, תשלום ועד בית ${monthLabel(curMonth)} — ${aptLabel(aptId)}: ₪${amount.toLocaleString()}\nלתשלום ב-Bit: https://pay.bit.ly/mgdal1\nלתשלום בפייבוקס: https://paybox.me/mgdal1`
    const waUrl = `https://wa.me/972${phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
    await supabase.from('payment_requests').insert({ apartment_id: aptId, month: curMonth, amount, method: 'bit', status: 'sent', phone, whatsapp_sent_at: new Date().toISOString() })
    setPayReqs(prev => [...prev, { id: Date.now().toString(), apartment_id: aptId, month: curMonth, amount, method: 'bit', status: 'sent', phone, created_at: new Date().toISOString() }])
    showToast('WhatsApp נפתח לשליחה ✓')
  }

  async function markAllPaid() {
    for (const { apt, paid } of monthPmts) {
      if (!paid) await markPaid(apt.id, 'bank', 'אוטומטי')
    }
    showToast('כל הדירות סומנו ✓')
  }

  async function cancelPayment(aptId: string) {
    const p = getPayment(aptId)
    if (!p?.id) return
    await supabase.from('payments').update({ status: 'cancelled', paid_date: null }).eq('id', p.id)
    setPayments(prev => prev.map(x => x.apartment_id === aptId && x.month === curMonth ? { ...x, status: 'cancelled' } : x))
    showToast('תשלום בוטל')
  }

  async function saveSupplier() {
    if (!supForm.name) return showToast('נא להזין שם ספק')
    const payload = { name: supForm.name, category: supForm.category, phone: supForm.phone || null, email: supForm.email || null, reason: supForm.reason || null, contract_start: supForm.contract_start || null, payment_terms: supForm.payment_terms || null, contact_name: supForm.contact_name || null, is_active: true }
    if (editSup) {
      const { data } = await supabase.from('suppliers').update(payload).eq('id', editSup.id).select().single()
      if (data) setSuppliers(prev => prev.map(s => s.id === editSup.id ? data : s))
      showToast('ספק עודכן ✓')
    } else {
      const { data } = await supabase.from('suppliers').insert(payload).select().single()
      if (data) setSuppliers(prev => [...prev, data])
      showToast('ספק נוסף ✓')
    }
    setModal(null); setEditSup(null)
    setSupForm({ name: '', category: 'ניקיון', phone: '', email: '', reason: '', contract_start: '', payment_terms: '', contact_name: '' })
  }

  async function addInvoice() {
    if (!invForm.supplierId || !invForm.amount) return showToast('נא למלא שדות חובה')
    const { data } = await supabase.from('invoices').insert({ supplier_id: invForm.supplierId, description: invForm.description, amount: parseFloat(invForm.amount), invoice_date: invForm.invoiceDate, status: invForm.status }).select('*, suppliers(name,category)').single()
    if (data) setInvoices(prev => [data, ...prev])
    setModal(null); showToast('חשבונית נוספה ✓')
  }

  async function payInvoice(id: string) {
    await supabase.from('invoices').update({ status: 'paid', paid_date: new Date().toISOString().slice(0,10) }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' } : i))
    showToast('שולם ✓')
  }

  async function addIssue() {
    if (!issForm.title) return showToast('נא להזין תיאור')
    const { data } = await supabase.from('issues').insert({ title: issForm.title, apartment_id: issForm.aptId || null, category: issForm.category, priority: issForm.priority, supplier_id: issForm.supplierId || null, reported_by: profile.id, status: 'open' }).select('*, suppliers(name)').single()
    if (data) setIssues(prev => [data, ...prev])
    setModal(null); showToast('תקלה נפתחה ✓')
  }

  async function advanceIssue(id: string, current: string) {
    const next: Record<string, string> = { open: 'inprogress', inprogress: 'done', done: 'open' }
    await supabase.from('issues').update({ status: next[current] || 'open' }).eq('id', id)
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status: next[current] } : i))
    showToast('סטטוס עודכן')
  }

  async function saveBudgetActuals() {
    for (const [id, val] of Object.entries(budgetActual)) {
      await supabase.from('budget_items').update({ actual_amount: parseFloat(val) || 0 }).eq('id', id)
    }
    const { data } = await supabase.from('budget_items').select('*').order('sort_order')
    if (data) setBudget(data)
    showToast('ביצוע עודכן ✓')
  }

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  function exportCSV() {
    const rows = [['דירה','מ"ר','חניות','דמי ועד','חניה','סה"כ','שולם','שיטה','תאריך']]
    apartments.forEach(a => {
      const p = getPayment(a.id)
      rows.push([aptLabel(a.id), String(a.sqm), String(a.parking_spots), String(calcVaad(a.sqm)), String(calcParking(a.parking_spots)), String(calcTotal(a.sqm, a.parking_spots)), p?.status === 'confirmed' ? 'כן' : 'לא', p?.method || '', p?.paid_date || ''])
    })
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `mgdal1_${curMonth}.csv`; a.click()
    showToast('CSV יוצא ✓')
  }

  const navItems = [
    { id: 'dash', label: 'לוח בקרה', adminOnly: true },
    { id: 'vaad', label: 'גבייה', adminOnly: true },
    { id: 'payments', label: 'תשלומים', adminOnly: false },
    { id: 'budget', label: 'תקציב', adminOnly: false },
    { id: 'suppliers', label: 'ספקים', adminOnly: false },
    { id: 'issues', label: 'תקלות', adminOnly: false },
    { id: 'users', label: 'משתמשים', adminOnly: true },
  ]

  const filteredIssues = issues.filter(i => {
    if (issFilter !== 'all' && i.status !== issFilter) return false
    if (issSearch && !i.title.toLowerCase().includes(issSearch.toLowerCase())) return false
    if (role === 'resident' && profile.apartment_id && i.apartment_id !== profile.apartment_id && i.apartment_id !== null) return false
    return true
  }).sort((a, b) => { const o: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }; return o[a.priority] - o[b.priority] })

  const budgetTotal = budget.reduce((s, b) => s + b.monthly_amount, 0)
  const actualTotal = budget.reduce((s, b) => s + (b.actual_amount || 0), 0)

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 12 }}><label style={S.label}>{label}</label>{children}</div>
  )
  const Row2 = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  )

  const Modal = ({ id, title, onSave, wide, children }: { id: string; title: string; onSave: () => void; wide?: boolean; children: React.ReactNode }) => (
    modal === id ? (
      <div onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(44,33,24,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', width: wide ? 600 : 480, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', direction: 'rtl' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: COLORS.text, marginBottom: '1.25rem' }}>{title}</h3>
          {children}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button style={S.btn()} onClick={() => setModal(null)}>ביטול</button>
            <button style={S.btn('primary')} onClick={onSave}>שמור</button>
          </div>
        </div>
      </div>
    ) : null
  )

  return (
    <div style={S.app}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" fill="white"/><rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" opacity="0.6"/><rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" opacity="0.6"/><rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" opacity="0.4"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>מגדל 1 תל אביב</div>
            <div style={{ fontSize: 11, color: COLORS.text3 }}>ועד בית · עידן ש.נ.י.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={curMonth} onChange={e => setCurMonth(e.target.value)} style={{ fontFamily: 'inherit', fontSize: 13, padding: '6px 12px', border: `1px solid ${COLORS.warm}`, borderRadius: 8, background: COLORS.cream, color: COLORS.text, cursor: 'pointer' }}>
            {['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06'].map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button style={S.btn('teal')} onClick={exportCSV}>CSV ↓</button>
          <button style={S.btn()} onClick={logout}>יציאה</button>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: COLORS.coral, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {profile.full_name?.slice(0,2) || 'לד'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* SIDEBAR */}
        <div style={S.sidebar}>
          <div style={{ padding: '0 1rem', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.text3, letterSpacing: '0.08em', padding: '8px 4px 4px', textTransform: 'uppercase' }}>ניהול</div>
          </div>
          {navItems.filter(n => !n.adminOnly || isManager).map(n => (
            <div key={n.id} onClick={() => setTab(n.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 1.25rem', cursor: 'pointer', fontSize: 13, fontWeight: tab === n.id ? 700 : 500, color: tab === n.id ? COLORS.teal : COLORS.text2, background: tab === n.id ? COLORS.tealLight : 'transparent', borderRight: tab === n.id ? `3px solid ${COLORS.teal}` : '3px solid transparent', marginBottom: 2 }}>
              {n.label}
            </div>
          ))}
          <div style={{ margin: '1rem', borderTop: `1px solid ${COLORS.warm}`, paddingTop: '1rem' }}>
            <div style={{ fontSize: 11, color: COLORS.text3, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600, color: COLORS.text2, marginBottom: 4 }}>{profile.full_name}</div>
              <div>{ROLE_LABELS[role]}</div>
              <div style={{ fontSize: 10, marginTop: 2 }}>{profile.email}</div>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={S.main}>

          {/* ═══ DASHBOARD ═══ */}
          {tab === 'dash' && isManager && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: '1.25rem' }}>
                {[
                  { label: 'נגבה ' + monthLabel(curMonth), value: `₪${collectedMonth.toLocaleString()}`, sub: `${paidCount}/${apartments.length} יחידות`, color: '#1D9E75', bg: '#E6F7F1' },
                  { label: 'ממתין לגבייה', value: `₪${(totalMonth - collectedMonth).toLocaleString()}`, sub: `${apartments.length - paidCount} יחידות`, color: COLORS.amber, bg: COLORS.amberLight },
                  { label: 'חשבוניות פתוחות', value: `₪${Math.round(pendingInv).toLocaleString()}`, sub: `${invoices.filter(i => i.status === 'pending').length} ספקים`, color: COLORS.coral, bg: COLORS.coralLight },
                  { label: 'תקלות פתוחות', value: String(openIssues), sub: `מתוך ${issues.length}`, color: openIssues > 3 ? COLORS.coral : COLORS.amber, bg: COLORS.amberLight },
                ].map(m => (
                  <div key={m.label} style={S.metric}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, marginBottom: 10 }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text3, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: COLORS.text3, marginTop: 3 }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div><div style={{ fontSize: 15, fontWeight: 700 }}>סטטוס גבייה</div><div style={{ fontSize: 12, color: COLORS.text3 }}>{monthLabel(curMonth)}</div></div>
                    <button style={S.btn('primary')} onClick={() => setTab('vaad')}>לדף גבייה ←</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {monthPmts.map(({ apt, paid }) => (
                      <div key={apt.id} onClick={() => { setPayForm(f => ({ ...f, apt: apt.id })); setModal('pay-modal') }}
                        style={{ background: paid ? '#E6F7F1' : COLORS.amberLight, border: `1.5px solid ${paid ? '#1D9E75' : COLORS.amber}`, borderRadius: 10, padding: '8px 4px', textAlign: 'center', cursor: 'pointer' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{apt.id}</div>
                        <div style={{ fontSize: 9, color: paid ? '#0F6E56' : '#854F0B', fontWeight: 700, marginTop: 2 }}>{paid ? 'שולם' : 'ממתין'}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.cream2}` }}>
                    <span style={{ fontSize: 12, color: COLORS.text3 }}>{paidCount}/{apartments.length} יחידות · ₪{collectedMonth.toLocaleString()}</span>
                    <div style={{ height: 5, width: 100, background: COLORS.cream2, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(paidCount/apartments.length*100)}%`, background: COLORS.teal, borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: '1rem' }}>תקלות פתוחות</div>
                  {issues.filter(i => i.status !== 'done').slice(0, 5).length === 0
                    ? <p style={{ color: COLORS.text3, fontSize: 13, textAlign: 'center', padding: '1.5rem 0' }}>אין תקלות פתוחות</p>
                    : issues.filter(i => i.status !== 'done').slice(0, 5).map(i => (
                      <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${COLORS.cream2}` }}>
                        <div style={{ fontSize: 13 }}>{i.apartment_id ? aptLabel(i.apartment_id) : 'שטח משותף'} — {i.title.slice(0, 28)}</div>
                        {statusBadge(i.status)}
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          )}

          {/* ═══ VAAD ═══ */}
          {tab === 'vaad' && isManager && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>גבייה — {monthLabel(curMonth)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={S.btn('sm')} onClick={() => setModal('bit-modal')}>שלח Bit לכולם</button>
                  <button style={S.btn('primary')} onClick={markAllPaid}>✓ סמן הכל כשולם</button>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>
                  {['דירה','מ"ר','דמי ועד','חניה','סה"כ','סטטוס','שיטה','תאריך',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {monthPmts.map(({ apt, paid, payment }) => (
                    <tr key={apt.id}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{aptLabel(apt.id)}</td>
                      <td style={{ ...S.td, color: COLORS.text3 }}>{apt.sqm}</td>
                      <td style={S.td}>₪{calcVaad(apt.sqm).toLocaleString()}</td>
                      <td style={S.td}>{apt.parking_spots ? `₪${calcParking(apt.parking_spots).toLocaleString()}` : '-'}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>₪{calcTotal(apt.sqm, apt.parking_spots).toLocaleString()}</td>
                      <td style={S.td}>{statusBadge(paid ? 'confirmed' : 'pending')}</td>
                      <td style={{ ...S.td, fontSize: 12, color: COLORS.text3 }}>{payment?.method || '-'}</td>
                      <td style={{ ...S.td, fontSize: 12, color: COLORS.text3 }}>{payment?.paid_date || '-'}</td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!paid && <button style={S.btn('primary')} onClick={() => { setPayForm(f => ({ ...f, apt: apt.id })); setModal('pay-modal') }}>רשום</button>}
                          {!paid && <button style={{ ...S.btn('sm'), background: '#E6F7F1', color: '#0F6E56', border: 'none', fontSize: 11 }} onClick={() => { setPayForm(f => ({ ...f, apt: apt.id, phone: apt.owner_phone || '' })); setModal('bit-send-modal') }}>Bit</button>}
                          {paid && <button style={S.btn('sm')} onClick={() => cancelPayment(apt.id)}>בטל</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.cream2}` }}>
                <span style={{ fontSize: 12, color: COLORS.text3 }}>שולם: {paidCount}/{apartments.length} · ₪{collectedMonth.toLocaleString()} / ₪{totalMonth.toLocaleString()}</span>
                <div style={{ height: 5, width: 140, background: COLORS.cream2, borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(paidCount/apartments.length*100)}%`, background: COLORS.teal, borderRadius: 99 }} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ PAYMENTS TAB ═══ */}
          {tab === 'payments' && (
            <>
              <div style={S.card}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: '1rem' }}>אפשרויות תשלום</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
                  {[
                    { icon: '📲', title: 'Bit / פייבוקס', desc: 'שליחת לינק תשלום ב-WhatsApp', action: () => setModal('bit-send-modal'), color: COLORS.teal },
                    { icon: '🏦', title: 'הוראת קבע', desc: 'רישום פרטי בנק — סיום בסניף', action: () => setModal('bank-modal'), color: COLORS.amber },
                    { icon: '✍️', title: 'מעקב ידני', desc: 'מנהל מסמן תשלום שהתקבל', action: () => setModal('pay-modal'), color: '#888' },
                  ].map(opt => (
                    <div key={opt.title} onClick={opt.action} style={{ border: `1.5px solid ${COLORS.warm}`, borderRadius: 14, padding: '1.25rem', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{opt.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: opt.color, marginBottom: 4 }}>{opt.title}</div>
                      <div style={{ fontSize: 12, color: COLORS.text3 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: '1rem' }}>בקשות תשלום שנשלחו</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>{['תאריך','דירה','שיטה','סכום','סטטוס'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {payReqs.filter(r => r.month === curMonth).map(r => (
                      <tr key={r.id}>
                        <td style={{ ...S.td, color: COLORS.text3, fontSize: 12 }}>{r.created_at?.slice(0,10)}</td>
                        <td style={S.td}>{aptLabel(r.apartment_id)}</td>
                        <td style={S.td}>{r.method === 'bit' ? 'Bit / פייבוקס' : r.method}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>₪{r.amount?.toLocaleString()}</td>
                        <td style={S.td}>{statusBadge(r.status)}</td>
                      </tr>
                    ))}
                    {payReqs.filter(r => r.month === curMonth).length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: COLORS.text3 }}>אין בקשות תשלום לחודש זה</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ═══ BUDGET ═══ */}
          {tab === 'budget' && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>תקציב — תכנון מול ביצוע</div>
                {isManager && <button style={S.btn('primary')} onClick={saveBudgetActuals}>שמור ביצוע</button>}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>
                  {['סעיף','תכנון','ביצוע בפועל','הפרש','% ביצוע','הערות'].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {budget.map(b => {
                    const actual = parseFloat(budgetActual[b.id] ?? String(b.actual_amount ?? 0)) || 0
                    const diff = b.monthly_amount - actual
                    const pct = b.monthly_amount > 0 ? Math.round(actual / b.monthly_amount * 100) : 0
                    return (
                      <tr key={b.id}>
                        <td style={S.td}>{b.name}</td>
                        <td style={{ ...S.td, fontWeight: 600, color: COLORS.teal }}>₪{Math.round(b.monthly_amount).toLocaleString()}</td>
                        <td style={S.td}>
                          {isManager
                            ? <input type="number" value={budgetActual[b.id] ?? String(b.actual_amount ?? '')} onChange={e => setBudgetActual(prev => ({ ...prev, [b.id]: e.target.value }))} style={{ ...S.input, width: 90, padding: '4px 8px', fontSize: 12 }} placeholder="0" />
                            : <span style={{ fontWeight: 600 }}>₪{Math.round(actual).toLocaleString()}</span>
                          }
                        </td>
                        <td style={{ ...S.td, fontWeight: 600, color: diff >= 0 ? '#0F6E56' : COLORS.coral }}>{diff >= 0 ? '+' : ''}₪{Math.round(diff).toLocaleString()}</td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ height: 5, width: 60, background: COLORS.cream2, borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 100 ? COLORS.coral : COLORS.teal, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 11, color: pct > 100 ? COLORS.coral : COLORS.text3 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ ...S.td, fontSize: 11, color: COLORS.text3 }}>{b.notes || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 700, padding: '10px 10px', borderTop: `2px solid ${COLORS.cream2}` }}>סה"כ</td>
                    <td style={{ fontWeight: 700, padding: '10px 10px', borderTop: `2px solid ${COLORS.cream2}`, color: COLORS.teal }}>₪{Math.round(budgetTotal).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, padding: '10px 10px', borderTop: `2px solid ${COLORS.cream2}` }}>₪{Math.round(actualTotal).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, padding: '10px 10px', borderTop: `2px solid ${COLORS.cream2}`, color: (budgetTotal - actualTotal) >= 0 ? '#0F6E56' : COLORS.coral }}>
                      {(budgetTotal - actualTotal) >= 0 ? '+' : ''}₪{Math.round(budgetTotal - actualTotal).toLocaleString()}
                    </td>
                    <td colSpan={2} style={{ padding: '10px 10px', borderTop: `2px solid ${COLORS.cream2}`, fontSize: 12, color: COLORS.text3 }}>
                      {budgetTotal > 0 ? Math.round(actualTotal / budgetTotal * 100) : 0}% בוצע
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ═══ SUPPLIERS ═══ */}
          {tab === 'suppliers' && (
            <>
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>ספקים</div>
                  {isManager && <button style={S.btn('primary')} onClick={() => { setEditSup(null); setSupForm({ name: '', category: 'ניקיון', phone: '', email: '', reason: '', contract_start: '', payment_terms: '', contact_name: '' }); setModal('sup-modal') }}>+ ספק חדש</button>}
                </div>
                {suppliers.map(s => (
                  <div key={s.id} style={{ border: `1px solid ${COLORS.warm}`, borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{s.name}</div>
                        <div style={{ marginTop: 4 }}>{badge('blue', s.category)}</div>
                      </div>
                      {isManager && <button style={S.btn('sm')} onClick={() => { setEditSup(s); setSupForm({ name: s.name, category: s.category, phone: s.phone || '', email: s.email || '', reason: s.reason || '', contract_start: s.contract_start || '', payment_terms: s.payment_terms || '', contact_name: s.contact_name || '' }); setModal('sup-modal') }}>ערוך</button>}
                    </div>
                    {s.reason && <div style={{ marginTop: 10, padding: '8px 12px', background: COLORS.tealLight, borderRadius: 8, fontSize: 13, color: COLORS.teal }}><span style={{ fontWeight: 600 }}>סיבת בחירה: </span>{s.reason}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                      {s.contact_name && <div style={{ fontSize: 12 }}><span style={{ color: COLORS.text3, fontWeight: 600 }}>איש קשר: </span>{s.contact_name}</div>}
                      {s.phone && <div style={{ fontSize: 12 }}><span style={{ color: COLORS.text3, fontWeight: 600 }}>טלפון: </span>{s.phone}</div>}
                      {s.payment_terms && <div style={{ fontSize: 12 }}><span style={{ color: COLORS.text3, fontWeight: 600 }}>תנאי תשלום: </span>{s.payment_terms}</div>}
                      {s.contract_start && <div style={{ fontSize: 12 }}><span style={{ color: COLORS.text3, fontWeight: 600 }}>תחילת חוזה: </span>{s.contract_start}</div>}
                      {s.contract_end && <div style={{ fontSize: 12 }}><span style={{ color: COLORS.text3, fontWeight: 600 }}>סיום חוזה: </span>{s.contract_end}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {isManager && (
                <div style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>חשבוניות</div>
                    <button style={S.btn('primary')} onClick={() => setModal('inv-modal')}>+ חשבונית</button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>{['תאריך','ספק','תיאור','סכום','סטטוס',''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {[...invoices].sort((a,b) => b.invoice_date.localeCompare(a.invoice_date)).map(inv => (
                        <tr key={inv.id}>
                          <td style={{ ...S.td, color: COLORS.text3, fontSize: 12 }}>{inv.invoice_date}</td>
                          <td style={{ ...S.td, fontWeight: 500 }}>{inv.suppliers?.name || '-'}</td>
                          <td style={S.td}>{inv.description}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>₪{inv.amount.toLocaleString()}</td>
                          <td style={S.td}>{statusBadge(inv.status)}</td>
                          <td style={S.td}>{inv.status === 'pending' && <button style={S.btn('primary')} onClick={() => payInvoice(inv.id)}>שלם</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ═══ ISSUES ═══ */}
          {tab === 'issues' && perms.manageIssues && (
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>תקלות ופניות</div>
                <button style={S.btn('primary')} onClick={() => setModal('iss-modal')}>+ תקלה חדשה</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                <input type="text" placeholder="חיפוש תקלות..." value={issSearch} onChange={e => setIssSearch(e.target.value)} style={{ ...S.input, flex: 1 }} />
                <select value={issFilter} onChange={e => setIssFilter(e.target.value)} style={{ ...S.input, width: 'auto' }}>
                  <option value="all">הכל</option><option value="open">פתוח</option><option value="inprogress">בטיפול</option><option value="done">נסגר</option>
                </select>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['דירה','תיאור','קטגוריה','עדיפות','תאריך','סטטוס',''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredIssues.map(i => (
                    <tr key={i.id}>
                      <td style={S.td}>{i.apartment_id ? aptLabel(i.apartment_id) : 'שטח משותף'}</td>
                      <td style={S.td}>{i.title}</td>
                      <td style={S.td}>{badge('blue', i.category)}</td>
                      <td style={S.td}>{prioBadge(i.priority)}</td>
                      <td style={{ ...S.td, fontSize: 11, color: COLORS.text3 }}>{i.created_at?.slice(0,10)}</td>
                      <td style={S.td}>{statusBadge(i.status)}</td>
                      <td style={S.td}>
                        <button style={S.btn('sm')} onClick={() => advanceIssue(i.id, i.status)}>
                          {{ open: 'התחל', inprogress: 'סגור', done: 'פתח' }[i.status] || 'עדכן'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredIssues.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: COLORS.text3 }}>אין תקלות</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ USERS ═══ */}
          {tab === 'users' && isManager && (
            <div style={S.card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: '1rem' }}>משתמשים וגישה</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['שם','אימייל','תפקיד','דירה'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {profiles.map(p => (
                    <tr key={p.id}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{p.full_name}</td>
                      <td style={{ ...S.td, fontSize: 12, color: COLORS.text3 }}>{p.email}</td>
                      <td style={S.td}>{badge('blue', ROLE_LABELS[p.role] || p.role)}</td>
                      <td style={{ ...S.td, color: COLORS.text3 }}>{p.apartment_id ? aptLabel(p.apartment_id) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '1rem', padding: '1rem', background: COLORS.tealLight, borderRadius: 10, fontSize: 12, color: COLORS.teal }}>
                להוסיף משתמשים: Supabase → Authentication → Users → Invite user, ואז עדכן role בטבלת profiles.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      <Modal id="pay-modal" title="רישום תשלום" onSave={async () => { await markPaid(payForm.apt, payForm.method, payForm.reference); setModal(null) }}>
        <Row2>
          <Field label="דירה"><select value={payForm.apt} onChange={e => setPayForm(f => ({ ...f, apt: e.target.value }))} style={S.input}>{apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>)}</select></Field>
          <Field label="שיטה"><select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))} style={S.input}>{PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
        </Row2>
        <Field label="אסמכתא"><input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} style={S.input} placeholder="מס' אישור..." /></Field>
      </Modal>

      <Modal id="bit-send-modal" title="שליחת Bit / פייבוקס ב-WhatsApp" onSave={() => { sendBitRequest(payForm.apt, payForm.phone); setModal(null) }}>
        <div style={{ padding: '10px 14px', background: '#E6F7F1', borderRadius: 10, marginBottom: 12, fontSize: 13, color: '#0F6E56' }}>
          לחיצה על "שמור" תפתח WhatsApp עם הודעה מוכנה עם לינק תשלום ← הדייר ישלם ישירות.
        </div>
        <Row2>
          <Field label="דירה"><select value={payForm.apt} onChange={e => setPayForm(f => ({ ...f, apt: e.target.value }))} style={S.input}>{apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>)}</select></Field>
          <Field label="טלפון דייר"><input value={payForm.phone} onChange={e => setPayForm(f => ({ ...f, phone: e.target.value }))} style={S.input} placeholder="050-..." /></Field>
        </Row2>
        <div style={{ padding: '10px 14px', background: COLORS.cream2, borderRadius: 10, fontSize: 12, color: COLORS.text3 }}>
          הסכום שיישלח: ₪{apartments.find(a => a.id === payForm.apt) ? calcTotal(apartments.find(a => a.id === payForm.apt)!.sqm, apartments.find(a => a.id === payForm.apt)!.parking_spots).toLocaleString() : '—'}
        </div>
      </Modal>

      <Modal id="bank-modal" title="רישום הוראת קבע" onSave={() => { showToast('הוראת קבע נרשמה — יש להגיש בסניף'); setModal(null) }}>
        <div style={{ padding: '10px 14px', background: COLORS.amberLight, borderRadius: 10, marginBottom: 12, fontSize: 13, color: '#854F0B' }}>
          הדייר ממלא פרטים כאן, מדפיס ומגיש בסניף הבנק.
        </div>
        <Row2>
          <Field label="דירה"><select value={payForm.apt} onChange={e => setPayForm(f => ({ ...f, apt: e.target.value }))} style={S.input}>{apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>)}</select></Field>
          <Field label="בנק"><select style={S.input}>{['הפועלים','לאומי','דיסקונט','מזרחי-טפחות','ירושלים','אחר'].map(b => <option key={b}>{b}</option>)}</select></Field>
        </Row2>
        <Row2>
          <Field label="סניף"><input style={S.input} placeholder="000" /></Field>
          <Field label="חשבון"><input style={S.input} placeholder="000000" /></Field>
        </Row2>
        <Field label="שם בעל החשבון"><input style={S.input} /></Field>
      </Modal>

      <Modal id="sup-modal" title={editSup ? 'עריכת ספק' : 'ספק חדש'} onSave={saveSupplier} wide>
        <Row2>
          <Field label="שם ספק"><input value={supForm.name} onChange={e => setSupForm(f => ({ ...f, name: e.target.value }))} style={S.input} /></Field>
          <Field label="קטגוריה"><select value={supForm.category} onChange={e => setSupForm(f => ({ ...f, category: e.target.value }))} style={S.input}>{['ניקיון','מעלית','גנרטור','חשמל','שרברבות','חניון','גילוי אש','אחר'].map(c => <option key={c}>{c}</option>)}</select></Field>
        </Row2>
        <Field label="סיבת בחירה / נימוק"><input value={supForm.reason} onChange={e => setSupForm(f => ({ ...f, reason: e.target.value }))} style={S.input} placeholder="למה נבחר הספק הזה..." /></Field>
        <Row2>
          <Field label="איש קשר"><input value={supForm.contact_name} onChange={e => setSupForm(f => ({ ...f, contact_name: e.target.value }))} style={S.input} /></Field>
          <Field label="טלפון"><input value={supForm.phone} onChange={e => setSupForm(f => ({ ...f, phone: e.target.value }))} style={S.input} /></Field>
        </Row2>
        <Row2>
          <Field label="תנאי תשלום"><input value={supForm.payment_terms} onChange={e => setSupForm(f => ({ ...f, payment_terms: e.target.value }))} style={S.input} placeholder="30 יום / חודשי..." /></Field>
          <Field label="תחילת חוזה"><input type="date" value={supForm.contract_start} onChange={e => setSupForm(f => ({ ...f, contract_start: e.target.value }))} style={S.input} /></Field>
        </Row2>
      </Modal>

      <Modal id="inv-modal" title="חשבונית חדשה" onSave={addInvoice}>
        <Row2>
          <Field label="ספק"><select value={invForm.supplierId} onChange={e => setInvForm(f => ({ ...f, supplierId: e.target.value }))} style={S.input}><option value="">בחר ספק...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="תאריך"><input type="date" value={invForm.invoiceDate} onChange={e => setInvForm(f => ({ ...f, invoiceDate: e.target.value }))} style={S.input} /></Field>
        </Row2>
        <Row2>
          <Field label="תיאור"><input value={invForm.description} onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))} style={S.input} /></Field>
          <Field label="סכום ₪"><input type="number" value={invForm.amount} onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} style={S.input} /></Field>
        </Row2>
        <Field label="סטטוס"><select value={invForm.status} onChange={e => setInvForm(f => ({ ...f, status: e.target.value }))} style={S.input}><option value="pending">ממתין</option><option value="paid">שולם</option></select></Field>
      </Modal>

      <Modal id="iss-modal" title="תקלה חדשה" onSave={addIssue}>
        <Row2>
          <Field label="דירה"><select value={issForm.aptId} onChange={e => setIssForm(f => ({ ...f, aptId: e.target.value }))} style={S.input}><option value="">שטח משותף</option>{apartments.map(a => <option key={a.id} value={a.id}>{aptLabel(a.id)}</option>)}</select></Field>
          <Field label="קטגוריה"><select value={issForm.category} onChange={e => setIssForm(f => ({ ...f, category: e.target.value }))} style={S.input}>{['שרברבות','חשמל','ניקיון','מעלית','גנרטור','חניון','אחר'].map(c => <option key={c}>{c}</option>)}</select></Field>
        </Row2>
        <Field label="תיאור התקלה"><input value={issForm.title} onChange={e => setIssForm(f => ({ ...f, title: e.target.value }))} style={S.input} placeholder="תאר את הבעיה..." /></Field>
        <Row2>
          <Field label="עדיפות"><select value={issForm.priority} onChange={e => setIssForm(f => ({ ...f, priority: e.target.value }))} style={S.input}><option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="urgent">דחוף</option></select></Field>
          <Field label="ספק מטפל"><select value={issForm.supplierId} onChange={e => setIssForm(f => ({ ...f, supplierId: e.target.value }))} style={S.input}><option value="">— ללא —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        </Row2>
      </Modal>

      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: COLORS.text, color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 300, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>{toast}</div>}
    </div>
  )
}
