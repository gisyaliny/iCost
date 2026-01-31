import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { TransactionDashboard, AddTransactionButton, ManageCategories, CSVImport, ManageProperties, UserSettings } from "@/components/DashboardComponents"

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    include: { category: true, property: true },
    orderBy: { date: 'desc' }
  })

  const totalTransactionsCount = await prisma.transaction.count({
    where: { userId: session.user.id }
  })
  
  const categories = await prisma.category.findMany()
  const properties = await prisma.property.findMany({
    where: { userId: session.user.id }
  })

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 mt-8 px-4">
      <div className="flex md:flex-row flex-col justify-between md:items-center gap-4">
          <div>
               <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
               <p className="text-slate-500 mt-1">Welcome back, {session.user.name}!</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <CSVImport existingTransactions={transactions} />
            <AddTransactionButton categories={categories} properties={properties} transactions={transactions} />
          </div>
      </div>
      
      <TransactionDashboard 
        transactions={transactions} 
        categories={categories} 
        totalCount={totalTransactionsCount}
      />
    </div>
  )
}
