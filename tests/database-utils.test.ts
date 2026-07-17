import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createDatabaseBackup, restoreDatabaseBackup } from "../scripts/database-utils.mjs"

test("native backup and restore preserve database and WAL companions", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "icost-backup-test-"))
  try {
    const database = path.join(directory, "db.sqlite")
    fs.writeFileSync(database, "database-before")
    fs.writeFileSync(`${database}-wal`, "wal-before")
    const backup = createDatabaseBackup(database, { now: new Date("2026-01-02T03:04:05Z") })
    assert.ok(backup)
    fs.writeFileSync(database, "database-after")
    fs.writeFileSync(`${database}-wal`, "wal-after")
    restoreDatabaseBackup(backup!, database)
    assert.equal(fs.readFileSync(database, "utf8"), "database-before")
    assert.equal(fs.readFileSync(`${database}-wal`, "utf8"), "wal-before")
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
