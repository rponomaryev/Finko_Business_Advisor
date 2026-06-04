import "server-only";

export function safeProjectListDto(project: Record<string, unknown>) {
  const structuredData = project.structuredData && typeof project.structuredData === "object"
    ? project.structuredData as Record<string, unknown>
    : {};
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    summary: {
      businessType: project.businessType ?? structuredData.businessType,
      region: project.region ?? structuredData.region,
      businessIdea: project.businessIdea ?? structuredData.businessIdea
    },
    progress: typeof structuredData.progress === "number" ? structuredData.progress : undefined
  };
}

export function safeProjectDetailDto(project: Record<string, unknown>) {
  return {
    id: project.id,
    title: project.title,
    sectorCode: project.sectorCode,
    status: project.status,
    userLanguage: project.userLanguage,
    businessType: project.businessType,
    region: project.region,
    district: project.district,
    plannedStartPeriod: project.plannedStartPeriod,
    businessIdea: project.businessIdea,
    productionType: project.productionType,
    toyType: project.toyType,
    premisesStatus: project.premisesStatus,
    equipmentCondition: project.equipmentCondition,
    monthlyCapacity: project.monthlyCapacity,
    averagePrice: project.averagePrice,
    targetCustomers: project.targetCustomers,
    rawMaterialSource: project.rawMaterialSource,
    certificationAwareness: project.certificationAwareness,
    supplierSelected: project.supplierSelected,
    ownContribution: project.ownContribution,
    ownContributionAmount: project.ownContributionAmount,
    ownContributionCurrency: project.ownContributionCurrency,
    ownContributionUZS: project.ownContributionUZS,
    exchangeRateUZSPerUSD: project.exchangeRateUZSPerUSD,
    creditNeeded: project.creditNeeded,
    requestedLoanAmount: project.requestedLoanAmount,
    requestedLoanCurrency: project.requestedLoanCurrency,
    requestedLoanUZS: project.requestedLoanUZS,
    loanPurpose: project.loanPurpose,
    loanTermMonths: project.loanTermMonths,
    requestedLeasingAmount: project.requestedLeasingAmount,
    collateralAvailable: project.collateralAvailable,
    collateralType: project.collateralType,
    collateralEstimatedValue: project.collateralEstimatedValue,
    experienceLevel: project.experienceLevel,
    aiMode: project.aiMode,
    structuredData: project.structuredData,
    sectionNotes: project.sectionNotes,
    staffPlan: project.staffPlan,
    businessProfile: project.businessProfile,
    exchangeRateSnapshot: project.exchangeRateSnapshot,
    financialResult: project.financialResult,
    riskResult: project.riskResult,
    feasibilityScore: project.feasibilityScore,
    bankReadinessScore: project.bankReadinessScore,
    reportData: project.reportData,
    consentGiven: project.consentGiven,
    consentTimestamp: project.consentTimestamp,
    consentVersion: project.consentVersion,
    consentLocale: project.consentLocale,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

export function safeReportDto(report: unknown) {
  return report && typeof report === "object" ? report : null;
}

export function safeMarketDataDto(data: unknown) {
  return data && typeof data === "object" ? data : { dataPoints: [], sources: [] };
}
