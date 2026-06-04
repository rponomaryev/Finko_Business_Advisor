import type { StructuredProjectData } from "../types/project.ts";

function parseCustomers(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
}

export function getProjectProfile(project: Record<string, unknown>): StructuredProjectData {
  const structured =
    project.structuredData && typeof project.structuredData === "object"
      ? (project.structuredData as StructuredProjectData)
      : {};

  return {
    ...structured,
    userLanguage: (project.userLanguage as "ru" | "uz" | "en" | undefined) ?? structured.userLanguage ?? "ru",
    businessType: (project.businessType as string | undefined) ?? structured.businessType,
    businessIdea: (project.businessIdea as string | undefined) ?? structured.businessIdea,
    region: (project.region as string | undefined) ?? structured.region,
    district: (project.district as string | undefined) ?? structured.district,
    plannedStartPeriod: (project.plannedStartPeriod as string | undefined) ?? structured.plannedStartPeriod,
    productionType: (project.productionType as string | undefined) ?? structured.productionType,
    toyType: (project.toyType as string | undefined) ?? structured.toyType,
    premisesStatus: (project.premisesStatus as string | undefined) ?? structured.premisesStatus,
    equipmentCondition: (project.equipmentCondition as string | undefined) ?? structured.equipmentCondition,
    monthlyCapacity: (project.monthlyCapacity as number | undefined) ?? structured.monthlyCapacity,
    averagePrice: (project.averagePrice as number | undefined) ?? structured.averagePrice,
    targetCustomers: parseCustomers(project.targetCustomers) ?? structured.targetCustomers,
    rawMaterialSource: (project.rawMaterialSource as string | undefined) ?? structured.rawMaterialSource,
    certificationAwareness: (project.certificationAwareness as string | undefined) ?? structured.certificationAwareness,
    supplierSelected: (project.supplierSelected as boolean | undefined) ?? structured.supplierSelected,
    ownContribution: (project.ownContribution as number | undefined) ?? structured.ownContribution,
    ownContributionAmount: (project.ownContributionAmount as number | undefined) ?? structured.ownContributionAmount,
    ownContributionCurrency: (project.ownContributionCurrency as "UZS" | "USD" | undefined) ?? structured.ownContributionCurrency,
    ownContributionUZS: (project.ownContributionUZS as number | undefined) ?? structured.ownContributionUZS,
    exchangeRateUZSPerUSD: (project.exchangeRateUZSPerUSD as number | undefined) ?? structured.exchangeRateUZSPerUSD,
    creditNeeded: (project.creditNeeded as "yes" | "no" | "unknown" | undefined) ?? structured.creditNeeded,
    requestedLoanAmount: (project.requestedLoanAmount as number | undefined) ?? structured.requestedLoanAmount,
    requestedLoanCurrency: (project.requestedLoanCurrency as "UZS" | "USD" | undefined) ?? structured.requestedLoanCurrency,
    requestedLoanUZS: (project.requestedLoanUZS as number | undefined) ?? structured.requestedLoanUZS,
    loanPurpose: (project.loanPurpose as string | undefined) ?? structured.loanPurpose,
    loanTermMonths: (project.loanTermMonths as number | undefined) ?? structured.loanTermMonths,
    requestedLeasingAmount: (project.requestedLeasingAmount as number | undefined) ?? structured.requestedLeasingAmount,
    collateralAvailable: (project.collateralAvailable as boolean | undefined) ?? structured.collateralAvailable,
    collateralType: (project.collateralType as string | undefined) ?? structured.collateralType,
    collateralEstimatedValue: (project.collateralEstimatedValue as number | undefined) ?? structured.collateralEstimatedValue,
    experienceLevel: (project.experienceLevel as string | undefined) ?? structured.experienceLevel,
    sectionNotes: project.sectionNotes && typeof project.sectionNotes === "object" ? (project.sectionNotes as never) : structured.sectionNotes
  };
}
