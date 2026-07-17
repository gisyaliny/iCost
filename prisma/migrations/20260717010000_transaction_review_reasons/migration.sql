ALTER TABLE "Transaction" ADD COLUMN "reviewReason" TEXT;

UPDATE "Transaction"
SET "reviewReason" = 'Verify Money In / Money Out and category before approval.'
WHERE "reviewed" = 0
  AND "source" IN ('CSV_IMPORT', 'OFX_IMPORT', 'QFX_IMPORT');
