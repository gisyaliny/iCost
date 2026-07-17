-- Monetary values are stored as integer cents from this migration onward.
-- The UPDATE statements preserve every existing value before the legacy
-- floating-point columns are removed.

ALTER TABLE "User" ADD COLUMN "monthlyBudgetCents" INTEGER NOT NULL DEFAULT 200000;
UPDATE "User" SET "monthlyBudgetCents" = CAST(ROUND("monthlyBudget" * 100.0) AS INTEGER);
ALTER TABLE "User" DROP COLUMN "monthlyBudget";

ALTER TABLE "Project" ADD COLUMN "budgetCents" INTEGER;
UPDATE "Project" SET "budgetCents" = CASE WHEN "budget" IS NULL THEN NULL ELSE CAST(ROUND("budget" * 100.0) AS INTEGER) END;
ALTER TABLE "Project" DROP COLUMN "budget";

ALTER TABLE "Transaction" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "Transaction" SET "amountCents" = CAST(ROUND("amount" * 100.0) AS INTEGER);
ALTER TABLE "Transaction" DROP COLUMN "amount";

ALTER TABLE "Account" ADD COLUMN "openingBalanceCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "Account" SET "openingBalanceCents" = CAST(ROUND("openingBalance" * 100.0) AS INTEGER);
ALTER TABLE "Account" DROP COLUMN "openingBalance";

ALTER TABLE "Transfer" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "Transfer" SET "amountCents" = CAST(ROUND("amount" * 100.0) AS INTEGER);
ALTER TABLE "Transfer" DROP COLUMN "amount";

ALTER TABLE "CategoryBudget" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "CategoryBudget" SET "amountCents" = CAST(ROUND("amount" * 100.0) AS INTEGER);
ALTER TABLE "CategoryBudget" DROP COLUMN "amount";

ALTER TABLE "RecurringSchedule" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "RecurringSchedule" SET "amountCents" = CAST(ROUND("amount" * 100.0) AS INTEGER);
ALTER TABLE "RecurringSchedule" DROP COLUMN "amount";

CREATE TABLE "ImportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "dateColumn" TEXT NOT NULL,
    "descriptionColumn" TEXT NOT NULL,
    "amountColumn" TEXT NOT NULL,
    "typeColumn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ImportProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ImportProfile_userId_name_key" ON "ImportProfile"("userId", "name");
