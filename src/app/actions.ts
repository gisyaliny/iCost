"use server"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function registerUser(formData: FormData) {
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    if (!username || !password) return { error: "Missing fields" }

    try {
        const existing = await prisma.user.findUnique({ where: { username } })
        if (existing) return { error: "User already exists" }

        const hashedPassword = await hash(password, 10)
        await prisma.user.create({
            data: {
                username,
                password: hashedPassword
            }
        })

        return { success: true }
    } catch (e) {
        return { error: "Registration failed" }
    }
}

export async function addCategory(formData: FormData) {
    const name = formData.get("name") as string
    const icon = formData.get("icon") as string
    const color = formData.get("color") as string
    const type = formData.get("type") as string || "EXPENSE"

    if (!name) return { error: "Name is required" }

    try {
        await prisma.category.create({
            data: { name, icon, color, type }
        })
        revalidatePath("/")
        return { success: true }
    } catch (e) {
        return { error: "Failed to create category" }
    }
}

export async function addTransaction(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const amount = parseFloat(formData.get("amount") as string)
    const description = formData.get("description") as string
    const categoryId = formData.get("categoryId") as string
    const propertyId = formData.get("propertyId") as string
    const dateStr = formData.get("date") as string
    const type = formData.get("type") as string || "EXPENSE"
    const frequency = formData.get("frequency") as string || "NONE"
    const repeatUntilStr = formData.get("repeatUntil") as string

    if (!amount || !categoryId) return { error: "Missing fields" }

    try {
        const startDate = dateStr ? new Date(dateStr) : new Date()
        const transactionsToCreate = []

        // Base transaction
        transactionsToCreate.push({
            amount,
            description,
            categoryId,
            userId: session.user.id,
            date: startDate,
            type,
            source: "MANUAL",
            propertyId: propertyId || null
        })

        if (frequency !== "NONE" && repeatUntilStr) {
            const endDate = new Date(repeatUntilStr)
            let currentDate = new Date(startDate)

            while (true) {
                if (frequency === "DAILY") currentDate.setDate(currentDate.getDate() + 1)
                else if (frequency === "WEEKLY") currentDate.setDate(currentDate.getDate() + 7)
                else if (frequency === "MONTHLY") currentDate.setMonth(currentDate.getMonth() + 1)
                else if (frequency === "YEARLY") currentDate.setFullYear(currentDate.getFullYear() + 1)
                else break

                if (currentDate > endDate) break

                transactionsToCreate.push({
                    amount,
                    description,
                    categoryId,
                    userId: session.user.id,
                    date: new Date(currentDate),
                    type,
                    source: "RECURRING",
                    propertyId: propertyId || null
                })

                if (transactionsToCreate.length > 500) break // Safety limit
            }
        }

        await prisma.transaction.createMany({
            data: transactionsToCreate
        })

        revalidatePath("/")
        return { success: true }
    } catch (e) {
        return { error: "Failed to add transaction" }
    }
}

export async function deleteTransaction(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        await prisma.transaction.delete({ where: { id } })
        revalidatePath("/")
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete" }
    }
}

export async function updateTransaction(id: string, formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const amount = parseFloat(formData.get("amount") as string)
    const description = formData.get("description") as string
    const categoryId = formData.get("categoryId") as string
    const propertyId = formData.get("propertyId") as string
    const dateStr = formData.get("date") as string
    const type = formData.get("type") as string

    if (!amount || !categoryId) return { error: "Missing fields" }

    try {
        await prisma.transaction.update({
            where: { id },
            data: {
                amount,
                description,
                categoryId,
                date: dateStr ? new Date(dateStr) : undefined,
                type,
                propertyId: propertyId || null
            }
        })
        revalidatePath("/")
        return { success: true }
    } catch (e) {
        return { error: "Failed to update transaction" }
    }
}

export async function importTransactions(data: any[]) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    // Verify user exists to maintain FK constraint
    const userExists = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!userExists) return { error: "User session invalid. Please logout and login again." }

    // Auto-create 'Uncategorized' if not exists
    let defaultCat = await prisma.category.findUnique({ where: { name: 'Uncategorized' } })
    if (!defaultCat) {
        defaultCat = await prisma.category.create({ data: { name: 'Uncategorized', icon: '❓', color: 'bg-gray-100', type: 'EXPENSE' } })
    }

    let count = 0
    for (const item of data) {
        await prisma.transaction.create({
            data: {
                amount: item.amount,
                description: item.description,
                date: new Date(item.date),
                type: item.type || (item.amount > 0 ? "INCOME" : "EXPENSE"),
                source: "CSV_IMPORT",
                userId: session.user.id,
                categoryId: defaultCat.id
            }
        })
        count++
    }
    revalidatePath("/")
    return { success: true, count }
}

export async function deleteTransactions(ids: string[]) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        await prisma.transaction.deleteMany({
            where: {
                id: { in: ids },
                userId: session.user.id
            }
        })
        revalidatePath("/")
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete" }
    }
}

export async function removeDuplicates() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const transactions = await prisma.transaction.findMany({
        where: { userId: session.user.id }
    })

    const seen = new Set()
    const duplicates = []

    for (const t of transactions) {
        const key = `${t.date.toISOString().split('T')[0]}-${t.amount}-${t.description}-${t.type}`
        if (seen.has(key)) {
            duplicates.push(t.id)
        } else {
            seen.add(key)
        }
    }

    if (duplicates.length > 0) {
        await prisma.transaction.deleteMany({
            where: {
                id: { in: duplicates }
            }
        })
    }

    revalidatePath("/")
    return { success: true, count: duplicates.length }
}

export async function addProperty(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = formData.get("name") as string
    if (!name) return { error: "Name required" }

    await prisma.property.create({
        data: { name, userId: session.user.id }
    })
    revalidatePath("/")
    return { success: true }
}

export async function resetAllData() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    await prisma.transaction.deleteMany({
        where: { userId: session.user.id }
    })
    revalidatePath("/")
    return { success: true }
}
