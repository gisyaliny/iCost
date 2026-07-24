"use server"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { fromCents, roundMoney, toCents } from "@/lib/money"
import { z } from "zod"
import { transactionFingerprint } from "@/lib/accounting"
import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { CSVMapping, parseStatementText, statementFileType } from "@/lib/statement-import"
import { categoryRuleMatches } from "@/lib/category-rules"

const importedTransactionSchema = z.object({
    amount: z.number().finite().positive(),
    description: z.string().trim().max(500).default("Imported Transaction"),
    date: z.coerce.date(),
    type: z.enum(["INCOME", "EXPENSE"]),
    categoryId: z.string().uuid().optional(),
    note: z.string().trim().max(1000).optional(),
    externalId: z.string().trim().max(500).optional(),
    reviewReason: z.string().trim().max(500).optional(),
})

const importOptionsSchema = z.object({
    filename: z.string().trim().min(1).max(255).optional(),
    fileHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    origin: z.enum(["UPLOAD", "NAS_INBOX"]).default("UPLOAD"),
    format: z.enum(["csv", "ofx", "qfx"]).default("csv"),
}).default({ origin: "UPLOAD", format: "csv" })

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024
const IMPORT_INBOX_DIR = path.resolve(process.env.IMPORT_INBOX_DIR || path.join(process.cwd(), "imports"))

function safeInboxFile(filename: string) {
    if (!filename || filename !== path.basename(filename)) throw new Error("Invalid inbox filename")
    const resolved = path.resolve(IMPORT_INBOX_DIR, filename)
    if (!resolved.startsWith(`${IMPORT_INBOX_DIR}${path.sep}`)) throw new Error("Invalid inbox filename")
    return resolved
}

function fileDigest(content: Buffer | string) {
    return createHash("sha256").update(content).digest("hex")
}

function transactionKey(transaction: { date: Date, amount: number, description: string | null, type: string }) {
    return transactionFingerprint({ ...transaction, amountCents: toCents(transaction.amount) })
}

function isStatementImport(source: string | null) {
    return source === "CSV_IMPORT" || source === "OFX_IMPORT" || source === "QFX_IMPORT"
}

function parseDateInput(value: string | null, fallback = new Date()) {
    if (!value) return fallback
    const date = new Date(`${value}T12:00:00.000Z`)
    return Number.isNaN(date.getTime()) ? null : date
}

async function resolveOwnedAccount(userId: string, requestedAccountId: string | null) {
    if (requestedAccountId && requestedAccountId !== "NONE") {
        return prisma.account.findFirst({
            where: { id: requestedAccountId, userId, isArchived: false },
            select: { id: true },
        })
    }

    return prisma.account.upsert({
        where: { userId_name: { userId, name: "Legacy / Unassigned" } },
        update: {},
        create: { userId, name: "Legacy / Unassigned", type: "OTHER" },
        select: { id: true },
    })
}

async function resolveUncategorizedCategory(type: "INCOME" | "EXPENSE") {
    const name = type === "INCOME" ? "Uncategorized Income" : "Uncategorized"
    return prisma.category.upsert({
        where: { name },
        update: {},
        create: { name, icon: "❓", color: "bg-gray-100", type },
        select: { id: true, type: true },
    })
}

function nextRecurringDate(current: Date, start: Date, frequency: string) {
    const next = new Date(current)
    if (frequency === "DAILY") {
        next.setUTCDate(next.getUTCDate() + 1)
    } else if (frequency === "WEEKLY") {
        next.setUTCDate(next.getUTCDate() + 7)
    } else if (frequency === "MONTHLY") {
        const targetMonth = next.getUTCMonth() + 1
        const targetYear = next.getUTCFullYear() + Math.floor(targetMonth / 12)
        const normalizedMonth = targetMonth % 12
        const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
        next.setUTCFullYear(targetYear, normalizedMonth, Math.min(start.getUTCDate(), lastDay))
    } else if (frequency === "YEARLY") {
        const targetYear = next.getUTCFullYear() + 1
        const lastDay = new Date(Date.UTC(targetYear, start.getUTCMonth() + 1, 0)).getUTCDate()
        next.setUTCFullYear(targetYear, start.getUTCMonth(), Math.min(start.getUTCDate(), lastDay))
    } else {
        return null
    }
    return next
}

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
    } catch (error) {
        console.error("Registration Error:", error)
        return { error: "Registration failed. Check server logs." }
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
    } catch {
        return { error: "Failed to create category" }
    }
}

export async function addTransaction(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const amount = roundMoney(Number(formData.get("amount")))
    const amountCents = Number.isFinite(amount) ? toCents(amount) : 0
    const description = formData.get("description") as string
    const note = (formData.get("note") as string | null)?.trim() || null
    const categoryId = formData.get("categoryId") as string
    const requestedPropertyId = formData.get("propertyId") as string | null
    const propertyId = requestedPropertyId && requestedPropertyId !== "NONE" ? requestedPropertyId : null
    const requestedProjectId = formData.get("projectId") as string | null
    const projectId = requestedProjectId && requestedProjectId !== "NONE" ? requestedProjectId : null
    const requestedAccountId = formData.get("accountId") as string | null
    const dateStr = formData.get("date") as string
    const type = formData.get("type") as string || "EXPENSE"
    const frequency = formData.get("frequency") as string || "NONE"
    const repeatUntilStr = formData.get("repeatUntil") as string

    if (!Number.isFinite(amount) || amount <= 0 || !categoryId) return { error: "Invalid amount or category" }
    if (note && note.length > 1000) return { error: "Note is too long" }
    if (projectId) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id }, select: { id: true } })
        if (!project) return { error: "Project not found" }
    }

    try {
        const account = await resolveOwnedAccount(session.user.id, requestedAccountId)
        if (!account) return { error: "Account not found" }
        const startDate = parseDateInput(dateStr)
        if (!startDate) return { error: "Invalid transaction date" }
        const transactionData = {
            amountCents,
            description,
            note,
            categoryId,
            userId: session.user.id,
            date: startDate,
            type,
            source: "MANUAL",
            propertyId: propertyId || null,
            projectId,
            accountId: account.id,
        }

        if (frequency !== "NONE" && !repeatUntilStr) return { error: "Repeat end date is required for recurring transactions" }

        if (frequency !== "NONE" && repeatUntilStr) {
            const endDate = parseDateInput(repeatUntilStr)
            if (!endDate || endDate < startDate) return { error: "Repeat end date must be on or after the transaction date" }
            const nextDate = nextRecurringDate(startDate, startDate, frequency)
            if (!nextDate) return { error: "Invalid recurrence frequency" }

            await prisma.$transaction(async tx => {
                const schedule = await tx.recurringSchedule.create({
                    data: {
                        name: description?.trim() || `${frequency.toLowerCase()} transaction`,
                        amountCents,
                        description,
                        note,
                        type,
                        frequency,
                        nextDate,
                        endDate,
                        autoPost: true,
                        isActive: nextDate <= endDate,
                        userId: session.user.id,
                        categoryId,
                        propertyId,
                        projectId,
                        accountId: account.id,
                    },
                })
                await tx.transaction.create({ data: { ...transactionData, recurringScheduleId: schedule.id } })
            })
        } else {
            await prisma.transaction.create({ data: transactionData })
        }

        revalidatePath("/")
        return { success: true }
    } catch {
        return { error: "Failed to add transaction" }
    }
}

export async function deleteTransaction(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    try {
        const result = await prisma.transaction.deleteMany({ where: { id, userId: session.user.id } })
        if (result.count === 0) return { error: "Transaction not found" }
        revalidatePath("/")
        return { success: true }
    } catch {
        return { error: "Failed to delete" }
    }
}

export async function updateTransaction(id: string, formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const amount = roundMoney(Number(formData.get("amount")))
    const amountCents = Number.isFinite(amount) ? toCents(amount) : 0
    const description = formData.get("description") as string
    const note = (formData.get("note") as string | null)?.trim() || null
    const categoryId = formData.get("categoryId") as string
    const requestedPropertyId = formData.get("propertyId") as string | null
    const propertyId = requestedPropertyId && requestedPropertyId !== "NONE" ? requestedPropertyId : null
    const requestedProjectId = formData.get("projectId") as string | null
    const projectId = requestedProjectId && requestedProjectId !== "NONE" ? requestedProjectId : null
    const requestedAccountId = formData.get("accountId") as string | null
    const dateStr = formData.get("date") as string
    const type = formData.get("type") as string

    if (!Number.isFinite(amount) || amount <= 0 || !categoryId) return { error: "Invalid amount or category" }
    if (note && note.length > 1000) return { error: "Note is too long" }
    if (projectId) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id }, select: { id: true } })
        if (!project) return { error: "Project not found" }
    }

    try {
        const account = await resolveOwnedAccount(session.user.id, requestedAccountId)
        if (!account) return { error: "Account not found" }
        const existing = await prisma.transaction.findFirst({
            where: { id, userId: session.user.id },
            select: { id: true, source: true, description: true }
        })
        if (!existing) return { error: "Transaction not found" }

        const transactionDate = dateStr ? parseDateInput(dateStr) : undefined
        if (dateStr && !transactionDate) return { error: "Invalid transaction date" }

        await prisma.transaction.update({
            where: { id: existing.id },
            data: {
                amountCents,
                description: isStatementImport(existing.source) ? existing.description : description,
                note,
                categoryId,
                date: transactionDate || undefined,
                type,
                propertyId: propertyId || null,
                projectId,
                accountId: account.id,
            }
        })
        revalidatePath("/")
        return { success: true }
    } catch {
        return { error: "Failed to update transaction" }
    }
}

export async function importTransactions(data: unknown[], requestedOptions?: unknown) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    // Verify user exists to maintain FK constraint
    const userExists = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!userExists) return { error: "User session invalid. Please logout and login again." }

    const parsed = z.array(importedTransactionSchema).max(5000).safeParse(data)
    if (!parsed.success) return { error: "Statement contains invalid dates, amounts, or transaction types." }
    const parsedOptions = importOptionsSchema.safeParse(requestedOptions)
    if (!parsedOptions.success) return { error: "Invalid import metadata." }
    const options = parsedOptions.data

    try {
        const [defaultExpenseCategory, defaultIncomeCategory] = await Promise.all([
            resolveUncategorizedCategory("EXPENSE"),
            resolveUncategorizedCategory("INCOME"),
        ])

        const account = await resolveOwnedAccount(session.user.id, null)
        if (!account) return { error: "Default account could not be created" }
        if (options.fileHash) {
            const previousBatch = await prisma.importBatch.findUnique({
                where: { userId_fileHash: { userId: session.user.id, fileHash: options.fileHash } },
                select: { id: true },
            })
            if (previousBatch) return { success: true, count: 0, skipped: parsed.data.length, alreadyImported: true }
        }
        const importBatch = await prisma.importBatch.create({
            data: {
                userId: session.user.id,
                filename: options.filename || `${options.format.toUpperCase()} import`,
                fileHash: options.fileHash,
                source: options.origin,
            },
            select: { id: true },
        })

        const existing = await prisma.transaction.findMany({
            where: { userId: session.user.id },
            select: { date: true, amountCents: true, description: true, type: true, externalId: true }
        })
        const rules = await prisma.categoryRule.findMany({
            where: { userId: session.user.id, isEnabled: true },
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
            select: { pattern: true, matchType: true, categoryId: true, category: { select: { type: true } } },
        })
        const categoryTypes = new Map((await prisma.category.findMany({ select: { id: true, type: true } })).map(item => [item.id, item.type]))
        const seen = new Set(existing.map(item => transactionKey({ ...item, amount: fromCents(item.amountCents) })))
        const seenExternalIds = new Set(existing.flatMap(item => item.externalId ? [item.externalId] : []))
        const transactions = parsed.data.flatMap(item => {
            const normalized = {
                ...item,
                amount: roundMoney(item.amount),
                description: item.description || "Imported Transaction",
            }
            const key = transactionKey(normalized)
            if ((normalized.externalId && seenExternalIds.has(normalized.externalId)) || seen.has(key)) return []
            seen.add(key)
            if (normalized.externalId) seenExternalIds.add(normalized.externalId)
            const description = normalized.description.toLocaleLowerCase()
            const matchingRule = rules.find(rule => {
                if (rule.category.type !== normalized.type) return false
                return categoryRuleMatches(description, rule)
            })
            const { amount: normalizedAmount, ...rest } = normalized
            const requestedCategoryIsValid = normalized.categoryId && categoryTypes.get(normalized.categoryId) === normalized.type
            const defaultCategory = normalized.type === "INCOME" ? defaultIncomeCategory : defaultExpenseCategory
            return [{
                ...rest,
                amountCents: toCents(normalizedAmount),
                source: `${options.format.toUpperCase()}_IMPORT`,
                reviewed: false,
                userId: session.user.id,
                categoryId: requestedCategoryIsValid ? normalized.categoryId : matchingRule?.categoryId || defaultCategory.id,
                accountId: account.id,
                importBatchId: importBatch.id,
            }]
        })

        if (transactions.length > 0) {
            await prisma.transaction.createMany({ data: transactions })
        } else if (!options.fileHash) {
            await prisma.importBatch.delete({ where: { id: importBatch.id } })
        }
        revalidatePath("/")
        revalidatePath("/analysis")
        return { success: true, count: transactions.length, skipped: parsed.data.length - transactions.length }
    } catch {
        return { error: "Failed to import transactions" }
    }
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
    } catch {
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
        const key = transactionFingerprint(t)
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

export async function scanImportInbox() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    try {
        await mkdir(IMPORT_INBOX_DIR, { recursive: true })
        const entries = (await readdir(IMPORT_INBOX_DIR, { withFileTypes: true }))
            .filter(entry => entry.isFile() && statementFileType(entry.name))
            .slice(0, 100)
        const files = await Promise.all(entries.map(async entry => {
            const filepath = safeInboxFile(entry.name)
            const info = await stat(filepath)
            if (info.size > MAX_IMPORT_FILE_BYTES) {
                return { name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString(), hash: "", imported: false, error: "File exceeds 10 MB" }
            }
            const content = await readFile(filepath)
            return { name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString(), hash: fileDigest(content), imported: false }
        }))
        const hashes = files.flatMap(file => file.hash ? [file.hash] : [])
        const imported = hashes.length ? await prisma.importBatch.findMany({
            where: { userId: session.user.id, fileHash: { in: hashes } },
            select: { fileHash: true },
        }) : []
        const importedHashes = new Set(imported.flatMap(item => item.fileHash ? [item.fileHash] : []))
        return {
            success: true,
            directory: IMPORT_INBOX_DIR,
            files: files.map(file => ({ ...file, imported: importedHashes.has(file.hash) })).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
        }
    } catch (error) {
        console.error("Inbox scan failed", error)
        return { error: "Could not read the NAS import folder. Check its path and permissions." }
    }
}

export async function previewInboxFile(filename: string, mapping?: CSVMapping) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    try {
        const format = statementFileType(filename)
        if (!format) return { error: "Only CSV, OFX, and QFX files are supported." }
        const filepath = safeInboxFile(filename)
        const info = await stat(filepath)
        if (!info.isFile() || info.size > MAX_IMPORT_FILE_BYTES) return { error: "Import files must be 10 MB or smaller." }
        const content = await readFile(filepath)
        const parsed = parseStatementText(filename, content.toString("utf8"), mapping)
        return {
            success: true,
            filename,
            fileHash: fileDigest(content),
            format,
            transactions: parsed.transactions,
            invalidRows: parsed.invalidRows,
            csv: parsed.csv,
        }
    } catch (error) {
        console.error("Inbox preview failed", error)
        return { error: "The statement could not be parsed. It may be incomplete or use an unsupported format." }
    }
}

export async function markTransactionsReviewed(ids: string[]) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    if (!ids.length) return { error: "No transactions selected" }

    const result = await prisma.transaction.updateMany({
        where: { id: { in: ids }, userId: session.user.id },
        data: { reviewed: true, reviewReason: null },
    })
    revalidatePath("/")
    revalidatePath("/analysis")
    return { success: true, count: result.count }
}

export async function updateTransactionReview(id: string, requestedType: string, approve = false) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    if (!new Set(["INCOME", "EXPENSE"]).has(requestedType)) return { error: "Invalid transaction type" }
    const type = requestedType as "INCOME" | "EXPENSE"
    const existing = await prisma.transaction.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true, category: { select: { type: true } } },
    })
    if (!existing) return { error: "Transaction not found" }
    const fallbackCategory = existing.category?.type === type ? null : await resolveUncategorizedCategory(type)
    await prisma.transaction.update({
        where: { id },
        data: {
            type,
            ...(fallbackCategory ? { categoryId: fallbackCategory.id } : {}),
            ...(approve ? { reviewed: true, reviewReason: null } : {}),
        },
    })
    revalidatePath("/")
    revalidatePath("/analysis")
    return { success: true }
}

export async function addCategoryRule(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = (formData.get("name") as string | null)?.trim()
    const pattern = (formData.get("pattern") as string | null)?.trim()
    const categoryId = formData.get("categoryId") as string
    const matchType = (formData.get("matchType") as string | null) || "CONTAINS"
    if (!name || !pattern || !categoryId) return { error: "Name, pattern, and category are required" }
    if (!new Set(["CONTAINS", "STARTS_WITH", "EXACT"]).has(matchType)) return { error: "Invalid match type" }
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })
    if (!category) return { error: "Category not found" }

    const highest = await prisma.categoryRule.aggregate({
        where: { userId: session.user.id },
        _max: { priority: true },
    })
    await prisma.categoryRule.create({
        data: { name, pattern, matchType, categoryId, userId: session.user.id, priority: (highest._max.priority ?? -1) + 1 },
    })
    revalidatePath("/")
    revalidatePath("/rules")
    revalidatePath("/", "layout")
    return { success: true }
}

export async function updateCategoryRule(id: string, formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const name = (formData.get("name") as string | null)?.trim()
    const pattern = (formData.get("pattern") as string | null)?.trim()
    const categoryId = formData.get("categoryId") as string
    const matchType = (formData.get("matchType") as string | null) || "CONTAINS"
    if (!name || !pattern || !categoryId) return { error: "Name, pattern, and category are required" }
    if (!new Set(["CONTAINS", "STARTS_WITH", "EXACT"]).has(matchType)) return { error: "Invalid match type" }
    const [ownedRule, category] = await Promise.all([
        prisma.categoryRule.findFirst({ where: { id, userId: session.user.id }, select: { id: true } }),
        prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
    ])
    if (!ownedRule) return { error: "Rule not found" }
    if (!category) return { error: "Category not found" }
    await prisma.categoryRule.update({ where: { id }, data: { name, pattern, matchType, categoryId } })
    revalidatePath("/rules")
    revalidatePath("/", "layout")
    return { success: true }
}

export async function toggleCategoryRule(id: string, isEnabled: boolean) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const result = await prisma.categoryRule.updateMany({ where: { id, userId: session.user.id }, data: { isEnabled } })
    if (!result.count) return { error: "Rule not found" }
    revalidatePath("/rules")
    revalidatePath("/", "layout")
    return { success: true }
}

export async function deleteCategoryRule(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const result = await prisma.categoryRule.deleteMany({ where: { id, userId: session.user.id } })
    if (!result.count) return { error: "Rule not found" }
    revalidatePath("/rules")
    revalidatePath("/", "layout")
    return { success: true }
}

export async function reorderCategoryRules(requestedIds: string[]) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const parsed = z.array(z.string().uuid()).max(500).safeParse(requestedIds)
    if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { error: "Invalid rule order" }
    const owned = await prisma.categoryRule.findMany({ where: { userId: session.user.id }, select: { id: true } })
    const ownedIds = new Set(owned.map(rule => rule.id))
    if (parsed.data.length !== owned.length || parsed.data.some(id => !ownedIds.has(id))) return { error: "Rule list changed; refresh and try again" }
    await prisma.$transaction(parsed.data.map((id, index) => prisma.categoryRule.update({
        where: { id },
        data: { priority: parsed.data.length - index },
    })))
    revalidatePath("/rules")
    revalidatePath("/", "layout")
    return { success: true }
}

export async function saveImportProfile(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const name = (formData.get("name") as string | null)?.trim()
    const dateColumn = (formData.get("dateColumn") as string | null)?.trim()
    const descriptionColumn = (formData.get("descriptionColumn") as string | null)?.trim()
    const amountColumn = (formData.get("amountColumn") as string | null)?.trim()
    const debitValue = (formData.get("debitColumn") as string | null)?.trim()
    const creditValue = (formData.get("creditColumn") as string | null)?.trim()
    const debitColumn = debitValue && debitValue !== "NONE" ? debitValue : null
    const creditColumn = creditValue && creditValue !== "NONE" ? creditValue : null
    const typeValue = (formData.get("typeColumn") as string | null)?.trim()
    const typeColumn = typeValue && typeValue !== "NONE" ? typeValue : null
    if (!name || !dateColumn || !descriptionColumn || (!amountColumn && !debitColumn && !creditColumn)) return { error: "Profile name, date, description, and amount columns are required" }
    if ([name, dateColumn, descriptionColumn, amountColumn || "", debitColumn || "", creditColumn || "", typeColumn || ""].some(value => value.length > 200)) return { error: "Import profile value is too long" }

    await prisma.importProfile.upsert({
        where: { userId_name: { userId: session.user.id, name } },
        update: { dateColumn, descriptionColumn, amountColumn: amountColumn || "", debitColumn, creditColumn, typeColumn },
        create: { name, dateColumn, descriptionColumn, amountColumn: amountColumn || "", debitColumn, creditColumn, typeColumn, userId: session.user.id },
    })
    revalidatePath("/")
    return { success: true }
}

export async function addAccount(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = (formData.get("name") as string | null)?.trim()
    const type = (formData.get("type") as string | null) || "CHECKING"
    const openingBalance = roundMoney(Number(formData.get("openingBalance") || 0))
    const allowedTypes = new Set(["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "INVESTMENT", "OTHER"])

    if (!name) return { error: "Account name is required" }
    if (name.length > 100) return { error: "Account name is too long" }
    if (!allowedTypes.has(type)) return { error: "Invalid account type" }
    if (!Number.isFinite(openingBalance)) return { error: "Invalid opening balance" }

    try {
        await prisma.account.create({
            data: { name, type, openingBalanceCents: toCents(openingBalance), userId: session.user.id },
        })
        revalidatePath("/")
        return { success: true }
    } catch {
        return { error: "An account with this name already exists" }
    }
}

export async function updateUserSettings(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const monthlyBudget = roundMoney(Number(formData.get("monthlyBudget")))
    const currency = (formData.get("currency") as string | null) || "USD"
    const locale = (formData.get("locale") as string | null) || "en-US"
    const timezone = (formData.get("timezone") as string | null) || "America/New_York"
    const allowedCurrencies = new Set(["USD", "CAD", "EUR", "GBP", "AUD", "CNY", "JPY"])
    const allowedLocales = new Set(["en-US", "en-CA", "en-GB", "zh-CN"])
    const allowedTimezones = new Set(["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC", "Asia/Shanghai"])

    if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0) return { error: "Invalid monthly budget" }
    if (!allowedCurrencies.has(currency) || !allowedLocales.has(locale) || !allowedTimezones.has(timezone)) return { error: "Invalid preferences" }

    await prisma.user.update({
        where: { id: session.user.id },
        data: { monthlyBudgetCents: toCents(monthlyBudget), currency, locale, timezone },
    })
    revalidatePath("/")
    revalidatePath("/analysis")
    return { success: true }
}

export async function addTransfer(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const fromAccountId = formData.get("fromAccountId") as string
    const toAccountId = formData.get("toAccountId") as string
    const amount = roundMoney(Number(formData.get("amount")))
    const date = parseDateInput(formData.get("date") as string | null)
    const description = (formData.get("description") as string | null)?.trim() || null
    const note = (formData.get("note") as string | null)?.trim() || null

    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) return { error: "Choose two different accounts" }
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Transfer amount must be greater than zero" }
    if (!date) return { error: "Invalid transfer date" }

    const ownedAccounts = await prisma.account.count({
        where: { id: { in: [fromAccountId, toAccountId] }, userId: session.user.id, isArchived: false },
    })
    if (ownedAccounts !== 2) return { error: "Account not found" }

    try {
        await prisma.transfer.create({
            data: { fromAccountId, toAccountId, amountCents: toCents(amount), date, description, note, userId: session.user.id },
        })
        revalidatePath("/")
        revalidatePath("/analysis")
        revalidatePath("/projects")
        return { success: true }
    } catch {
        return { error: "Failed to record transfer" }
    }
}

export async function archiveAccount(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const account = await prisma.account.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true, _count: { select: { transactions: true, incoming: true, outgoing: true } } },
    })
    if (!account) return { error: "Account not found" }
    if (account._count.transactions || account._count.incoming || account._count.outgoing) {
        await prisma.account.update({ where: { id }, data: { isArchived: true } })
    } else {
        await prisma.account.delete({ where: { id } })
    }
    revalidatePath("/")
    return { success: true }
}

export async function addProperty(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = (formData.get("name") as string | null)?.trim()
    const address = (formData.get("address") as string | null)?.trim() || null
    if (!name) return { error: "Name required" }

    await prisma.property.create({
        data: { name, address, userId: session.user.id }
    })
    revalidatePath("/")
    return { success: true }
}

export async function assignTransactionsToProject(ids: string[], requestedProjectId: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    if (ids.length === 0) return { error: "No transactions selected" }

    const projectId = requestedProjectId === "NONE" ? null : requestedProjectId
    if (projectId) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id }, select: { id: true } })
        if (!project) return { error: "Project not found" }
    }

    try {
        const result = await prisma.transaction.updateMany({
            where: { id: { in: ids }, userId: session.user.id },
            data: { projectId }
        })
        revalidatePath("/")
        revalidatePath("/analysis")
        return { success: true, count: result.count }
    } catch {
        return { error: "Failed to assign project" }
    }
}

export async function addProject(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = (formData.get("name") as string | null)?.trim()
    const description = (formData.get("description") as string | null)?.trim() || null
    const budgetValue = formData.get("budget") as string | null
    const budget = budgetValue ? roundMoney(Number(budgetValue)) : null
    const startDateValue = formData.get("startDate") as string | null
    const endDateValue = formData.get("endDate") as string | null
    const startDate = startDateValue ? parseDateInput(startDateValue) : null
    const endDate = endDateValue ? parseDateInput(endDateValue) : null
    if (!name) return { error: "Project name is required" }
    if (name.length > 100) return { error: "Project name is too long" }
    if (description && description.length > 300) return { error: "Project description is too long" }
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return { error: "Invalid project budget" }
    if ((startDateValue && !startDate) || (endDateValue && !endDate)) return { error: "Invalid project date" }
    if (startDate && endDate && endDate < startDate) return { error: "Project end date must be after its start date" }

    try {
        await prisma.project.create({
            data: { name, description, budgetCents: budget === null ? null : toCents(budget), startDate, endDate, userId: session.user.id }
        })
        revalidatePath("/")
        revalidatePath("/analysis")
        revalidatePath("/projects")
        return { success: true }
    } catch {
        return { error: "A project with this name already exists" }
    }
}

export async function updateProject(id: string, formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = (formData.get("name") as string | null)?.trim()
    const description = (formData.get("description") as string | null)?.trim() || null
    const budgetValue = formData.get("budget") as string | null
    const budget = budgetValue ? roundMoney(Number(budgetValue)) : null
    const startDateValue = formData.get("startDate") as string | null
    const endDateValue = formData.get("endDate") as string | null
    const startDate = startDateValue ? parseDateInput(startDateValue) : null
    const endDate = endDateValue ? parseDateInput(endDateValue) : null

    if (!name) return { error: "Project name is required" }
    if (name.length > 100 || (description && description.length > 300)) return { error: "Project details are too long" }
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return { error: "Invalid project budget" }
    if ((startDateValue && !startDate) || (endDateValue && !endDate)) return { error: "Invalid project date" }
    if (startDate && endDate && endDate < startDate) return { error: "Project end date must be after its start date" }

    try {
        const result = await prisma.project.updateMany({
            where: { id, userId: session.user.id },
            data: { name, description, budgetCents: budget === null ? null : toCents(budget), startDate, endDate },
        })
        if (!result.count) return { error: "Project not found" }
        revalidatePath("/")
        revalidatePath("/analysis")
        revalidatePath("/projects")
        return { success: true }
    } catch {
        return { error: "A project with this name already exists" }
    }
}

export async function archiveProject(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const result = await prisma.project.updateMany({ where: { id, userId: session.user.id }, data: { isArchived: true, status: "ARCHIVED" } })
    if (!result.count) return { error: "Project not found" }
    revalidatePath("/")
    revalidatePath("/analysis")
    revalidatePath("/projects")
    return { success: true }
}

export async function archiveProperty(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const result = await prisma.property.updateMany({ where: { id, userId: session.user.id }, data: { isArchived: true } })
    if (!result.count) return { error: "Property not found" }
    revalidatePath("/")
    revalidatePath("/analysis")
    return { success: true }
}

export async function createRecurringSchedule(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = (formData.get("name") as string | null)?.trim()
    const description = (formData.get("description") as string | null)?.trim() || null
    const note = (formData.get("note") as string | null)?.trim() || null
    const amount = roundMoney(Number(formData.get("amount")))
    const type = formData.get("type") as string
    const frequency = formData.get("frequency") as string
    const interval = Number(formData.get("interval") || 1)
    const nextDate = parseDateInput(formData.get("nextDate") as string | null)
    const endDateValue = formData.get("endDate") as string | null
    const endDate = endDateValue ? parseDateInput(endDateValue) : null
    const categoryId = (formData.get("categoryId") as string | null) || null
    const propertyValue = formData.get("propertyId") as string | null
    const projectValue = formData.get("projectId") as string | null
    const accountValue = formData.get("accountId") as string | null
    const propertyId = propertyValue && propertyValue !== "NONE" ? propertyValue : null
    const projectId = projectValue && projectValue !== "NONE" ? projectValue : null
    const accountId = accountValue && accountValue !== "NONE" ? accountValue : null

    if (!name || name.length > 120 || !Number.isFinite(amount) || amount <= 0) return { error: "Name and a positive amount are required" }
    if (!new Set(["INCOME", "EXPENSE"]).has(type)) return { error: "Invalid transaction type" }
    if (!new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).has(frequency)) return { error: "Invalid frequency" }
    if (!Number.isInteger(interval) || interval < 1 || interval > 365) return { error: "Invalid interval" }
    if (!nextDate || (endDate && endDate < nextDate)) return { error: "Invalid schedule dates" }
    if (accountId && !await prisma.account.findFirst({ where: { id: accountId, userId: session.user.id, isArchived: false } })) return { error: "Account not found" }
    if (projectId && !await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id, isArchived: false } })) return { error: "Project not found" }
    if (propertyId && !await prisma.property.findFirst({ where: { id: propertyId, userId: session.user.id, isArchived: false } })) return { error: "Property not found" }
    if (categoryId && !await prisma.category.findFirst({ where: { id: categoryId, type, isArchived: false } })) return { error: "Category does not match the transaction type" }

    await prisma.recurringSchedule.create({
        data: {
            name, description, note, amountCents: toCents(amount), type, frequency, interval,
            nextDate, endDate, autoPost: true, isActive: true, userId: session.user.id,
            categoryId, propertyId, projectId, accountId,
        },
    })
    revalidatePath("/recurring")
    return { success: true }
}

export async function updateRecurringSchedule(id: string, formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    const name = (formData.get("name") as string | null)?.trim()
    const description = (formData.get("description") as string | null)?.trim() || null
    const note = (formData.get("note") as string | null)?.trim() || null
    const amount = roundMoney(Number(formData.get("amount")))
    const type = formData.get("type") as string
    const frequency = formData.get("frequency") as string
    const interval = Number(formData.get("interval") || 1)
    const nextDate = parseDateInput(formData.get("nextDate") as string | null)
    const endDateValue = formData.get("endDate") as string | null
    const endDate = endDateValue ? parseDateInput(endDateValue) : null
    const categoryId = (formData.get("categoryId") as string | null) || null
    const propertyValue = formData.get("propertyId") as string | null
    const projectValue = formData.get("projectId") as string | null
    const accountValue = formData.get("accountId") as string | null
    const propertyId = propertyValue && propertyValue !== "NONE" ? propertyValue : null
    const projectId = projectValue && projectValue !== "NONE" ? projectValue : null
    const accountId = accountValue && accountValue !== "NONE" ? accountValue : null

    if (!name || !Number.isFinite(amount) || amount <= 0) return { error: "Name and a positive amount are required" }
    if (!new Set(["INCOME", "EXPENSE"]).has(type)) return { error: "Invalid transaction type" }
    if (!new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).has(frequency)) return { error: "Invalid frequency" }
    if (!Number.isInteger(interval) || interval < 1 || interval > 365) return { error: "Invalid interval" }
    if (!nextDate || (endDate && endDate < nextDate)) return { error: "Invalid schedule dates" }

    const existing = await prisma.recurringSchedule.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
    if (!existing) return { error: "Schedule not found" }
    if (accountId && !await prisma.account.findFirst({ where: { id: accountId, userId: session.user.id, isArchived: false } })) return { error: "Account not found" }
    if (projectId && !await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id, isArchived: false } })) return { error: "Project not found" }
    if (propertyId && !await prisma.property.findFirst({ where: { id: propertyId, userId: session.user.id, isArchived: false } })) return { error: "Property not found" }
    if (categoryId && !await prisma.category.findFirst({ where: { id: categoryId, type, isArchived: false } })) return { error: "Category does not match the transaction type" }

    await prisma.recurringSchedule.update({
        where: { id },
        data: { name, description, note, amountCents: toCents(amount), type, frequency, interval, nextDate, endDate, categoryId, propertyId, projectId, accountId },
    })
    revalidatePath("/recurring")
    return { success: true }
}

export async function toggleRecurringSchedule(id: string, isActive: boolean) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const result = await prisma.recurringSchedule.updateMany({ where: { id, userId: session.user.id }, data: { isActive } })
    if (!result.count) return { error: "Schedule not found" }
    revalidatePath("/recurring")
    return { success: true }
}

export async function deleteRecurringSchedule(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    const existing = await prisma.recurringSchedule.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
    if (!existing) return { error: "Schedule not found" }
    await prisma.$transaction([
        prisma.transaction.updateMany({ where: { recurringScheduleId: id, userId: session.user.id }, data: { recurringScheduleId: null } }),
        prisma.recurringSchedule.delete({ where: { id } }),
    ])
    revalidatePath("/recurring")
    return { success: true }
}

export async function getRecurringScheduleHistory(id: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }
    if (!z.string().uuid().safeParse(id).success) return { error: "Invalid schedule" }

    const schedule = await prisma.recurringSchedule.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
    })
    if (!schedule) return { error: "Schedule not found" }

    const [rows, total] = await Promise.all([
        prisma.transaction.findMany({
            where: { recurringScheduleId: id, userId: session.user.id },
            orderBy: { date: "desc" },
            take: 50,
            select: {
                id: true,
                amountCents: true,
                description: true,
                date: true,
                type: true,
                category: { select: { name: true } },
            },
        }),
        prisma.transaction.count({ where: { recurringScheduleId: id, userId: session.user.id } }),
    ])

    return {
        success: true,
        total,
        transactions: rows.map(row => ({
            id: row.id,
            amount: fromCents(row.amountCents),
            description: row.description,
            date: row.date.toISOString(),
            type: row.type,
            category: row.category,
        })),
    }
}

export async function resetAllData() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { error: "Unauthorized" }

    await prisma.$transaction(async tx => {
        await tx.transaction.deleteMany({ where: { userId: session.user.id } })
        await tx.transfer.deleteMany({ where: { userId: session.user.id } })
        await tx.recurringSchedule.deleteMany({ where: { userId: session.user.id } })
        await tx.categoryBudget.deleteMany({ where: { userId: session.user.id } })
        await tx.categoryRule.deleteMany({ where: { userId: session.user.id } })
        await tx.importBatch.deleteMany({ where: { userId: session.user.id } })
        await tx.importProfile.deleteMany({ where: { userId: session.user.id } })
        await tx.project.deleteMany({ where: { userId: session.user.id } })
        await tx.property.deleteMany({ where: { userId: session.user.id } })
        await tx.account.deleteMany({ where: { userId: session.user.id } })
        await tx.account.create({ data: { userId: session.user.id, name: "Legacy / Unassigned", type: "OTHER" } })
        await tx.user.update({
            where: { id: session.user.id },
            data: { monthlyBudgetCents: 200000, currency: "USD", locale: "en-US", timezone: "America/New_York" },
        })
    })
    revalidatePath("/")
    revalidatePath("/analysis")
    return { success: true }
}
