export type MoneyEntry = { amountCents: number; type: string }

export function cashFlowTotalsCents(entries: MoneyEntry[]) {
  let incomeCents = 0
  let expenseCents = 0
  for (const entry of entries) {
    if (!Number.isInteger(entry.amountCents)) throw new Error("amountCents must be an integer")
    if (entry.type === "INCOME") incomeCents += entry.amountCents
    else if (entry.type === "EXPENSE") expenseCents += entry.amountCents
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents }
}

export function accountBalanceCents(input: {
  openingBalanceCents: number
  transactions: MoneyEntry[]
  transfersInCents?: number[]
  transfersOutCents?: number[]
}) {
  const totals = cashFlowTotalsCents(input.transactions)
  const transfersIn = (input.transfersInCents || []).reduce((sum, value) => sum + value, 0)
  const transfersOut = (input.transfersOutCents || []).reduce((sum, value) => sum + value, 0)
  return input.openingBalanceCents + totals.netCents + transfersIn - transfersOut
}

export function projectTotalsCents(entries: MoneyEntry[]) {
  const totals = cashFlowTotalsCents(entries)
  return { ...totals, netCostCents: totals.expenseCents - totals.incomeCents }
}

export function transactionFingerprint(entry: { date: Date | string; amountCents: number; description: string | null; type: string }) {
  const date = new Date(entry.date).toISOString().split("T")[0]
  return `${date}-${entry.amountCents}-${entry.description || ""}-${entry.type}`
}
