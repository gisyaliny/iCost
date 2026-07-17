import fs from "node:fs"
import path from "node:path"

export function resolveDatabasePath(databaseUrl = process.env.DATABASE_URL, cwd = process.cwd()) {
  const raw = databaseUrl?.replace(/^['"]|['"]$/g, "")
  if (!raw?.startsWith("file:")) throw new Error("DATABASE_URL must be a file: URL for SQLite")
  const configuredPath = raw.slice("file:".length)
  if (path.isAbsolute(configuredPath)) return configuredPath
  return path.resolve(cwd, "prisma", configuredPath)
}

export function createDatabaseBackup(databasePath, { keep = 14, now = new Date() } = {}) {
  if (!fs.existsSync(databasePath) || fs.statSync(databasePath).size === 0) return null
  const backupDir = path.join(path.dirname(databasePath), "backups")
  fs.mkdirSync(backupDir, { recursive: true })
  const timestamp = now.toISOString().replace(/[:.]/g, "-")
  const backupBase = path.join(backupDir, `icost-${timestamp}.db`)
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${databasePath}${suffix}`
    if (fs.existsSync(source)) fs.copyFileSync(source, `${backupBase}${suffix}`)
  }
  const backups = fs.readdirSync(backupDir).filter(name => name.endsWith(".db")).sort().reverse()
  for (const oldBackup of backups.slice(keep)) {
    const oldBase = path.join(backupDir, oldBackup)
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = `${oldBase}${suffix}`
      if (fs.existsSync(file)) fs.rmSync(file)
    }
  }
  return backupBase
}

export function restoreDatabaseBackup(backupPath, databasePath) {
  if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) throw new Error("Backup file is missing or empty")
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const temporaryPath = `${databasePath}.restore-tmp`
  fs.copyFileSync(backupPath, temporaryPath)
  fs.renameSync(temporaryPath, databasePath)
  for (const suffix of ["-wal", "-shm"]) {
    const liveCompanion = `${databasePath}${suffix}`
    const backupCompanion = `${backupPath}${suffix}`
    if (fs.existsSync(liveCompanion)) fs.rmSync(liveCompanion)
    if (fs.existsSync(backupCompanion)) fs.copyFileSync(backupCompanion, liveCompanion)
  }
}
