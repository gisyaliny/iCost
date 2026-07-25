import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AnalysisCharts } from "@/components/DashboardComponents"
import { projectView, settingsView, transactionView } from "@/lib/finance-view"

export default async function AnalysisPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const transactionRows = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    include: { category: true, property: true, project: true, account: true },
    orderBy: { date: 'desc' }
  })
  
  const categories = await prisma.category.findMany()
  const properties = await prisma.property.findMany({
      where: { userId: session.user.id, isArchived: false }
  })
  const transactions = transactionRows.map(transactionView)
  const projectRows = await prisma.project.findMany({
      where: { userId: session.user.id, isArchived: false },
      orderBy: { createdAt: 'desc' }
  })
  const projects = projectRows.map(projectView)
  const userSettingsRow = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { monthlyBudgetCents: true, currency: true, locale: true, timezone: true }
  })
  const userSettings = userSettingsRow ? settingsView(userSettingsRow) : null

  return (
    <div className="mx-auto mt-3 max-w-7xl space-y-4 px-3 pb-28 sm:mt-8 sm:space-y-8 sm:px-4 sm:pb-20">
      <div>
           <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Analysis & Statistics</h1>
           <p className="mt-0.5 text-sm text-slate-500 sm:mt-1 sm:text-base">Visualize your expenses and income trends.</p>
      </div>
      
      <AnalysisCharts transactions={transactions} categories={categories} properties={properties} projects={projects} settings={userSettings} />
    </div>
  )
}
