import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { createDatabaseBackup, restoreDatabaseBackup } from "../scripts/database-utils.mjs"

function deploy(schemaPath: string, databaseUrl: string) {
  const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js")
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe",
  })
}

test("existing Float database migrates to exact cents and restores from backup", { timeout: 120000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "icost-migration-test-"))
  const migrations = path.join(directory, "migrations")
  fs.mkdirSync(migrations)
  const schemaPath = path.join(directory, "schema.prisma")
  fs.copyFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), schemaPath)
  fs.copyFileSync(path.join(process.cwd(), "prisma", "migrations", "migration_lock.toml"), path.join(migrations, "migration_lock.toml"))
  for (const name of ["20260716150000_existing_baseline", "20260716151000_product_foundation"]) {
    fs.cpSync(path.join(process.cwd(), "prisma", "migrations", name), path.join(migrations, name), { recursive: true })
  }
  const databasePath = path.join(directory, "upgrade.db")
  fs.closeSync(fs.openSync(databasePath, "w"))
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`
  try {
    deploy(schemaPath, databaseUrl)
    let prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    await prisma.$executeRawUnsafe(`INSERT INTO "User" ("id","username","password","monthlyBudget") VALUES ('u1','test','hash',1234.56)`)
    await prisma.$executeRawUnsafe(`INSERT INTO "Category" ("id","name","type") VALUES ('c1','Test Expense','EXPENSE')`)
    await prisma.$executeRawUnsafe(`INSERT INTO "Transaction" ("id","amount","description","date","type","categoryId","userId") VALUES ('t1',10.29,'Migration test','2026-01-01 12:00:00','EXPENSE','c1','u1')`)
    await prisma.$disconnect()

    const centsMigration = "20260716210000_integer_cents_and_import_profiles"
    fs.cpSync(path.join(process.cwd(), "prisma", "migrations", centsMigration), path.join(migrations, centsMigration), { recursive: true })
    const statementMigration = "20260716230000_statement_file_imports"
    fs.cpSync(path.join(process.cwd(), "prisma", "migrations", statementMigration), path.join(migrations, statementMigration), { recursive: true })
    const reviewMigration = "20260717010000_transaction_review_reasons"
    fs.cpSync(path.join(process.cwd(), "prisma", "migrations", reviewMigration), path.join(migrations, reviewMigration), { recursive: true })
    deploy(schemaPath, databaseUrl)
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: "t1" } })
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "u1" } })
    assert.equal(transaction.amountCents, 1029)
    assert.equal(user.monthlyBudgetCents, 123456)
    await prisma.$disconnect()

    const backup = createDatabaseBackup(databasePath)
    assert.ok(backup)
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    await prisma.transaction.delete({ where: { id: "t1" } })
    await prisma.$disconnect()
    restoreDatabaseBackup(backup!, databasePath)
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    assert.equal(await prisma.transaction.count(), 1)
    await prisma.$disconnect()
  } finally {
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})
