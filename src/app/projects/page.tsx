import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjectsModule } from "@/components/ProjectComponents"
import { projectView, transactionView } from "@/lib/finance-view"

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")

  const [projectRows, settings] = await Promise.all([
    prisma.project.findMany({
      where: { userId: session.user.id, isArchived: false },
      include: { transactions: { include: { category: true, account: true }, orderBy: { date: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currency: true, locale: true },
    }),
  ])
  const projects = projectRows.map(project => projectView({
    ...project,
    transactions: project.transactions.map(transactionView),
  }))

  return <div className="mx-auto mt-8 max-w-7xl px-4 pb-20"><ProjectsModule projects={projects} settings={settings} /></div>
}
