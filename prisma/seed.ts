import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    // 1. Clean existing data
    await prisma.transaction.deleteMany()
    await prisma.property.deleteMany()
    await prisma.category.deleteMany()
    await prisma.user.deleteMany()

    // 2. Create Demo User
    const password = await hash('password123', 10)
    const user = await prisma.user.create({
        data: {
            username: 'demo',
            password,
        }
    })

    // 3. Create Properties
    const rental = await prisma.property.create({
        data: { name: "Rental Apt 4B", address: "123 Main St", userId: user.id }
    })

    // 4. Create Categories
    const categoriesData = [
        // EXPENSES
        { name: 'Food', icon: '🍔', type: 'EXPENSE', color: 'bg-orange-100 text-orange-600' },
        { name: 'Shopping', icon: '🛍️', type: 'EXPENSE', color: 'bg-pink-100 text-pink-600' },
        { name: 'Daily', icon: '🧴', type: 'EXPENSE', color: 'bg-blue-100 text-blue-600' },
        { name: 'Transport', icon: '🚌', type: 'EXPENSE', color: 'bg-indigo-100 text-indigo-600' },
        { name: 'Vegetables', icon: '🥕', type: 'EXPENSE', color: 'bg-green-100 text-green-600' },
        { name: 'Fruits', icon: '🍎', type: 'EXPENSE', color: 'bg-red-100 text-red-600' },
        { name: 'Snacks', icon: '🍪', type: 'EXPENSE', color: 'bg-yellow-100 text-yellow-600' },
        { name: 'Sports', icon: '🏸', type: 'EXPENSE', color: 'bg-lime-100 text-lime-600' },
        { name: 'Entertainment', icon: '🎮', type: 'EXPENSE', color: 'bg-purple-100 text-purple-600' },
        { name: 'Communication', icon: '📱', type: 'EXPENSE', color: 'bg-cyan-100 text-cyan-600' },
        { name: 'Clothes', icon: '👕', type: 'EXPENSE', color: 'bg-rose-100 text-rose-600' },
        { name: 'Beauty', icon: '💄', type: 'EXPENSE', color: 'bg-fuchsia-100 text-fuchsia-600' },
        { name: 'Housing', icon: '🏠', type: 'EXPENSE', color: 'bg-slate-100 text-slate-600' },
        { name: 'Home', icon: '🛋️', type: 'EXPENSE', color: 'bg-stone-100 text-stone-600' },
        { name: 'Kids', icon: '👶', type: 'EXPENSE', color: 'bg-sky-100 text-sky-600' },
        { name: 'Elders', icon: '👴', type: 'EXPENSE', color: 'bg-gray-100 text-gray-600' },
        { name: 'Social', icon: '🥂', type: 'EXPENSE', color: 'bg-violet-100 text-violet-600' },
        { name: 'Travel', icon: '✈️', type: 'EXPENSE', color: 'bg-teal-100 text-teal-600' },
        { name: 'Alcohol', icon: '🍷', type: 'EXPENSE', color: 'bg-red-50 text-red-800' },
        { name: 'Digital', icon: '💻', type: 'EXPENSE', color: 'bg-zinc-100 text-zinc-600' },
        { name: 'Car', icon: '🚗', type: 'EXPENSE', color: 'bg-blue-50 text-blue-800' },
        { name: 'Medical', icon: '💊', type: 'EXPENSE', color: 'bg-rose-50 text-rose-800' },
        { name: 'Books', icon: '📚', type: 'EXPENSE', color: 'bg-amber-100 text-amber-600' },
        { name: 'Learning', icon: '🎓', type: 'EXPENSE', color: 'bg-emerald-100 text-emerald-600' },
        { name: 'Pets', icon: '🐱', type: 'EXPENSE', color: 'bg-orange-50 text-orange-800' },
        { name: 'Gifts', icon: '🎁', type: 'EXPENSE', color: 'bg-pink-50 text-pink-800' },
        { name: 'Office', icon: '📎', type: 'EXPENSE', color: 'bg-slate-200 text-slate-700' },
        { name: 'Repair', icon: '🔧', type: 'EXPENSE', color: 'bg-neutral-200 text-neutral-700' },
        { name: 'Donation', icon: '❤️', type: 'EXPENSE', color: 'bg-rose-200 text-rose-700' },
        { name: 'Lottery', icon: '🎫', type: 'EXPENSE', color: 'bg-yellow-200 text-yellow-700' },
        { name: 'Relatives', icon: '👥', type: 'EXPENSE', color: 'bg-indigo-50 text-indigo-800' },
        { name: 'Others', icon: '📝', type: 'EXPENSE', color: 'bg-gray-200 text-gray-700' },

        // INCOME
        { name: 'Salary', icon: '💰', type: 'INCOME', color: 'bg-green-100 text-green-600' },
        { name: 'Part-time', icon: '⏱️', type: 'INCOME', color: 'bg-lime-100 text-lime-600' },
        { name: 'Investment', icon: '📈', type: 'INCOME', color: 'bg-emerald-100 text-emerald-600' },
        { name: 'Rental Income', icon: '🔑', type: 'INCOME', color: 'bg-cyan-100 text-cyan-600' },
        { name: 'Bonus', icon: '🧧', type: 'INCOME', color: 'bg-red-100 text-red-600' },
        { name: 'Refund', icon: '↩️', type: 'INCOME', color: 'bg-blue-100 text-blue-600' },
        { name: 'Reimbursement', icon: '🧾', type: 'INCOME', color: 'bg-indigo-100 text-indigo-600' },
        { name: 'Lottery (Win)', icon: '🎰', type: 'INCOME', color: 'bg-yellow-100 text-yellow-600' },
        { name: 'Other Income', icon: '📥', type: 'INCOME', color: 'bg-gray-100 text-gray-600' },
    ]

    const categories = []
    for (const c of categoriesData) {
        const cat = await prisma.category.create({ data: c })
        categories.push(cat)
    }

    // 5. Create Transactions (last 60 days)
    const transactions = []

    // Salary (Income)
    const salaryCat = categories.find(c => c.name === 'Salary')
    transactions.push({
        amount: 4000,
        description: "Monthly Salary",
        categoryId: salaryCat?.id,
        userId: user.id,
        date: new Date(),
        type: "INCOME",
        source: "MANUAL"
    })

    // Expenses
    const expenseCats = categories.filter(c => c.type === 'EXPENSE')
    for (let i = 0; i < 40; i++) {
        const randomCategory = expenseCats[Math.floor(Math.random() * expenseCats.length)]
        const daysAgo = Math.floor(Math.random() * 60)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)

        transactions.push({
            amount: Number((Math.random() * 100 + 5).toFixed(2)),
            description: `Expense ${i + 1}`,
            categoryId: randomCategory.id,
            userId: user.id,
            date: date,
            type: "EXPENSE",
            source: "MANUAL"
        })
    }

    await prisma.transaction.createMany({ data: transactions })

    console.log('✅ Seed data created: 30+ Categories & Transactions')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
