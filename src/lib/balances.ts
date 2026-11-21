import type { Debt } from '../types/domain.ts'

export function balanceWith(debts: Debt[], userId: string, otherId: string): number {
  return debts.reduce((total, debt) => {
    if (debt.creditorId === userId && debt.debtorId === otherId) return total + debt.amountCents
    if (debt.debtorId === userId && debt.creditorId === otherId) return total - debt.amountCents
    return total
  }, 0)
}

export function balanceLines(debts: Debt[], userId: string): { otherId: string; cents: number }[] {
  const totals = new Map<string, number>()
  for (const debt of debts) {
    if (debt.creditorId === userId) {
      totals.set(debt.debtorId, (totals.get(debt.debtorId) ?? 0) + debt.amountCents)
    } else if (debt.debtorId === userId) {
      totals.set(debt.creditorId, (totals.get(debt.creditorId) ?? 0) - debt.amountCents)
    }
  }
  return [...totals.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([otherId, cents]) => ({ otherId, cents }))
}
