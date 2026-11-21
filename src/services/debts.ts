import { requireSupabase } from '../lib/supabase.ts'
import type { Debt } from '../types/domain.ts'

type DebtRow = {
  id: string
  debtor_id: string
  creditor_id: string
  amount_cents: number
}

export async function fetchDebts(householdId: string): Promise<Debt[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('debts')
    .select('id, debtor_id, creditor_id, amount_cents')
    .eq('household_id', householdId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as DebtRow[]).map((row) => ({
    id: row.id,
    debtorId: row.debtor_id,
    creditorId: row.creditor_id,
    amountCents: row.amount_cents,
  }))
}
