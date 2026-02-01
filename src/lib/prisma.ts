import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prismaClient = new PrismaClient()

import { hash } from 'bcryptjs'

// Auto-seed function
async function ensureDefaults(client: PrismaClient) {
    try {
        // 1. Categories
        const catCount = await client.category.count()
        if (catCount === 0) {
            console.log('🌱 No categories found. Seeding defaults...')
            const defaults = [

                // Expenses
                { name: 'Food', icon: '🛒', type: 'EXPENSE', color: 'bg-orange-100 text-orange-600' },
                { name: 'Dining', icon: '🍽️', type: 'EXPENSE', color: 'bg-orange-200 text-orange-700' },
                { name: 'Shopping', icon: '🛍️', type: 'EXPENSE', color: 'bg-pink-100 text-pink-600' },
                { name: 'Housing', icon: '🏠', type: 'EXPENSE', color: 'bg-indigo-100 text-indigo-600' },
                { name: 'Utilities', icon: '💡', type: 'EXPENSE', color: 'bg-yellow-100 text-yellow-600' },
                { name: 'Transport', icon: '🚗', type: 'EXPENSE', color: 'bg-blue-100 text-blue-600' },
                { name: 'Health', icon: '💊', type: 'EXPENSE', color: 'bg-red-100 text-red-600' },
                { name: 'Entertainment', icon: '🎬', type: 'EXPENSE', color: 'bg-purple-100 text-purple-600' },
                { name: 'Travel', icon: '✈️', type: 'EXPENSE', color: 'bg-sky-100 text-sky-600' },
                { name: 'Education', icon: '🎓', type: 'EXPENSE', color: 'bg-teal-100 text-teal-600' },
                { name: 'Kids', icon: '🧸', type: 'EXPENSE', color: 'bg-rose-100 text-rose-600' },
                { name: 'Pets', icon: '🐾', type: 'EXPENSE', color: 'bg-stone-100 text-stone-600' },
                { name: 'Services', icon: '🧾', type: 'EXPENSE', color: 'bg-gray-200 text-gray-700' },

                // Income
                { name: 'Salary', icon: '💰', type: 'INCOME', color: 'bg-emerald-100 text-emerald-600' },
                { name: 'Investment', icon: '📈', type: 'INCOME', color: 'bg-green-100 text-green-600' },
                { name: 'Rental Income', icon: '🔑', type: 'INCOME', color: 'bg-cyan-100 text-cyan-600' },
                { name: 'Other Income', icon: '💵', type: 'INCOME', color: 'bg-lime-100 text-lime-600' },

                // System
                { name: 'Uncategorized', icon: '❓', type: 'EXPENSE', color: 'bg-gray-100 text-gray-600' }
            ]
            await client.category.createMany({ data: defaults })
        }

        // 2. Default User (Direct Access)
        const userCount = await client.user.count()
        if (userCount === 0) {
            console.log('👤 No users found. Creating default admin account...')
            const hashedPassword = await hash("admin123", 10)
            await client.user.create({
                data: {
                    username: "admin",
                    password: hashedPassword
                }
            })
            console.log('✅ Default user created: admin / admin123')
        }
    } catch (e) {
        console.error('❌ Seeding error:', e)
    }
}

// Execute auto-seed
ensureDefaults(prismaClient).catch(console.error)

export const prisma = globalForPrisma.prisma || prismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
