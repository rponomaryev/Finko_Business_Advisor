import type {
  CurrencyCode,
  DataSourceKind,
  ExchangeRateSnapshot,
  FinancialResult,
  SectorAssumptions,
  StaffPlanRole,
  StructuredProjectData
} from "../types/project";
import { formatCurrencyFull } from "../utils/formatCurrency.ts";

const roundMoney = (value: number) => Math.round(Number.isFinite(value) ? value : 0);
const roundPct = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 10) / 10;
const sourceOf = (value: unknown): DataSourceKind => value === undefined || value === null || value === "" ? "assumption" : "user_input";
const numberOr = (value: unknown, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const pct = (value: number) => Math.max(0, Math.min(100, value));

export function calculateMonthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRatePct / 12 / 100;
  if (monthlyRate === 0) return roundMoney(principal / months);
  const factor = Math.pow(1 + monthlyRate, months);
  return roundMoney((principal * monthlyRate * factor) / (factor - 1));
}

function toUZS(amount: number | undefined, currency: CurrencyCode | undefined, exchangeRate: number): number {
  const value = Number(amount ?? 0);
  return currency === "USD" ? roundMoney(value * exchangeRate) : roundMoney(value);
}

function normalizeStaffRole(role: StaffPlanRole, exchangeRate: number): StaffPlanRole {
  const count = Math.max(1, Math.round(Number(role.count ?? 1)));
  const monthlySalaryAmount = Number(role.monthlySalaryAmount ?? 0);
  const monthlySalaryCurrency = (role.monthlySalaryCurrency ?? "UZS") as CurrencyCode;
  const monthlySalaryUZS = toUZS(monthlySalaryAmount, monthlySalaryCurrency, exchangeRate);
  return {
    ...role,
    count,
    monthlySalaryAmount,
    monthlySalaryCurrency,
    monthlySalaryUZS
  };
}

export function calculatePayroll(project: StructuredProjectData, exchangeRateSnapshot?: ExchangeRateSnapshot): FinancialResult["payroll"] {
  const exchangeRate = exchangeRateSnapshot?.rate ?? project.exchangeRateSnapshot?.rate ?? project.exchangeRateUZSPerUSD ?? 12_500;
  const roles = (project.staffPlan?.roles ?? [])
    .filter((role) => role.role?.trim() && Number(role.monthlySalaryAmount ?? 0) >= 0)
    .map((role) => normalizeStaffRole(role, exchangeRate));
  const totalMonthlyPayrollUZS = roles.reduce((sum, role) => sum + (role.monthlySalaryUZS ?? 0) * role.count, 0);
  return {
    roles,
    totalMonthlyPayrollUZS: roundMoney(totalMonthlyPayrollUZS),
    exchangeRateSnapshot: exchangeRateSnapshot ?? project.exchangeRateSnapshot
  };
}

function capexItem(key: string, label: string, amount: number, source: DataSourceKind) {
  return { key, label, amount: roundMoney(amount), source };
}

export function calculateCapex(project: StructuredProjectData, assumptions: SectorAssumptions): FinancialResult["capex"] {
  const equipmentMultiplier = project.equipmentCondition === "used" ? 0.7 : 1;
  const premisesMultiplier = project.premisesStatus === "owned" ? 0.55 : 1;
  const equipmentCost = roundMoney(numberOr(project.equipmentCapex, assumptions.defaultEquipmentCostUZS * equipmentMultiplier));
  const moldCost = roundMoney(project.moldRequired ? assumptions.defaultMoldCostUZS : 0);
  const premisesSetupCost = roundMoney(numberOr(project.premisesSetupCapex, assumptions.defaultPremisesSetupCostUZS * premisesMultiplier));
  const furnitureFixturesCapex = roundMoney(numberOr(project.furnitureFixturesCapex, assumptions.defaultPackagingSetupCostUZS));
  const itPosWebsiteCapex = roundMoney(numberOr(project.itPosWebsiteCapex, Math.round(assumptions.defaultPackagingSetupCostUZS * 0.5)));
  const certificationCost = roundMoney(numberOr(project.registrationCertificationCapex, assumptions.defaultCertificationCostUZS));
  const initialInventoryCost = roundMoney(numberOr(project.initialInventoryCapex ?? project.firstMonthRawMaterialStockUZS, assumptions.defaultInitialInventoryCostUZS));
  const deliveryInstallationCapex = roundMoney(numberOr(project.deliveryInstallationCapex, Math.round(equipmentCost * 0.04)));
  const trainingLaunchCapex = roundMoney(numberOr(project.trainingLaunchCapex, Math.round(assumptions.defaultPackagingSetupCostUZS * 0.5)));
  const reserveDefault = project.contingencyReserveAvailable === false ? Math.round((equipmentCost + moldCost) * 0.03) : Math.round((equipmentCost + moldCost) * 0.08);
  const reserveCost = roundMoney(numberOr(project.capexReserve, reserveDefault));
  const otherCapex = roundMoney(numberOr(project.otherCapex, 0));
  const lineItems = [
    capexItem("equipmentCapex", "Оборудование", equipmentCost, sourceOf(project.equipmentCapex)),
    capexItem("premisesSetupCapex", "Ремонт и подготовка помещения", premisesSetupCost, sourceOf(project.premisesSetupCapex)),
    capexItem("furnitureFixturesCapex", "Мебель и инвентарь", furnitureFixturesCapex, sourceOf(project.furnitureFixturesCapex)),
    capexItem("itPosWebsiteCapex", "IT / POS / касса / сайт", itPosWebsiteCapex, sourceOf(project.itPosWebsiteCapex)),
    capexItem("registrationCertificationCapex", "Регистрация и сертификация", certificationCost, sourceOf(project.registrationCertificationCapex)),
    capexItem("initialInventoryCapex", "Первоначальный запас", initialInventoryCost, sourceOf(project.initialInventoryCapex ?? project.firstMonthRawMaterialStockUZS)),
    capexItem("deliveryInstallationCapex", "Доставка и монтаж", deliveryInstallationCapex, sourceOf(project.deliveryInstallationCapex)),
    capexItem("trainingLaunchCapex", "Обучение и запуск", trainingLaunchCapex, sourceOf(project.trainingLaunchCapex)),
    capexItem("capexReserve", "Резерв CapEx", reserveCost, sourceOf(project.capexReserve)),
    capexItem("otherCapex", "Прочий CapEx", otherCapex, sourceOf(project.otherCapex))
  ];
  const totalCapEx = lineItems.reduce((sum, item) => sum + item.amount, 0) + moldCost;
  return {
    equipmentCost,
    moldCost,
    premisesSetupCost,
    packagingSetupCost: furnitureFixturesCapex + itPosWebsiteCapex + trainingLaunchCapex,
    certificationCost,
    initialInventoryCost,
    reserveCost,
    furnitureFixturesCapex,
    itPosWebsiteCapex,
    deliveryInstallationCapex,
    trainingLaunchCapex,
    otherCapex,
    totalCapEx,
    lineItems: moldCost > 0 ? [...lineItems, capexItem("moldCost", "Формы / оснастка", moldCost, project.moldRequired ? "assumption" : "calculated")] : lineItems
  };
}

export function calculateRevenue(project: StructuredProjectData, assumptions: SectorAssumptions): FinancialResult["revenue"] {
  const monthlyCapacity = numberOr(project.monthlyCapacity ?? project.monthlySalesVolume ?? project.monthlyOrders ?? project.monthlyClients, 0);
  const averagePrice = numberOr(project.averagePrice ?? project.averageTicket ?? project.averageServicePrice, 0);
  const expectedUtilizationPct = pct(numberOr(project.utilizationRatePct, assumptions.defaultExpectedUtilizationPct));
  const effectiveUnits = roundMoney(monthlyCapacity * (expectedUtilizationPct / 100));
  const calculatedMonthlyRevenue = roundMoney(monthlyCapacity * averagePrice * (expectedUtilizationPct / 100));
  const stableMonthlyRevenue = project.stableMonthlyRevenue && project.stableMonthlyRevenue > 0 ? roundMoney(project.stableMonthlyRevenue) : undefined;
  const revenueSource = project.preferredRevenueSource === "stable" && stableMonthlyRevenue ? "stable" : "calculated";
  const monthlyRevenue = revenueSource === "stable" && stableMonthlyRevenue ? stableMonthlyRevenue : calculatedMonthlyRevenue;
  return {
    monthlyCapacity,
    effectiveUnits,
    volumeLabel: "Плановый месячный объём",
    unitLabel: project.salesUnitLabel ?? "ед./мес.",
    averagePrice,
    expectedUtilizationPct,
    calculatedMonthlyRevenue,
    stableMonthlyRevenue,
    revenueSource,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12
  };
}

export function calculateCOGS(project: StructuredProjectData, revenue: FinancialResult["revenue"], assumptions: SectorAssumptions): FinancialResult["cogs"] {
  const hasUserCogs = [
    project.rawMaterialCostPerUnit,
    project.packagingCostPerUnit,
    project.directLogisticsCostPerUnit,
    project.marketplaceCommissionPerUnit,
    project.otherVariableCostPerUnit
  ].some((value) => value !== undefined && value !== null);
  const assumedUnitCogs = revenue.averagePrice > 0 ? roundMoney(revenue.averagePrice * (assumptions.defaultVariableCostPct / 100)) : 0;
  const rawMaterialCostPerUnit = numberOr(project.rawMaterialCostPerUnit, hasUserCogs ? 0 : assumedUnitCogs);
  const packagingCostPerUnit = numberOr(project.packagingCostPerUnit, 0);
  const directLogisticsCostPerUnit = numberOr(project.directLogisticsCostPerUnit, 0);
  const marketplaceCommissionPerUnit = numberOr(project.marketplaceCommissionPerUnit, 0);
  const otherVariableCostPerUnit = numberOr(project.otherVariableCostPerUnit, 0);
  const wasteAllowancePct = numberOr(project.wasteAllowancePct, 0);
  const unitCOGS = roundMoney(rawMaterialCostPerUnit + packagingCostPerUnit + directLogisticsCostPerUnit + marketplaceCommissionPerUnit + otherVariableCostPerUnit);
  const wasteAdjustedUnitCOGS = roundMoney(unitCOGS * (1 + wasteAllowancePct / 100));
  const monthlyCOGS = roundMoney(revenue.effectiveUnits * wasteAdjustedUnitCOGS);
  return {
    rawMaterialCostPerUnit,
    packagingCostPerUnit,
    directLogisticsCostPerUnit,
    marketplaceCommissionPerUnit,
    otherVariableCostPerUnit,
    wasteAllowancePct,
    unitCOGS,
    wasteAdjustedUnitCOGS,
    monthlyCOGS,
    source: hasUserCogs ? "user_input" : "assumption"
  };
}

function opexItem(key: string, label: string, amount: number, source: DataSourceKind) {
  return { key, label, amount: roundMoney(amount), source };
}

export function calculateOpex(project: StructuredProjectData, assumptions: SectorAssumptions, payroll: FinancialResult["payroll"]): FinancialResult["opex"] {
  const base = assumptions.defaultMonthlyFixedCostsUZS;
  const monthlyPayroll = payroll.totalMonthlyPayrollUZS;
  const monthlyRent = roundMoney(numberOr(project.monthlyRent, base * 0.32));
  const monthlyUtilities = roundMoney(numberOr(project.monthlyUtilities, base * 0.10));
  const monthlyMarketing = roundMoney(numberOr(project.monthlyMarketing, base * 0.12));
  const monthlyMaintenance = roundMoney(numberOr(project.monthlyMaintenance, base * 0.08));
  const monthlyTaxes = roundMoney(numberOr(project.monthlyTaxes, base * 0.12));
  const monthlyLogistics = roundMoney(numberOr(project.monthlyLogistics, base * 0.10));
  const monthlySoftware = roundMoney(numberOr(project.monthlySoftware, base * 0.04));
  const monthlyInsurance = roundMoney(numberOr(project.monthlyInsurance, base * 0.04));
  const monthlyAccounting = roundMoney(numberOr(project.monthlyAccounting, base * 0.04));
  const monthlyOtherOpex = roundMoney(numberOr(project.monthlyOtherOpex, base * 0.04));
  const lineItems = [
    opexItem("monthlyPayroll", "Зарплата", monthlyPayroll, payroll.roles.length ? "user_input" : "assumption"),
    opexItem("monthlyRent", "Аренда", monthlyRent, sourceOf(project.monthlyRent)),
    opexItem("monthlyUtilities", "Коммунальные", monthlyUtilities, sourceOf(project.monthlyUtilities)),
    opexItem("monthlyMarketing", "Маркетинг", monthlyMarketing, sourceOf(project.monthlyMarketing)),
    opexItem("monthlyMaintenance", "Обслуживание", monthlyMaintenance, sourceOf(project.monthlyMaintenance)),
    opexItem("monthlyTaxes", "Налоги", monthlyTaxes, sourceOf(project.monthlyTaxes)),
    opexItem("monthlyLogistics", "Логистика", monthlyLogistics, sourceOf(project.monthlyLogistics)),
    opexItem("monthlySoftware", "ПО / IT", monthlySoftware, sourceOf(project.monthlySoftware)),
    opexItem("monthlyInsurance", "Страхование", monthlyInsurance, sourceOf(project.monthlyInsurance)),
    opexItem("monthlyAccounting", "Бухгалтерия", monthlyAccounting, sourceOf(project.monthlyAccounting)),
    opexItem("monthlyOtherOpex", "Прочие расходы", monthlyOtherOpex, sourceOf(project.monthlyOtherOpex))
  ];
  const monthlyFixedOpex = lineItems.reduce((sum, item) => sum + item.amount, 0);
  return {
    monthlyPayroll,
    monthlyRent,
    monthlyUtilities,
    monthlyMarketing,
    monthlyMaintenance,
    monthlyTaxes,
    monthlyLogistics,
    monthlySoftware,
    monthlyInsurance,
    monthlyAccounting,
    monthlyOtherOpex,
    monthlyFixedOpex,
    lineItems
  };
}

export function calculateWorkingCapital(
  project: StructuredProjectData,
  assumptions: SectorAssumptions,
  opexOrPayroll: FinancialResult["opex"] | FinancialResult["payroll"]
): FinancialResult["workingCapital"] {
  const monthlyFixedCosts = "monthlyFixedOpex" in opexOrPayroll
    ? opexOrPayroll.monthlyFixedOpex
    : assumptions.defaultMonthlyFixedCostsUZS + opexOrPayroll.totalMonthlyPayrollUZS;
  const totalMonthlyPayrollUZS = "monthlyFixedOpex" in opexOrPayroll
    ? opexOrPayroll.monthlyPayroll
    : opexOrPayroll.totalMonthlyPayrollUZS;
  const baseMonthlyFixedCosts = Math.max(monthlyFixedCosts - totalMonthlyPayrollUZS, 0);
  const bufferMonths = Math.max(0, numberOr(project.workingCapitalBufferMonths, assumptions.defaultWorkingCapitalMonths));
  const initialInventory = Math.max(0, roundMoney(numberOr(project.initialInventoryCapex ?? project.firstMonthRawMaterialStockUZS, 0)));
  const accountsReceivableBuffer = Math.max(0, roundMoney(numberOr(project.accountsReceivableBufferUZS, 0)));
  const accountsPayableBuffer = Math.max(0, roundMoney(numberOr(project.accountsPayableBufferUZS, 0)));
  const seasonalStockBuffer = Math.max(0, roundMoney(numberOr(project.seasonalStockBufferUZS, project.seasonalDemand ? initialInventory : 0)));
  const requiredWorkingCapital = roundMoney(monthlyFixedCosts * bufferMonths + initialInventory + accountsReceivableBuffer - accountsPayableBuffer + seasonalStockBuffer);
  return {
    monthlyFixedCosts,
    baseMonthlyFixedCosts,
    totalMonthlyPayrollUZS,
    workingCapitalMonths: bufferMonths,
    bufferMonths,
    initialInventory,
    accountsReceivableBuffer,
    accountsPayableBuffer,
    seasonalStockBuffer,
    requiredWorkingCapital,
    formula: "monthlyFixedOpex × bufferMonths + initialInventory + accountsReceivableBuffer - accountsPayableBuffer + seasonalStockBuffer"
  };
}

export function calculateProfitability(
  revenue: FinancialResult["revenue"],
  cogs: FinancialResult["cogs"],
  opex: FinancialResult["opex"],
  totalInvestmentNeed = 0,
  monthlyDebtService = 0
): FinancialResult["profitability"] {
  const monthlyGrossProfit = roundMoney(revenue.monthlyRevenue - cogs.monthlyCOGS);
  const grossMarginPct = revenue.monthlyRevenue > 0 ? roundPct((monthlyGrossProfit / revenue.monthlyRevenue) * 100) : 0;
  const monthlyEBITDA = roundMoney(monthlyGrossProfit - opex.monthlyFixedOpex);
  const ebitdaMarginPct = revenue.monthlyRevenue > 0 ? roundPct((monthlyEBITDA / revenue.monthlyRevenue) * 100) : 0;
  const contributionMarginPerUnit = roundMoney(revenue.averagePrice - cogs.wasteAdjustedUnitCOGS);
  const breakEvenUnits = contributionMarginPerUnit > 0 ? Math.ceil(opex.monthlyFixedOpex / contributionMarginPerUnit) : null;
  const breakEvenRevenue = breakEvenUnits === null ? null : roundMoney(breakEvenUnits * revenue.averagePrice);
  const monthlyNetCashFlow = roundMoney(monthlyEBITDA - monthlyDebtService);
  const paybackMonths = monthlyNetCashFlow > 0 && totalInvestmentNeed > 0 ? Math.ceil(totalInvestmentNeed / monthlyNetCashFlow) : null;
  return { grossMarginPct, monthlyGrossProfit, monthlyEBITDA, ebitdaMarginPct, contributionMarginPerUnit, breakEvenUnits, breakEvenRevenue, monthlyNetCashFlow, paybackMonths };
}

export function calculateFinancing(
  project: StructuredProjectData,
  capex: FinancialResult["capex"],
  workingCapital: FinancialResult["workingCapital"],
  profitabilityBase: Pick<FinancialResult["profitability"], "monthlyEBITDA">,
  assumptions: SectorAssumptions
): FinancialResult["financing"] {
  const exchangeRateUZSPerUSD = Number(project.exchangeRateSnapshot?.rate ?? project.exchangeRateUZSPerUSD ?? assumptions.defaultExchangeRateUZSPerUSD);
  const ownContributionCurrency = (project.ownContributionCurrency ?? "UZS") as CurrencyCode;
  const ownContributionAmount = Number(project.ownContributionAmount ?? project.ownContribution ?? 0);
  const ownContributionUZS = project.ownContributionUZS ?? toUZS(ownContributionAmount, ownContributionCurrency, exchangeRateUZSPerUSD);
  const creditNeeded = project.creditNeeded ?? (project.requestedLoanAmount ? "yes" : "unknown");
  const loanCurrency = (project.approvedLoanCurrency ?? project.requestedLoanCurrency ?? "UZS") as CurrencyCode;
  const loanAmount = Number(project.approvedLoanAmount ?? project.requestedLoanAmount ?? 0);
  const requestedLoanUZS = creditNeeded === "yes" ? (project.requestedLoanUZS ?? toUZS(loanAmount, loanCurrency, exchangeRateUZSPerUSD)) : 0;
  const loanTermMonths = Math.max(1, Number(project.loanTermMonths ?? assumptions.defaultLoanTermMonths));
  const loanAnnualRatePct = Math.max(0, numberOr(project.loanAnnualRatePct, assumptions.defaultLoanAnnualRatePct));
  const loanAnnualRateSource = sourceOf(project.loanAnnualRatePct);
  const loanGracePeriodMonths = Math.max(0, Math.min(loanTermMonths - 1, Math.round(Number(project.loanGracePeriodMonths ?? 0))));
  const loanRepaymentType = (project.loanRepaymentType ?? "annuity") as "annuity" | "equal_principal";
  const loanPaymentMonths = Math.max(1, loanTermMonths - loanGracePeriodMonths);
  const leasingCurrency = (project.approvedLeasingCurrency ?? project.requestedLeasingCurrency ?? "UZS") as CurrencyCode;
  const leasingInput = Number(project.approvedLeasingAmount ?? project.requestedLeasingAmount ?? 0);
  const leasingRequired = project.needsLeasing === true ? toUZS(leasingInput, leasingCurrency, exchangeRateUZSPerUSD) : 0;
  const leasingTermMonths = Math.max(1, Number(project.leasingTermMonths ?? assumptions.defaultLeasingTermMonths));
  const leasingAnnualRatePct = Math.max(0, numberOr(project.leasingAnnualRatePct, assumptions.defaultLeasingAnnualRatePct));
  const leasingAnnualRateSource = sourceOf(project.leasingAnnualRatePct);
  const leasingAdvancePayment = roundMoney(numberOr(project.leasingAdvancePayment, 0));
  const leasingPaymentSource = sourceOf(project.leasingMonthlyPayment);
  const totalInvestmentNeed = capex.totalCapEx + workingCapital.requiredWorkingCapital;
  const ownContributionPct = totalInvestmentNeed > 0 ? roundPct((ownContributionUZS / totalInvestmentNeed) * 100) : 0;
  const estimatedMonthlyLoanPayment = creditNeeded === "yes" ? calculateMonthlyPayment(requestedLoanUZS, loanAnnualRatePct, loanPaymentMonths) : 0;
  const totalLoanInterest = creditNeeded === "yes" ? Math.max(estimatedMonthlyLoanPayment * loanPaymentMonths - requestedLoanUZS, 0) : 0;
  const calculatedMonthlyLeasingPayment = leasingRequired > 0 ? calculateMonthlyPayment(Math.max(leasingRequired - leasingAdvancePayment, 0), leasingAnnualRatePct, leasingTermMonths) : 0;
  const estimatedMonthlyLeasingPayment = leasingRequired > 0 && Number(project.leasingMonthlyPayment ?? 0) > 0 ? roundMoney(Number(project.leasingMonthlyPayment)) : calculatedMonthlyLeasingPayment;
  const totalMonthlyDebtService = estimatedMonthlyLoanPayment + estimatedMonthlyLeasingPayment;
  const grants = Math.max(0, roundMoney(numberOr(project.grants, 0)));
  const otherFunding = Math.max(0, roundMoney(numberOr(project.otherFunding, 0)));
  const availableFunding = roundMoney(ownContributionUZS + requestedLoanUZS + leasingRequired + grants + otherFunding);
  const financingGap = Math.max(totalInvestmentNeed - availableFunding, 0);
  const fundingSurplus = Math.max(availableFunding - totalInvestmentNeed, 0);
  const dscr = totalMonthlyDebtService > 0 ? Math.round((profitabilityBase.monthlyEBITDA / totalMonthlyDebtService) * 100) / 100 : null;

  return {
    creditNeeded,
    ownContributionAmount,
    ownContributionCurrency,
    ownContributionUZS,
    ownContribution: ownContributionUZS,
    ownContributionPct,
    exchangeRateUZSPerUSD,
    requestedLoanUZS,
    loanRequired: requestedLoanUZS,
    loanCurrency,
    loanPurpose: project.loanPurpose,
    loanTermMonths,
    loanAnnualRatePct,
    loanAnnualRateSource,
    loanGracePeriodMonths,
    loanRepaymentType,
    totalLoanInterest,
    leasingRequired,
    leasingCurrency,
    leasingTermMonths,
    leasingAnnualRatePct,
    leasingAnnualRateSource,
    leasingAdvancePayment,
    leasingPaymentSource,
    estimatedMonthlyLoanPayment,
    estimatedMonthlyLeasingPayment,
    totalMonthlyDebtService,
    totalInvestmentNeed,
    availableFunding,
    financingGap,
    fundingSurplus,
    grants,
    otherFunding,
    dscr,
    dscrLabel: dscr === null ? "Не применяется" : String(dscr)
  };
}

function buildWarnings(project: StructuredProjectData, f: Omit<FinancialResult, "warnings" | "formulaRows">): FinancialResult["warnings"] {
  const warnings: FinancialResult["warnings"] = [];
  if (f.revenue.stableMonthlyRevenue && f.revenue.calculatedMonthlyRevenue > 0) {
    const deltaPct = Math.abs(f.revenue.stableMonthlyRevenue - f.revenue.calculatedMonthlyRevenue) / f.revenue.calculatedMonthlyRevenue * 100;
    if (deltaPct > 7) {
      warnings.push({
        code: "revenue_conflict",
        message: "Указанная стабильная выручка отличается от расчета по объему, цене и загрузке. По умолчанию используется расчетная выручка; можно выбрать stable revenue явно.",
        values: {
          calculatedMonthlyRevenue: f.revenue.calculatedMonthlyRevenue,
          stableMonthlyRevenue: f.revenue.stableMonthlyRevenue,
          differencePct: roundPct(deltaPct)
        }
      });
    }
  }
  if (f.cogs.source === "assumption") {
    warnings.push({ code: "cogs_assumption", message: "Себестоимость за единицу не указана, COGS и маржа рассчитаны по допущению.", values: { assumedUnitCOGS: f.cogs.unitCOGS } });
  }
  if (f.profitability.contributionMarginPerUnit <= 0) {
    warnings.push({ code: "negative_contribution_margin", message: "Себестоимость равна или выше цены продажи; точка безубыточности не рассчитывается корректно." });
  }
  if (project.creditNeeded === "no" && Number(project.requestedLoanAmount ?? 0) > 0) {
    warnings.push({ code: "loan_conflict", message: "Выбран вариант без кредита, но указана сумма кредита.", values: { requestedLoanAmount: Number(project.requestedLoanAmount) } });
  }
  if (project.needsLeasing === false && Number(project.requestedLeasingAmount ?? 0) > 0) {
    warnings.push({ code: "leasing_conflict", message: "Выбран вариант без лизинга, но указана сумма лизинга.", values: { requestedLeasingAmount: Number(project.requestedLeasingAmount) } });
  }
  if (project.premisesStatus === "rent" && project.monthlyRent === undefined) {
    warnings.push({ code: "rent_missing", message: "Помещение отмечено как аренда, но ежемесячная аренда не указана; использовано допущение." });
  }
  if (project.creditNeeded === "yes" && (!project.requestedLoanAmount || !project.loanTermMonths || !project.loanPurpose)) {
    warnings.push({ code: "loan_terms_missing", severity: "medium", title: "Неполные условия кредита", message: "Кредит указан, но сумма, срок и/или цель кредита не заполнены полностью." });
  }
  if (project.creditNeeded === "yes" && project.loanAnnualRatePct === undefined) {
    warnings.push({ code: "loan_rate_assumption", severity: "medium", title: "Ставка кредита не указана", message: "Процентная ставка кредита не указана. Расчет платежа и DSCR выполнен по допущению.", values: { assumedAnnualRatePct: f.financing.loanAnnualRatePct } });
  }
  if (project.creditNeeded === "yes" && f.financing.loanRepaymentType !== "annuity") {
    warnings.push({ code: "repayment_type_assumption", severity: "low", title: "Тип погашения упрощен", message: "Пока поддерживается только аннуитетный расчет; график равными долями нужно проверить отдельно." });
  }
  if (project.needsLeasing === true && project.leasingAnnualRatePct === undefined && f.financing.leasingRequired > 0) {
    warnings.push({ code: "leasing_rate_assumption", severity: "medium", title: "Ставка лизинга не указана", message: "Ставка/удорожание лизинга не указаны. Расчет платежа выполнен по допущению.", values: { assumedLeasingAnnualRatePct: f.financing.leasingAnnualRatePct } });
  }
  if (project.collateralAvailable === true && !project.collateralEstimatedValue) {
    warnings.push({ code: "collateral_valuation_missing", severity: "medium", title: "Оценка залога требует проверки", message: "Залог указан текстом, но надежная рыночная оценка не найдена или не введена. Требуется ручная оценка и проверка банком." });
  }
  if (project.rawMaterialSource === "import" && project.foreignCurrencyPurchases === undefined) {
    warnings.push({ code: "fx_buffer_missing", message: "Указаны импортные поставки, но валютный буфер/валюта закупок не уточнены." });
  }
  if (project.seasonalDemand && project.seasonalStockBufferUZS === undefined) {
    warnings.push({ code: "seasonality_buffer_missing", message: "Продажи сезонные, но сезонный запас/буфер не задан; использовано упрощенное допущение." });
  }
  if (f.financing.financingGap > 0) {
    warnings.push({ code: "financing_gap", severity: "medium", title: "Разрыв финансирования", message: "Есть разрыв финансирования. Нужно увеличить собственные средства, подтвердить кредит/лизинг или сократить стартовые вложения.", values: { financingGap: f.financing.financingGap } });
  }
  return warnings;
}

function buildFormulaRows(f: Omit<FinancialResult, "warnings" | "formulaRows">): FinancialResult["formulaRows"] {
  const money = (value: number | null) => value === null ? "Не применяется" : formatCurrencyFull(value);
  return [
    {
      indicator: "Месячная выручка",
      formula: "Volume × Price × Utilization",
      substitution: `${f.revenue.monthlyCapacity.toLocaleString("ru-RU")} × ${f.revenue.averagePrice.toLocaleString("ru-RU")} × ${f.revenue.expectedUtilizationPct}%`,
      result: money(f.revenue.monthlyRevenue),
      source: f.revenue.revenueSource === "stable" ? "user_input" : "calculated"
    },
    {
      indicator: "COGS",
      formula: "Units × Unit COGS × (1 + Waste%)",
      substitution: `${f.revenue.effectiveUnits.toLocaleString("ru-RU")} × ${f.cogs.unitCOGS.toLocaleString("ru-RU")} × ${1 + f.cogs.wasteAllowancePct / 100}`,
      result: money(f.cogs.monthlyCOGS),
      source: f.cogs.source
    },
    {
      indicator: "Gross margin",
      formula: "Gross profit / Revenue",
      substitution: `${f.profitability.monthlyGrossProfit.toLocaleString("ru-RU")} / ${f.revenue.monthlyRevenue.toLocaleString("ru-RU")}`,
      result: `${f.profitability.grossMarginPct}%`,
      source: "calculated"
    },
    {
      indicator: "OpEx",
      formula: "Payroll + Rent + Utilities + Marketing + Maintenance + Taxes + Logistics + Software + Insurance + Accounting + Other",
      substitution: f.opex.lineItems.map((item) => item.amount.toLocaleString("ru-RU")).join(" + "),
      result: money(f.opex.monthlyFixedOpex),
      source: "calculated"
    },
    {
      indicator: "Working capital",
      formula: f.workingCapital.formula,
      substitution: `${f.workingCapital.monthlyFixedCosts.toLocaleString("ru-RU")} × ${f.workingCapital.bufferMonths} + ${f.workingCapital.initialInventory.toLocaleString("ru-RU")} + ${f.workingCapital.accountsReceivableBuffer.toLocaleString("ru-RU")} - ${f.workingCapital.accountsPayableBuffer.toLocaleString("ru-RU")} + ${f.workingCapital.seasonalStockBuffer.toLocaleString("ru-RU")}`,
      result: money(f.workingCapital.requiredWorkingCapital),
      source: "calculated"
    },
    {
      indicator: "Financing gap",
      formula: "Total investment need - Available funding",
      substitution: `${f.financing.totalInvestmentNeed.toLocaleString("ru-RU")} - ${f.financing.availableFunding.toLocaleString("ru-RU")}`,
      result: money(f.financing.financingGap),
      source: "calculated"
    },
    {
      indicator: "Break-even",
      formula: "Fixed OpEx / Contribution margin per unit",
      substitution: `${f.opex.monthlyFixedOpex.toLocaleString("ru-RU")} / ${f.profitability.contributionMarginPerUnit.toLocaleString("ru-RU")}`,
      result: f.profitability.breakEvenUnits === null ? "Не рассчитывается" : `${f.profitability.breakEvenUnits.toLocaleString("ru-RU")} ${f.revenue.unitLabel ?? "ед."}`,
      source: "calculated"
    },
    {
      indicator: "Loan payment / DSCR",
      formula: "PMT(rate/12, term, principal); EBITDA / debt service",
      substitution: `${f.financing.loanAnnualRatePct}% / 12, ${f.financing.loanTermMonths} мес., ${f.financing.loanRequired.toLocaleString("ru-RU")}; ${f.profitability.monthlyEBITDA.toLocaleString("ru-RU")} / ${f.financing.totalMonthlyDebtService.toLocaleString("ru-RU")}`,
      result: f.financing.totalMonthlyDebtService > 0 ? `${money(f.financing.totalMonthlyDebtService)}; DSCR ${f.financing.dscrLabel}` : "Не применяется",
      source: f.financing.loanAnnualRateSource === "assumption" || f.financing.leasingAnnualRateSource === "assumption" ? "assumption" : "calculated"
    }
  ];
}

export function calculateAll(
  project: StructuredProjectData,
  assumptions: SectorAssumptions,
  exchangeRateSnapshot?: ExchangeRateSnapshot
): FinancialResult {
  const payroll = calculatePayroll(project, exchangeRateSnapshot);
  const capex = calculateCapex(project, assumptions);
  const revenue = calculateRevenue(project, assumptions);
  const cogs = calculateCOGS(project, revenue, assumptions);
  const opex = calculateOpex(project, assumptions, payroll);
  const workingCapital = calculateWorkingCapital(project, assumptions, opex);
  const profitabilityBeforeDebt = calculateProfitability(revenue, cogs, opex, capex.totalCapEx + workingCapital.requiredWorkingCapital, 0);
  const financing = calculateFinancing(project, capex, workingCapital, profitabilityBeforeDebt, assumptions);
  const profitability = calculateProfitability(revenue, cogs, opex, financing.totalInvestmentNeed, financing.totalMonthlyDebtService);
  const resultWithoutMeta = { capex, workingCapital, revenue, cogs, opex, profitability, payroll, financing };
  const warnings = buildWarnings(project, resultWithoutMeta);
  const formulaRows = buildFormulaRows(resultWithoutMeta);
  return { ...resultWithoutMeta, warnings, formulaRows };
}
