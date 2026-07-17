import test from "node:test"
import assert from "node:assert/strict"
import { accountBalanceCents, cashFlowTotalsCents, projectTotalsCents, transactionFingerprint } from "../src/lib/accounting"
import { fromCents, toCents } from "../src/lib/money"

test("income, expenses, and net cash flow stay exact in cents", () => {
  const totals = cashFlowTotalsCents([
    { amountCents: 10001, type: "INCOME" },
    { amountCents: 1, type: "INCOME" },
    { amountCents: 3334, type: "EXPENSE" },
  ])
  assert.deepEqual(totals, { incomeCents: 10002, expenseCents: 3334, netCents: 6668 })
  assert.equal(fromCents(totals.netCents), 66.68)
})

test("a transfer changes account balances but not combined wealth or cash flow", () => {
  const checkingBefore = accountBalanceCents({ openingBalanceCents: 100000, transactions: [] })
  const savingsBefore = accountBalanceCents({ openingBalanceCents: 50000, transactions: [] })
  const checkingAfter = accountBalanceCents({ openingBalanceCents: 100000, transactions: [], transfersOutCents: [25000] })
  const savingsAfter = accountBalanceCents({ openingBalanceCents: 50000, transactions: [], transfersInCents: [25000] })
  assert.equal(checkingBefore + savingsBefore, checkingAfter + savingsAfter)
  assert.deepEqual(cashFlowTotalsCents([]), { incomeCents: 0, expenseCents: 0, netCents: 0 })
})

test("project net cost subtracts project income from expenses", () => {
  const totals = projectTotalsCents([{ amountCents: 80000, type: "EXPENSE" }, { amountCents: 12500, type: "INCOME" }])
  assert.equal(totals.netCostCents, 67500)
})

test("duplicate fingerprint is stable and cents-based", () => {
  const first = transactionFingerprint({ date: "2026-07-16T01:00:00Z", amountCents: 1099, description: "Coffee", type: "EXPENSE" })
  const second = transactionFingerprint({ date: "2026-07-16T22:00:00Z", amountCents: toCents(10.99), description: "Coffee", type: "EXPENSE" })
  assert.equal(first, second)
})

test("money conversion rounds decimal input once at the boundary", () => {
  assert.equal(toCents(10.005), 1001)
  assert.equal(fromCents(1001), 10.01)
})
