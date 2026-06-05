CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Project" (
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
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProjectAnswer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "answerType" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ProjectAnswer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAnswer_projectId_questionKey_key" ON "ProjectAnswer"("projectId", "questionKey");

CREATE TABLE IF NOT EXISTS "SectorTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "businessType" TEXT,
  "requiredInputs" JSONB,
  "assumptions" JSONB NOT NULL,
  "questions" JSONB NOT NULL,
  "riskRules" JSONB NOT NULL,
  "scoringRules" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "SectorTemplate_code_key" ON "SectorTemplate"("code");

CREATE TABLE IF NOT EXISTS "Report" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Report_projectId_key" ON "Report"("projectId");

CREATE TABLE IF NOT EXISTS "MarketDataPoint" (
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
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceType" TEXT NOT NULL,
  "lastUpdated" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "MarketDataPoint_sector_idx" ON "MarketDataPoint"("sector");
CREATE INDEX IF NOT EXISTS "MarketDataPoint_businessType_idx" ON "MarketDataPoint"("businessType");
CREATE INDEX IF NOT EXISTS "MarketDataPoint_indicator_idx" ON "MarketDataPoint"("indicator");
CREATE INDEX IF NOT EXISTS "MarketDataPoint_year_idx" ON "MarketDataPoint"("year");
CREATE INDEX IF NOT EXISTS "MarketDataPoint_region_idx" ON "MarketDataPoint"("region");
CREATE INDEX IF NOT EXISTS "MarketDataPoint_hsCode_idx" ON "MarketDataPoint"("hsCode");
CREATE INDEX IF NOT EXISTS "MarketDataPoint_tradeType_idx" ON "MarketDataPoint"("tradeType");
CREATE INDEX IF NOT EXISTS "MarketDataPoint_country_idx" ON "MarketDataPoint"("country");

CREATE TABLE IF NOT EXISTS "SectorMapping" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessType" TEXT NOT NULL,
  "normalizedSector" TEXT NOT NULL,
  "possibleHsCodesJson" TEXT,
  "possibleActivityJson" TEXT,
  "keywordsJson" TEXT,
  "confidence" TEXT NOT NULL,
  "mappingSource" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "SectorMapping_businessType_idx" ON "SectorMapping"("businessType");
CREATE INDEX IF NOT EXISTS "SectorMapping_normalizedSector_idx" ON "SectorMapping"("normalizedSector");
