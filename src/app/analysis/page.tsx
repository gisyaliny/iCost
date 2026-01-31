import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AnalysisCharts, SummaryCards } from "@/components/DashboardComponents"

export default async function AnalysisPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    include: { category: true, property: true },
    orderBy: { date: 'desc' }
  })
  
  const categories = await prisma.category.findMany()
  const properties = await prisma.property.findMany({
      where: { userId: session.user.id }
  })

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 mt-8 px-4">
      <div>
           <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Analysis & Statistics</h1>
           <p className="text-slate-500 mt-1">Visualize your expenses and income trends.</p>
      </div>
      
      <SummaryCards transactions={transactions} />
      <AnalysisCharts transactions={transactions} categories={categories} properties={properties} />
    </div>
  )
}
