import type { RiskItem, StructuredProjectData } from "../types/project";
import type { AppLocale } from "../i18n/index.ts";

type FinancialScoreInput = {
  financing: {
    creditNeeded?: string;
    ownContributionPct: number;
    dscr: number | null;
  };
  profitability: {
    ebitdaMarginPct: number;
  };
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const hasDetails = (value?: string) => Boolean(value && value.trim().length >= 40);

function riskPenalty(risks: ReadonlyArray<Pick<RiskItem, "level">>): number {
  return risks.reduce((penalty, risk) => {
    if (risk.level === "high") return penalty + 7;
    if (risk.level === "medium") return penalty + 3;
    return penalty;
  }, 0);
}

function detailedDataScore(project: StructuredProjectData): number {
  let score = 0;
  if (hasDetails(project.sectionNotes?.salesMarketing)) score += 5;
  if (hasDetails(project.sectionNotes?.equipment)) score += 5;
  if (hasDetails(project.sectionNotes?.rawMaterials)) score += 5;
  if (project.monthlyCapacity && project.averagePrice && project.employeesCount) score += 6;
  if (project.targetCustomers && project.targetCustomers.length >= 3) score += 4;
  const unknowns = [project.equipmentCondition, project.rawMaterialSource, project.creditNeeded, project.certificationAwareness].filter((v) => v === "not_selected" || v === "unknown" || v === "not_aware").length;
  score -= unknowns * 4;
  return score;
}

export function calculateFeasibilityScore(
  project: StructuredProjectData,
  financial: FinancialScoreInput,
  risks: ReadonlyArray<Pick<RiskItem, "level">>
): number {
  let score = 58;
  score += financial.profitability.ebitdaMarginPct >= 15 ? 12 : financial.profitability.ebitdaMarginPct >= 8 ? 6 : -8;
  if (financial.financing.dscr === null) score += 2;
  else score += financial.financing.dscr >= 1.3 ? 12 : financial.financing.dscr >= 1 ? 4 : -10;
  score += financial.financing.ownContributionPct >= 30 ? 10 : financial.financing.ownContributionPct >= 20 ? 5 : -8;
  score += project.experienceLevel === "high" ? 8 : project.experienceLevel === "medium" ? 4 : -6;
  score += project.certificationAwareness === "aware" ? 6 : project.certificationAwareness === "partly_aware" ? 2 : -8;
  score += detailedDataScore(project);
  score -= riskPenalty(risks);
  return clamp(score);
}

export function calculateBankReadinessScore(
  project: StructuredProjectData,
  financial: FinancialScoreInput,
  risks: ReadonlyArray<Pick<RiskItem, "level">>
): number {
  let score = project.creditNeeded === "no" ? 56 : 50;
  if (project.creditNeeded === "no") {
    score += financial.financing.ownContributionPct >= 45 ? 16 : financial.financing.ownContributionPct >= 30 ? 10 : 0;
  } else {
    score += project.collateralAvailable ? 14 : -10;
    score += (financial.financing.dscr ?? 0) >= 1.25 ? 16 : (financial.financing.dscr ?? 0) >= 1 ? 6 : -12;
  }
  score += financial.financing.ownContributionPct >= 30 ? 14 : financial.financing.ownContributionPct >= 20 ? 7 : -8;
  score += project.hasBuyerAgreements ? 8 : -5;
  score += project.supplierSelected ? 5 : -3;
  score += project.certificationAwareness === "aware" ? 7 : project.certificationAwareness === "partly_aware" ? 3 : -6;
  score += hasDetails(project.sectionNotes?.finance) ? 5 : 0;
  score += hasDetails(project.sectionNotes?.salesMarketing) ? 5 : 0;
  const relevantRisks = project.creditNeeded === "no" ? risks.filter((risk) => "code" in risk ? (risk as RiskItem).code !== "collateral_risk" : true) : risks;
  score -= Math.round(riskPenalty(relevantRisks) * 0.8);
  return clamp(score);
}

export function getScoreLabel(score: number, locale: AppLocale = "ru"): string {
  if (score >= 80) return locale === "en" ? "High readiness" : locale === "uz" ? "Yuqori tayyorgarlik" : "Высокая готовность";
  if (score >= 65) return locale === "en" ? "Preliminarily feasible" : locale === "uz" ? "Dastlabki bahoda amalga oshadi" : "Предварительно реализуемо";
  if (score >= 45) return locale === "en" ? "Requires improvement" : locale === "uz" ? "Takomillashtirish kerak" : "Требует доработки";
  return locale === "en" ? "High risk" : locale === "uz" ? "Yuqori risk" : "Высокий риск";
}

export function getScoreColorVariant(score: number): "green" | "amber" | "red" {
  if (score >= 70) return "green";
  if (score >= 45) return "amber";
  return "red";
}
