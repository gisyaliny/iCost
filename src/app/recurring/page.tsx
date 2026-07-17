import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { RecurringModule } from "@/components/RecurringComponents"
import { projectView, recurringView, settingsView } from "@/lib/finance-view"

export default async function RecurringPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")
  const [rows, categories, properties, projectRows, accounts, settingsRow] = await Promise.all([
    prisma.recurringSchedule.findMany({ where: { userId: session.user.id }, include: { category: true, property: true, project: true, account: true }, orderBy: [{ isActive: "desc" }, { nextDate: "asc" }] }),
    prisma.category.findMany({ where: { isArchived: false } }),
    prisma.property.findMany({ where: { userId: session.user.id, isArchived: false } }),
    prisma.project.findMany({ where: { userId: session.user.id, isArchived: false } }),
    prisma.account.findMany({ where: { userId: session.user.id, isArchived: false } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { monthlyBudgetCents: true, currency: true, locale: true, timezone: true } }),
  ])
  return <div className="mx-auto mt-8 max-w-7xl px-4 pb-24"><RecurringModule schedules={rows.map(recurringView)} categories={categories} properties={properties} projects={projectRows.map(projectView)} accounts={accounts} settings={settingsRow ? settingsView(settingsRow) : null} /></div>
}
