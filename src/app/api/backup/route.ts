import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const [user, transactions, properties, projects, accounts, transfers, categoryBudgets, categoryRules, recurringSchedules, importBatches, importProfiles] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { username: true, createdAt: true, monthlyBudgetCents: true, currency: true, locale: true, timezone: true } }),
    prisma.transaction.findMany({ where: { userId }, include: { category: true }, orderBy: { date: "asc" } }),
    prisma.property.findMany({ where: { userId } }),
    prisma.project.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.transfer.findMany({ where: { userId } }),
    prisma.categoryBudget.findMany({ where: { userId }, include: { category: true } }),
    prisma.categoryRule.findMany({ where: { userId }, include: { category: true } }),
    prisma.recurringSchedule.findMany({ where: { userId }, include: { category: true } }),
    prisma.importBatch.findMany({ where: { userId } }),
    prisma.importProfile.findMany({ where: { userId } }),
  ])

  const exportedAt = new Date()
  const payload = {
    format: "icost-json-backup",
    version: 2,
    moneyUnit: "cents",
    exportedAt: exportedAt.toISOString(),
    user,
    data: { transactions, properties, projects, accounts, transfers, categoryBudgets, categoryRules, recurringSchedules, importBatches, importProfiles },
  }
  const filename = `icost-backup-${exportedAt.toISOString().split("T")[0]}.json`

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  })
}
