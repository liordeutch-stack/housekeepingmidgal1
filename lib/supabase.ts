import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const TOTAL_SQM = 1086.3
export const MONTHLY_TOTAL = 10914
export const PARKING_COST = 559.5
export const COST_PER_SQM = MONTHLY_TOTAL / TOTAL_SQM

export function calcVaad(sqm: number) { return Math.round(sqm * COST_PER_SQM) }
export function calcParking(spots: number) { return Math.round(spots * PARKING_COST) }
export function calcTotal(sqm: number, spots: number) { return calcVaad(sqm) + calcParking(spots) }

export const ROLE_PERMISSIONS = {
  admin:     { viewAll: true,  editPayments: true, viewBudget: true,  manageSuppliers: true,  manageIssues: true,  manageUsers: true,  viewContract: true },
  committee: { viewAll: true,  editPayments: true, viewBudget: true,  manageSuppliers: true,  manageIssues: true,  manageUsers: false, viewContract: true },
  manager:   { viewAll: false, editPayments: false,viewBudget: false, manageSuppliers: true,  manageIssues: true,  manageUsers: false, viewContract: true },
  resident:  { viewAll: false, editPayments: true, viewBudget: false, manageSuppliers: false, manageIssues: true,  manageUsers: false, viewContract: false },
  readonly:  { viewAll: false, editPayments: false,viewBudget: true,  manageSuppliers: false, manageIssues: false, manageUsers: false, viewContract: false },
} as const

export const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל ראשי', committee: 'נציג ועד', manager: 'חברת ניהול',
  resident: 'דייר', readonly: 'צפייה בלבד'
}

export const PAYMENT_METHODS = [
  { id: 'bank',  label: 'הוראת קבע / מס"ב' },
  { id: 'bit',   label: 'Bit / פייבוקס' },
  { id: 'check', label: 'שיק' },
  { id: 'cash',  label: 'מזומן' },
  { id: 'wire',  label: 'העברה בנקאית' },
  { id: 'cc',    label: 'כרטיס אשראי' },
] as const
