ALTER TABLE "Project" ADD COLUMN "consentGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "consentTimestamp" DATETIME;
ALTER TABLE "Project" ADD COLUMN "consentVersion" TEXT DEFAULT '1.0';
ALTER TABLE "Project" ADD COLUMN "consentLocale" TEXT;
ALTER TABLE "Project" ADD COLUMN "staffPlan" JSONB;
ALTER TABLE "Project" ADD COLUMN "businessProfile" JSONB;
ALTER TABLE "Project" ADD COLUMN "exchangeRateSnapshot" JSONB;

CREATE TABLE "ProjectStaffRole" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "monthlySalaryAmount" REAL NOT NULL,
  "monthlySalaryCurrency" TEXT NOT NULL DEFAULT 'UZS',
  "monthlySalaryUZS" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProjectStaffRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExchangeRate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "currency" TEXT NOT NULL,
  "base" TEXT NOT NULL DEFAULT 'UZS',
  "rate" REAL NOT NULL,
  "date" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ProjectStaffRole_projectId_idx" ON "ProjectStaffRole"("projectId");
CREATE INDEX "ExchangeRate_currency_base_idx" ON "ExchangeRate"("currency", "base");
CREATE INDEX "ExchangeRate_fetchedAt_idx" ON "ExchangeRate"("fetchedAt");
