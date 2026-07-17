import { fromCents } from "@/lib/money"

export function transactionView<T extends { amountCents: number }>(transaction: T) {
  const { amountCents, ...rest } = transaction
  return { ...rest, amount: fromCents(amountCents) }
}

export function projectView<T extends { budgetCents: number | null }>(project: T) {
  const { budgetCents, ...rest } = project
  return { ...rest, budget: budgetCents === null ? null : fromCents(budgetCents) }
}

export function settingsView<T extends { monthlyBudgetCents: number }>(settings: T) {
  const { monthlyBudgetCents, ...rest } = settings
  return { ...rest, monthlyBudget: fromCents(monthlyBudgetCents) }
}

export function recurringView<T extends { amountCents: number }>(schedule: T) {
  const { amountCents, ...rest } = schedule
  return { ...rest, amount: fromCents(amountCents) }
}
