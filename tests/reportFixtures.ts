import { calculateAll } from "../src/lib/calculator/financialCalculator.ts";
import { buildGenericBusinessTemplate } from "../src/lib/data/sectorTemplates/genericBusinessTemplate.ts";
import { generateRiskMatrix } from "../src/lib/scoring/riskEngine.ts";
import { calculateBankReadinessScore, calculateFeasibilityScore } from "../src/lib/scoring/scoringService.ts";
import { buildReportData } from "../src/lib/services/reportService.ts";
import type { StructuredProjectData } from "../src/lib/types/project.ts";

export function createExportProject(userLanguage: "ru" | "uz" | "en" = "ru") {
  const template = buildGenericBusinessTemplate("Кофейня");
  const structuredData: StructuredProjectData = {
    userLanguage,
    businessType: "Кофейня",
    businessIdea: "Хочу открыть небольшую кофейню возле университета",
    sectorCode: template.code,
    templateCode: template.code,
    region: "Ташкент город",
    district: "Юнусабад",
    plannedStartPeriod: "через 2 месяца",
    productOrService: "Кофе, чай и десерты навынос",
    premisesStatus: "rent",
    equipmentCondition: "new",
    monthlyCapacity: 2800,
    salesUnitLabel: "заказов/мес.",
    averagePrice: 28000,
    rawMaterialSource: "mixed",
    targetCustomers: ["walk_in", "students", "delivery"],
    certificationAwareness: "partly_aware",
    ownContributionAmount: 120000000,
    ownContributionCurrency: "UZS",
    ownContributionUZS: 120000000,
    ownContribution: 120000000,
    exchangeRateUZSPerUSD: 12600,
    creditNeeded: "yes",
    requestedLoanAmount: 180000000,
    requestedLoanCurrency: "UZS",
    requestedLoanUZS: 180000000,
    loanTermMonths: 36,
    collateralAvailable: true,
    collateralEstimatedValue: 160000000,
    experienceLevel: "medium",
    employeesCount: 5,
    stableMonthlyRevenue: 78000000,
    sectionNotes: {
      businessIdea: "Кофейня рядом с университетом для студентов и офисных сотрудников.",
      premisesInfrastructure: "Арендное помещение 60 м2 с хорошим пешеходным трафиком.",
      equipment: "Новая кофемашина, холодильник, POS и мебель с коммерческим предложением.",
      productionCapacity: "Около 2800 заказов в месяц, команда из пяти сотрудников.",
      rawMaterials: "Кофе, молоко, десерты и упаковка от нескольких поставщиков.",
      salesMarketing: "Продажи через точку, доставку и локальные партнерства.",
      finance: "Собственные средства 120 млн сум и кредит 180 млн сум.",
      complianceExperience: "Есть бухгалтер и базовое понимание требований общепита."
    }
  };

  const financial = calculateAll(structuredData, template.assumptions);
  const risks = generateRiskMatrix(structuredData);
  const feasibilityScore = calculateFeasibilityScore(structuredData, financial, risks);
  const bankReadinessScore = calculateBankReadinessScore(structuredData, financial, risks);
  const reportData = buildReportData({
    project: {
      ...structuredData,
      title: "Кофейня — Ташкент город",
      sectorCode: template.code
    },
    financial,
    risks,
    feasibilityScore,
    bankReadinessScore
  });

  return {
    id: "project-export-test",
    title: "Кофейня — Ташкент город",
    sectorCode: template.code,
    status: "calculated",
    businessType: structuredData.businessType,
    userLanguage,
    structuredData,
    region: structuredData.region,
    district: structuredData.district,
    plannedStartPeriod: structuredData.plannedStartPeriod,
    financialResult: financial,
    riskResult: risks,
    feasibilityScore,
    bankReadinessScore,
    reportData
  };
}
