import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { TransactionDashboard, AddTransactionButton, CSVImport } from "@/components/DashboardComponents"
import { getAccountsWithBalances } from "@/lib/accounts"
import { projectView, settingsView, transactionView } from "@/lib/finance-view"

export default async function Home() {
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
  const accounts = await getAccountsWithBalances(session.user.id)
  const userSettingsRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { monthlyBudgetCents: true, currency: true, locale: true, timezone: true }
  })
  const userSettings = userSettingsRow ? settingsView(userSettingsRow) : null
  const importProfiles = await prisma.importProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" }
  })

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 mt-8 px-4">
      <div className="flex md:flex-row flex-col justify-between md:items-center gap-4">
          <div>
               <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
               <p className="text-slate-500 mt-1">Welcome back, {session.user.name}!</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <CSVImport existingTransactions={transactions} settings={userSettings} importProfiles={importProfiles} categories={categories} />
            <AddTransactionButton categories={categories} properties={properties} projects={projects} accounts={accounts} transactions={transactions} settings={userSettings} />
          </div>
      </div>
      
      <TransactionDashboard 
        transactions={transactions} 
        categories={categories} 
        properties={properties}
        projects={projects}
        accounts={accounts}
        settings={userSettings}
      />
    </div>
  )
}
