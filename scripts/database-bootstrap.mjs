import { PrismaClient } from "@prisma/client"
import { createDatabaseBackup, resolveDatabasePath } from "./database-utils.mjs"

const databasePath = resolveDatabasePath()
const backupPath = createDatabaseBackup(databasePath)
if (backupPath) console.log(`Database backup created: ${backupPath}`)

const prisma = new PrismaClient()
try {
  const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table'")
  const names = new Set(tables.map(table => table.name))
  if (names.has("User") && !names.has("_prisma_migrations")) {
    console.log("Existing pre-migration database detected; baseline is required.")
    process.exitCode = 10
  }
} finally {
  await prisma.$disconnect()
}
