import test from "node:test"
import assert from "node:assert/strict"
import { detectCSVMapping, mapCSVRows, parseCSVText, parseOFXText } from "../src/lib/statement-import"

test("CSV import detects separate debit and credit columns", () => {
  const csv = parseCSVText("Date,Description,Debit,Credit\n07/01/2026,Groceries,42.19,\n07/02/2026,Paycheck,,1200.50\n")
  const mapping = detectCSVMapping(csv.headers)
  const result = mapCSVRows(csv.rows, mapping)
  assert.equal(result.invalidRows, 0)
  assert.deepEqual(result.transactions.map(item => ({ amount: item.amount, type: item.type })), [
    { amount: 42.19, type: "EXPENSE" },
    { amount: 1200.5, type: "INCOME" },
  ])
})

test("CSV import detects Money Out and Money In headers without manual mapping", () => {
  const csv = parseCSVText("Transaction Date,Description,Money Out (USD),Money In (USD)\n07/06/2026,Utility,88.10,\n07/07/2026,Refund,,12.50\n")
  const mapping = detectCSVMapping(csv.headers)
  assert.equal(mapping.debitColumn, "Money Out (USD)")
  assert.equal(mapping.creditColumn, "Money In (USD)")
  assert.equal(mapping.amountColumn, "")
  assert.deepEqual(mapCSVRows(csv.rows, mapping).transactions.map(item => item.type), ["EXPENSE", "INCOME"])
})

test("Chase-style sales and refunds are detected while payments require review", () => {
  const csv = parseCSVText("Transaction Date,Description,Amount,Type\n07/08/2026,STORE,-20.00,Sale\n07/09/2026,RETURN,5.00,Refund\n07/10/2026,CARD PAYMENT,100.00,Payment\n")
  const result = mapCSVRows(csv.rows, detectCSVMapping(csv.headers)).transactions
  assert.deepEqual(result.map(item => item.type), ["EXPENSE", "INCOME", "INCOME"])
  assert.equal(result[0].reviewReason, undefined)
  assert.match(result[2].reviewReason || "", /transfer/i)
})

test("CSV import understands currency symbols, parentheses, and ISO dates", () => {
  const csv = parseCSVText("Date,Description,Amount\n2026-07-03,Coffee,($5.25)\n")
  const result = mapCSVRows(csv.rows, detectCSVMapping(csv.headers))
  assert.equal(result.transactions[0].type, "EXPENSE")
  assert.equal(result.transactions[0].amount, 5.25)
  assert.match(result.transactions[0].date, /^2026-07-03/)
})

test("OFX/QFX parser preserves FITID and memo", () => {
  const ofx = `<OFX><BANKID>123</BANKID><ACCTID>456</ACCTID><BANKTRANLIST>
  <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260704120000[-5:EST]<TRNAMT>-19.95<FITID>txn-1<NAME>MARKET<MEMO>Weekly shop</STMTTRN>
  <STMTTRN><TRNTYPE>DIRECTDEP<DTPOSTED>20260705120000<TRNAMT>500<FITID>txn-2<NAME>PAYROLL</STMTTRN>
  </BANKTRANLIST></OFX>`
  const result = parseOFXText(ofx)
  assert.equal(result.length, 2)
  assert.deepEqual(result.map(item => item.type), ["EXPENSE", "INCOME"])
  assert.equal(result[0].externalId, "123:456:txn-1")
  assert.equal(result[0].note, "Weekly shop")
})
