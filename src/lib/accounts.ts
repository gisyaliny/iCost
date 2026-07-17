import { prisma } from "@/lib/prisma"
import { fromCents } from "@/lib/money"
import { accountBalanceCents } from "@/lib/accounting"

export async function getAccountsWithBalances(userId: string) {
  const existingCount = await prisma.account.count({ where: { userId } })
  if (existingCount === 0) {
    await prisma.account.create({
      data: { userId, name: "Legacy / Unassigned", type: "OTHER" },
    })
  }

  const accounts = await prisma.account.findMany({
    where: { userId, isArchived: false },
    include: {
      transactions: { where: { reviewed: true }, select: { amountCents: true, type: true } },
      incoming: { select: { amountCents: true } },
      outgoing: { select: { amountCents: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return accounts.map(({ transactions, incoming, outgoing, ...account }) => {
    const balanceCents = accountBalanceCents({
      openingBalanceCents: account.openingBalanceCents,
      transactions,
      transfersInCents: incoming.map(item => item.amountCents),
      transfersOutCents: outgoing.map(item => item.amountCents),
    })
    return {
      ...account,
      openingBalance: fromCents(account.openingBalanceCents),
      balance: fromCents(balanceCents),
    }
  })
}
