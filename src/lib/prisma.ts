import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prismaClient = new PrismaClient()

// Auto-seed function
async function ensureDefaultCategories(client: PrismaClient) {
    const count = await client.category.count()
    if (count === 0) {
        console.log('🌱 No categories found. Seeding defaults...')
        const defaults = [
            { name: 'Food', icon: '🍔', type: 'EXPENSE', color: 'bg-orange-100 text-orange-600' },
            { name: 'Shopping', icon: '🛍️', type: 'EXPENSE', color: 'bg-pink-100 text-pink-600' },
            { name: 'Daily', icon: '🧴', type: 'EXPENSE', color: 'bg-blue-100 text-blue-600' },
            { name: 'Transport', icon: '🚌', type: 'EXPENSE', color: 'bg-indigo-100 text-indigo-600' },
            { name: 'Salary', icon: '💰', type: 'INCOME', color: 'bg-green-100 text-green-600' },
            { name: 'Investment', icon: '📈', type: 'INCOME', color: 'bg-emerald-100 text-emerald-600' },
            { name: 'Rental Income', icon: '🔑', type: 'INCOME', color: 'bg-cyan-100 text-cyan-600' },
            { name: 'Uncategorized', icon: '❓', type: 'EXPENSE', color: 'bg-gray-100 text-gray-600' }
        ]
        await client.category.createMany({ data: defaults })
    }
}

// Execute auto-seed
ensureDefaultCategories(prismaClient).catch(console.error)

export const prisma = globalForPrisma.prisma || prismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
