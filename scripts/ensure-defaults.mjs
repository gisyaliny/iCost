import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()
const defaultCategories = [
  { name: "Food", icon: "🛒", type: "EXPENSE", color: "bg-orange-100 text-orange-600" },
  { name: "Dining", icon: "🍽️", type: "EXPENSE", color: "bg-orange-200 text-orange-700" },
  { name: "Shopping", icon: "🛍️", type: "EXPENSE", color: "bg-pink-100 text-pink-600" },
  { name: "Housing", icon: "🏠", type: "EXPENSE", color: "bg-indigo-100 text-indigo-600" },
  { name: "Utilities", icon: "💡", type: "EXPENSE", color: "bg-yellow-100 text-yellow-600" },
  { name: "Transport", icon: "🚗", type: "EXPENSE", color: "bg-blue-100 text-blue-600" },
  { name: "Health", icon: "💊", type: "EXPENSE", color: "bg-red-100 text-red-600" },
  { name: "Entertainment", icon: "🎬", type: "EXPENSE", color: "bg-purple-100 text-purple-600" },
  { name: "Travel", icon: "✈️", type: "EXPENSE", color: "bg-sky-100 text-sky-600" },
  { name: "Education", icon: "🎓", type: "EXPENSE", color: "bg-teal-100 text-teal-600" },
  { name: "Kids", icon: "🧸", type: "EXPENSE", color: "bg-rose-100 text-rose-600" },
  { name: "Pets", icon: "🐾", type: "EXPENSE", color: "bg-stone-100 text-stone-600" },
  { name: "Services", icon: "🧾", type: "EXPENSE", color: "bg-gray-200 text-gray-700" },
  { name: "Salary", icon: "💰", type: "INCOME", color: "bg-emerald-100 text-emerald-600" },
  { name: "Investment", icon: "📈", type: "INCOME", color: "bg-green-100 text-green-600" },
  { name: "Rental Income", icon: "🔑", type: "INCOME", color: "bg-cyan-100 text-cyan-600" },
  { name: "Other Income", icon: "💵", type: "INCOME", color: "bg-lime-100 text-lime-600" },
  { name: "Uncategorized", icon: "❓", type: "EXPENSE", color: "bg-gray-100 text-gray-600" },
]

try {
  if (await prisma.category.count() === 0) {
    console.log("🌱 Seeding default categories...")
    await prisma.category.createMany({ data: defaultCategories })
  }

  if (await prisma.user.count() === 0) {
    console.log("👤 Creating the initial admin account...")
    await prisma.user.create({
      data: { username: "admin", password: await hash("admin123", 10) },
    })
    console.log("✅ Initial user created: admin / admin123")
  }

  const users = await prisma.user.findMany({ select: { id: true } })
  for (const user of users) {
    const fallback = await prisma.account.upsert({
      where: { userId_name: { userId: user.id, name: "Legacy / Unassigned" } },
      update: {},
      create: { name: "Legacy / Unassigned", type: "OTHER", userId: user.id },
    })
    await prisma.transaction.updateMany({
      where: { userId: user.id, accountId: null },
      data: { accountId: fallback.id },
    })
  }
  console.log("✅ Default data is ready.")
} catch (error) {
  console.error("❌ Default data initialization failed:", error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
