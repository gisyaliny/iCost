import Papa from "papaparse"
import { roundMoney } from "@/lib/money"

export type ImportTransaction = {
  date: string
  description: string
  note?: string
  amount: number
  type: "INCOME" | "EXPENSE"
  externalId?: string
  categoryId?: string
  reviewReason?: string
}

export type CSVMapping = {
  dateColumn: string
  descriptionColumn: string
  amountColumn: string
  debitColumn: string
  creditColumn: string
  typeColumn: string
}

export type CSVRows = {
  headers: string[]
  rows: Record<string, string>[]
  warnings: string[]
}

export const EMPTY_CSV_MAPPING: CSVMapping = {
  dateColumn: "",
  descriptionColumn: "",
  amountColumn: "",
  debitColumn: "NONE",
  creditColumn: "NONE",
  typeColumn: "NONE",
}

export function statementFileType(filename: string): "csv" | "ofx" | "qfx" | null {
  const extension = filename.toLowerCase().split(".").pop()
  if (extension === "csv" || extension === "ofx" || extension === "qfx") return extension
  return null
}

export function parseCSVText(text: string): CSVRows {
  const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: header => header.trim(),
  })
  return {
    headers: result.meta.fields || Object.keys(result.data[0] || {}),
    rows: result.data,
    warnings: result.errors.map(error => error.message),
  }
}

export function detectCSVMapping(columns: string[]): CSVMapping {
  const normalized = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
  const find = (candidates: string[]) => columns.find(column => candidates.some(candidate => normalized(column) === candidate || normalized(column).includes(candidate))) || ""
  const findCombinedAmount = () => columns.find(column => {
    const header = normalized(column)
    return (header === "amount" || header === "value" || header === "transaction amount" || header === "amount (usd)") && !/debit|credit|money in|money out/.test(header)
  }) || ""
  return {
    dateColumn: find(["posting date", "posted date", "transaction date", "date", "date (utc)", "trans_date"]),
    descriptionColumn: find(["transaction description", "description", "descriptio", "memo", "trans_desc", "payee", "merchant", "details", "name"]),
    amountColumn: findCombinedAmount(),
    debitColumn: find(["money out", "debit amount", "debit", "withdrawal", "withdrawals", "paid out", "outflow"]) || "NONE",
    creditColumn: find(["money in", "credit amount", "credit", "deposit", "deposits", "paid in", "inflow"]) || "NONE",
    typeColumn: find(["type", "transaction type", "debit/credit", "dr/cr"]) || "NONE",
  }
}

function parseStatementDate(value: string) {
  const clean = value.trim()
  let match = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  match = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3])
    return new Date(Date.UTC(year, Number(match[1]) - 1, Number(match[2]), 12))
  }
  const parsed = new Date(clean)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseMoney(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const negative = (raw.startsWith("(") && raw.endsWith(")")) || raw.includes("-")
  const amount = Number.parseFloat(raw.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(amount)) return null
  return { amount: roundMoney(Math.abs(amount)), negative }
}

export function mapCSVRows(rows: Record<string, string>[], mapping: CSVMapping) {
  const transactions: ImportTransaction[] = []
  let invalidRows = 0

  for (const row of rows) {
    const date = parseStatementDate(row[mapping.dateColumn] || "")
    const description = row[mapping.descriptionColumn]?.trim() || "Imported Transaction"
    const debit = mapping.debitColumn !== "NONE" ? parseMoney(row[mapping.debitColumn]) : null
    const credit = mapping.creditColumn !== "NONE" ? parseMoney(row[mapping.creditColumn]) : null
    const combined = mapping.amountColumn ? parseMoney(row[mapping.amountColumn]) : null
    const money = debit?.amount ? debit : credit?.amount ? credit : combined
    if (!date || !money || money.amount <= 0) {
      invalidRows += 1
      continue
    }

    let type: "INCOME" | "EXPENSE" = debit?.amount ? "EXPENSE" : credit?.amount ? "INCOME" : money.negative ? "EXPENSE" : "INCOME"
    let reviewReason: string | undefined
    const explicitType = mapping.typeColumn !== "NONE" ? (row[mapping.typeColumn] || "").toUpperCase() : ""
    if (/DEBIT|EXPENSE|WITHDRAW|CHARGE|SALE|PURCHASE|FEE/.test(explicitType)) type = "EXPENSE"
    if (/CREDIT|INCOME|DEPOSIT|REFUND|RETURN|REVERSAL/.test(explicitType)) type = "INCOME"
    if (/PAYMENT|TRANSFER/.test(explicitType)) reviewReason = `“${explicitType}” may be a transfer. Verify Money In / Money Out.`
    if (debit?.amount && credit?.amount) reviewReason = "Both Money In and Money Out contain values. Verify this transaction."
    if (!debit?.amount && !credit?.amount && !money.negative && !explicitType) reviewReason = "Positive amount has no recognized Money In / Money Out indicator."
    transactions.push({ date: date.toISOString(), description, amount: money.amount, type, reviewReason })
  }
  return { transactions, invalidRows }
}

function ofxValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>\\s*([^<\\r\\n]+)`, "i"))
  return match?.[1]?.trim() || ""
}

function parseOFXDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
}

export function parseOFXText(text: string): ImportTransaction[] {
  const bankId = ofxValue(text, "BANKID") || ofxValue(text, "ORG") || "bank"
  const accountId = ofxValue(text, "ACCTID") || ofxValue(text, "ACCTKEY") || "account"
  const blocks = text.match(/<STMTTRN\b[^>]*>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN\b|<\/BANKTRANLIST>|<\/CCSTMTTRNRS>)/gi) || []

  return blocks.flatMap(block => {
    const date = parseOFXDate(ofxValue(block, "DTPOSTED") || ofxValue(block, "DTUSER"))
    const rawAmount = Number(ofxValue(block, "TRNAMT"))
    if (!date || !Number.isFinite(rawAmount) || rawAmount === 0) return []
    const name = ofxValue(block, "NAME")
    const memo = ofxValue(block, "MEMO")
    const payee = ofxValue(block, "PAYEEID")
    const fitId = ofxValue(block, "FITID")
    const transactionType = ofxValue(block, "TRNTYPE").toUpperCase()
    let type: "INCOME" | "EXPENSE" = rawAmount < 0 ? "EXPENSE" : "INCOME"
    if (/DEBIT|CHECK|PAYMENT|CASH|FEE/.test(transactionType)) type = "EXPENSE"
    if (/CREDIT|DEP|DIRECTDEP|INTEREST|DIV/.test(transactionType)) type = "INCOME"
    return [{
      date: date.toISOString(),
      description: name || memo || payee || "Imported Transaction",
      note: name && memo && name !== memo ? memo : undefined,
      amount: roundMoney(Math.abs(rawAmount)),
      type,
      externalId: fitId ? `${bankId}:${accountId}:${fitId}` : undefined,
    }]
  })
}

export function parseStatementText(filename: string, text: string, mapping?: CSVMapping) {
  const type = statementFileType(filename)
  if (!type) throw new Error("Only CSV, OFX, and QFX files are supported.")
  if (type === "ofx" || type === "qfx") {
    return { type, transactions: parseOFXText(text), invalidRows: 0, csv: null }
  }
  const csv = parseCSVText(text)
  if (!mapping) return { type, transactions: [] as ImportTransaction[], invalidRows: 0, csv }
  const parsed = mapCSVRows(csv.rows, mapping)
  return { type, ...parsed, csv }
}
