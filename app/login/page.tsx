'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f8f6', direction:'rtl', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'#fff', border:'0.5px solid #e0ddd6', borderRadius:12, padding:'2rem', width:360, maxWidth:'95vw' }}>
        <div style={{ marginBottom:'1.5rem' }}>
          <h1 style={{ fontSize:20, fontWeight:500, marginBottom:4 }}>מגדל 1 תל אביב</h1>
          <p style={{ fontSize:13, color:'#888' }}>ניהול נכס — כניסה למערכת</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:'#666', display:'block', marginBottom:4 }}>אימייל</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="your@email.com"
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #ccc', borderRadius:8, fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
            />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:'#666', display:'block', marginBottom:4 }}>סיסמה</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #ccc', borderRadius:8, fontSize:13, fontFamily:'inherit', boxSizing:'border-box' }}
            />
          </div>
          {error && <p style={{ fontSize:12, color:'#D85A30', marginBottom:12 }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            style={{ width:'100%', padding:'9px', background:'#111', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        <p style={{ fontSize:11, color:'#aaa', marginTop:'1.5rem', textAlign:'center' }}>
          ועד בית מגדל 1 · מופעל על ידי עידן ש.נ.י.
        </p>
      </div>
    </div>
  )
}
