ALTER TABLE "Transaction" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Transaction_userId_externalId_key" ON "Transaction"("userId", "externalId");

ALTER TABLE "ImportBatch" ADD COLUMN "fileHash" TEXT;
ALTER TABLE "ImportBatch" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'UPLOAD';
CREATE UNIQUE INDEX "ImportBatch_userId_fileHash_key" ON "ImportBatch"("userId", "fileHash");

ALTER TABLE "ImportProfile" ADD COLUMN "debitColumn" TEXT;
ALTER TABLE "ImportProfile" ADD COLUMN "creditColumn" TEXT;
