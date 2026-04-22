import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const [
    { data: apartments },
    { data: payments },
    { data: suppliers },
    { data: invoices },
    { data: issues },
    { data: budgetItems },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('apartments').select('*').order('id'),
    supabase.from('payments').select('*').order('month', { ascending: false }),
    supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
    supabase.from('invoices').select('*, suppliers(name,category)').order('invoice_date', { ascending: false }),
    supabase.from('issues').select('*, suppliers(name)').order('created_at', { ascending: false }),
    supabase.from('budget_items').select('*').order('sort_order'),
    supabase.from('profiles').select('*').order('full_name'),
  ])

  return (
    <DashboardClient
      profile={profile}
      apartments={apartments || []}
      payments={payments || []}
      suppliers={suppliers || []}
      invoices={invoices || []}
      issues={issues || []}
      budgetItems={budgetItems || []}
      profiles={profiles || []}
    />
  )
}
