import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CategoryRulesModule } from "@/components/CategoryRulesComponents"

export default async function RulesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/login")
  const [rules, categories] = await Promise.all([
    prisma.categoryRule.findMany({
      where: { userId: session.user.id },
      include: { category: true },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.category.findMany({ where: { isArchived: false }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ])
  const rulesVersion = rules.map(rule => `${rule.id}:${rule.priority}:${rule.isEnabled}:${rule.matchType}:${rule.pattern}:${rule.categoryId}`).join("|")
  return <div className="mx-auto mt-3 max-w-7xl px-3 pb-28 sm:mt-8 sm:px-4 sm:pb-24"><CategoryRulesModule key={rulesVersion} initialRules={rules} categories={categories} /></div>
}
