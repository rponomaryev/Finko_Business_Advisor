import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

loadLocalEnv();

const prisma = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "sectorCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "businessType" TEXT,
    "region" TEXT,
    "district" TEXT,
    "plannedStartPeriod" TEXT,
    "userLanguage" TEXT DEFAULT 'ru',
    "businessIdea" TEXT,
    "productionType" TEXT,
    "toyType" TEXT,
    "premisesStatus" TEXT,
    "equipmentCondition" TEXT,
    "monthlyCapacity" INTEGER,
    "averagePrice" REAL,
    "targetCustomers" TEXT,
    "rawMaterialSource" TEXT,
    "certificationAwareness" TEXT,
    "supplierSelected" BOOLEAN,
    "ownContribution" REAL,
    "sectionNotes" JSONB,
    "ownContributionAmount" REAL,
    "ownContributionCurrency" TEXT,
    "ownContributionUZS" REAL,
    "exchangeRateUZSPerUSD" REAL,
    "creditNeeded" TEXT,
    "requestedLoanAmount" REAL,
    "requestedLoanCurrency" TEXT,
    "requestedLoanUZS" REAL,
    "loanPurpose" TEXT,
    "loanTermMonths" INTEGER,
    "requestedLeasingAmount" REAL,
    "collateralAvailable" BOOLEAN,
    "collateralType" TEXT,
    "collateralEstimatedValue" REAL,
    "experienceLevel" TEXT,
    "aiMode" TEXT,
    "aiExtraction" JSONB,
    "templateData" JSONB,
    "structuredData" JSONB,
    "financialResult" JSONB,
    "riskResult" JSONB,
    "feasibilityScore" REAL,
    "bankReadinessScore" REAL,
    "reportData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ProjectAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "answerType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAnswer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "SectorTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assumptions" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "riskRules" JSONB NOT NULL,
    "scoringRules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "MarketDataPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sector" TEXT NOT NULL,
    "businessType" TEXT,
    "indicator" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "region" TEXT,
    "value" REAL,
    "unit" TEXT,
    "currency" TEXT,
    "hsCode" TEXT,
    "activityCode" TEXT,
    "tradeType" TEXT,
    "country" TEXT,
    "productCategory" TEXT,
    "valueUsd" REAL,
    "volume" REAL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceType" TEXT NOT NULL,
    "lastUpdated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_sector_idx" ON "MarketDataPoint"("sector")`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_businessType_idx" ON "MarketDataPoint"("businessType")`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_indicator_idx" ON "MarketDataPoint"("indicator")`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_year_idx" ON "MarketDataPoint"("year")`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_region_idx" ON "MarketDataPoint"("region")`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_hsCode_idx" ON "MarketDataPoint"("hsCode")`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_tradeType_idx" ON "MarketDataPoint"("tradeType")`,
  `CREATE INDEX IF NOT EXISTS "MarketDataPoint_country_idx" ON "MarketDataPoint"("country")`,
  `CREATE TABLE IF NOT EXISTS "SectorMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessType" TEXT NOT NULL,
    "normalizedSector" TEXT NOT NULL,
    "possibleHsCodesJson" TEXT,
    "possibleActivityJson" TEXT,
    "keywordsJson" TEXT,
    "confidence" TEXT NOT NULL,
    "mappingSource" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "SectorMapping_businessType_idx" ON "SectorMapping"("businessType")`,
  `CREATE INDEX IF NOT EXISTS "SectorMapping_normalizedSector_idx" ON "SectorMapping"("normalizedSector")`,

  `ALTER TABLE "Project" ADD COLUMN "businessType" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "plannedStartPeriod" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "templateData" JSONB`,
  `ALTER TABLE "Project" ADD COLUMN "userLanguage" TEXT DEFAULT 'ru'`,
  `ALTER TABLE "Project" ADD COLUMN "sectionNotes" JSONB`,
  `ALTER TABLE "Project" ADD COLUMN "ownContributionAmount" REAL`,
  `ALTER TABLE "Project" ADD COLUMN "ownContributionCurrency" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "ownContributionUZS" REAL`,
  `ALTER TABLE "Project" ADD COLUMN "exchangeRateUZSPerUSD" REAL`,
  `ALTER TABLE "Project" ADD COLUMN "creditNeeded" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "requestedLoanCurrency" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "requestedLoanUZS" REAL`,
  `ALTER TABLE "Project" ADD COLUMN "loanPurpose" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "loanTermMonths" INTEGER`,
  `ALTER TABLE "Project" ADD COLUMN "collateralType" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "collateralEstimatedValue" REAL`,
  `ALTER TABLE "ProjectAnswer" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `DELETE FROM "ProjectAnswer" WHERE "id" NOT IN (SELECT MIN("id") FROM "ProjectAnswer" GROUP BY "projectId", "questionKey")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAnswer_projectId_questionKey_key" ON "ProjectAnswer"("projectId", "questionKey")`,
  `ALTER TABLE "MarketDataPoint" ADD COLUMN "tradeType" TEXT`,
  `ALTER TABLE "MarketDataPoint" ADD COLUMN "country" TEXT`,
  `ALTER TABLE "MarketDataPoint" ADD COLUMN "productCategory" TEXT`,
  `ALTER TABLE "MarketDataPoint" ADD COLUMN "valueUsd" REAL`,
  `ALTER TABLE "MarketDataPoint" ADD COLUMN "volume" REAL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SectorTemplate_code_key" ON "SectorTemplate"("code")`,
  `CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Report_projectId_key" ON "Report"("projectId")`,

  `ALTER TABLE "Project" ADD COLUMN "consentGiven" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Project" ADD COLUMN "consentTimestamp" DATETIME`,
  `ALTER TABLE "Project" ADD COLUMN "consentVersion" TEXT DEFAULT '1.0'`,
  `ALTER TABLE "Project" ADD COLUMN "consentLocale" TEXT`,
  `ALTER TABLE "Project" ADD COLUMN "staffPlan" JSONB`,
  `ALTER TABLE "Project" ADD COLUMN "businessProfile" JSONB`,
  `ALTER TABLE "Project" ADD COLUMN "exchangeRateSnapshot" JSONB`,
  `ALTER TABLE "Project" ADD COLUMN "financialResult" JSONB`,
  `ALTER TABLE "Project" ADD COLUMN "riskResult" JSONB`,
  `ALTER TABLE "Project" ADD COLUMN "feasibilityScore" REAL`,
  `ALTER TABLE "Project" ADD COLUMN "bankReadinessScore" REAL`,
  `ALTER TABLE "Project" ADD COLUMN "reportData" JSONB`,
  `ALTER TABLE "SectorTemplate" ADD COLUMN "businessType" TEXT`,
  `ALTER TABLE "SectorTemplate" ADD COLUMN "requiredInputs" JSONB`,
  `CREATE TABLE IF NOT EXISTS "ProjectStaffRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "monthlySalaryAmount" REAL NOT NULL,
    "monthlySalaryCurrency" TEXT NOT NULL DEFAULT 'UZS',
    "monthlySalaryUZS" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectStaffRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "ProjectStaffRole_projectId_idx" ON "ProjectStaffRole"("projectId")`,
  `CREATE TABLE IF NOT EXISTS "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currency" TEXT NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'UZS',
    "rate" REAL NOT NULL,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "ExchangeRate_currency_base_idx" ON "ExchangeRate"("currency", "base")`,
  `CREATE INDEX IF NOT EXISTS "ExchangeRate_fetchedAt_idx" ON "ExchangeRate"("fetchedAt")`,
];

async function main() {
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (error) {
      if (!String(error).includes("duplicate column name")) throw error;
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("SQLite database bootstrapped.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
