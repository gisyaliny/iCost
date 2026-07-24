import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Hot reload can retain a Prisma instance generated from an older schema.
// Recreate it when a newly added model delegate is missing.
const cachedPrisma = globalForPrisma.prisma
const hasCurrentSchema = cachedPrisma
    && typeof cachedPrisma.project !== 'undefined'
    && typeof cachedPrisma.account !== 'undefined'
    && typeof cachedPrisma.recurringSchedule !== 'undefined'
export const prisma = hasCurrentSchema ? cachedPrisma : new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
