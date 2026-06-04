import { getTranslations, type AppLocale } from "../i18n/index.ts";
import { translateBlock, translateQuestion } from "../i18n/interviewLabels.ts";
import { getReportLocale, reportMessages, tReport } from "../i18n/reportMessages.ts";
import { getLocalizedDisclaimer, resolveReportData, type ReportData } from "../services/reportService.ts";
import { flattenTemplateQuestions, resolveTemplateFromProject } from "../services/templateService.ts";
import type { FinancialResult, InterviewQuestion, RiskItem } from "../types/project.ts";
import { formatCurrencyFull, formatCurrencyWithOriginal } from "../utils/formatCurrency.ts";
import { getProjectProfile } from "../utils/projectClient.ts";
import { labelValue, localizeUnitLabel } from "../utils/labels.ts";
import { localizeReportData } from "../report/localizeReport.ts";
import {
  formatCapexLabel,
  formatOpexLabel,
  formatFormulaRows,
  formatWarningMessage,
  formatWarningTitle,
  formatWarningValue,
  formatWarningValueLabel,
  localizeRisks,
  reportMetric,
  reportSourceLabel,
  reportStatus
} from "../report/reportFormatters.ts";

type ExportTableRow = {
  label: string;
  value: string;
  comment?: string;
};

export type ReportInterviewRow = {
  section: string;
  field: string;
  answer: string;
  unit: string;
  required: string;
};

export type ReportFinancialRow = {
  indicator: string;
  value: string;
  unit: string;
  comment: string;
};

export type ReportRiskRow = {
  risk: string;
  level: string;
  reason: string;
  recommendation: string;
};

export type ReportMarketDataRow = {
  indicator: string;
  year: string;
  region: string;
  value: string;
  unit: string;
  currency: string;
  source: string;
  lastUpdated: string;
  matchQuality: string;
  explanation: string;
};

export type ReportImportExportRow = {
  type: string;
  hsCode: string;
  productCategory: string;
  year: string;
  country: string;
  valueUsd: string;
  volume: string;
  unit: string;
  source: string;
};

export type ReportRecommendationRow = {
  area: string;
  recommendation: string;
  priority: string;
};

export type ReportFormulaExportRow = {
  indicator: string;
  formula: string;
  substitution: string;
  result: string;
  source: string;
};

export type ReportBreakdownRow = {
  item: string;
  amount: string;
  source: string;
  comment: string;
};

export type ReportWarningRow = {
  title: string;
  message: string;
  values: string;
  severity: string;
};

export type ReportSourceRow = {
  sourceName: string;
  sourceType: string;
  url: string;
  year: string;
  lastUpdated: string;
  notes: string;
};

export type PreparedReportExport = {
  locale: AppLocale;
  fileNameBase: string;
  title: string;
  cover: ExportTableRow[];
  summary: ExportTableRow[];
  executiveSummary: string[];
  interviewRows: ReportInterviewRow[];
  financialRows: ReportFinancialRow[];
  risks: ReportRiskRow[];
  marketData: ReportMarketDataRow[];
  importExport: ReportImportExportRow[];
  recommendations: ReportRecommendationRow[];
  formulaRows: ReportFormulaExportRow[];
  capexRows: ReportBreakdownRow[];
  opexRows: ReportBreakdownRow[];
  financingRows: ReportBreakdownRow[];
  workingCapitalRows: ReportBreakdownRow[];
  collateralRows: ReportBreakdownRow[];
  warnings: ReportWarningRow[];
  sources: ReportSourceRow[];
  detailedConclusion: string[];
  financingRecommendation: string;
  disclaimer: string;
  generatedAt: string;
  report: ReportData;
};

type ProjectRecord = Record<string, unknown>;

function getValueByPath(target: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return target[path];
  const [root, child] = path.split(".");
  const rootValue = target[root];
  if (!rootValue || typeof rootValue !== "object") return undefined;
  return (rootValue as Record<string, unknown>)[child];
}

function formatDate(value: string, locale: AppLocale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatterLocale = locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(formatterLocale, {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatStaffPlan(rawValue: unknown, locale: AppLocale) {
  const messages = getTranslations(locale).report;
  if (!rawValue || typeof rawValue !== "object") return messages.notFilled;
  const roles = (rawValue as { roles?: Array<{ role?: unknown; count?: unknown; monthlySalary?: unknown; monthlySalaryAmount?: unknown }> }).roles;
  if (!Array.isArray(roles) || roles.length === 0) return messages.notFilled;
  const visibleRoles = roles
    .map((role) => ({
      role: String(role.role ?? "").trim(),
      count: Number(role.count ?? 0),
      monthlySalary: Number(role.monthlySalaryAmount ?? role.monthlySalary ?? 0)
    }))
    .filter((role) => role.role || role.count > 0 || role.monthlySalary > 0);
  if (!visibleRoles.length) return messages.notFilled;
  const totalEmployees = visibleRoles.reduce((sum, role) => sum + (Number.isFinite(role.count) ? role.count : 0), 0);
  const payroll = visibleRoles.reduce((sum, role) => sum + (Number.isFinite(role.monthlySalary) ? role.monthlySalary : 0) * (Number.isFinite(role.count) ? role.count : 0), 0);
  const roleText = visibleRoles.map((role) => `${role.role || messages.notFilled} - ${role.count || 0}`).join("; ");
  const totalLabel = locale === "en" ? "Total" : locale === "uz" ? "Jami" : "Итого";
  const payrollLabel = locale === "en" ? "monthly payroll" : locale === "uz" ? "oylik ish haqi fondi" : "фонд оплаты труда в месяц";
  return `${roleText}. ${totalLabel}: ${totalEmployees}; ${payrollLabel}: ${formatCurrencyFull(payroll, "UZS", locale)}`;
}

function formatObjectAnswer(rawValue: Record<string, unknown>, locale: AppLocale) {
  const messages = getTranslations(locale).report;
  const entries = Object.entries(rawValue)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${labelValue(key, locale)}: ${labelValue(value, locale)}`);
  return entries.length ? entries.join("; ") : messages.notFilled;
}

function formatQuestionAnswer(question: InterviewQuestion, rawValue: unknown, locale: AppLocale) {
  const messages = getTranslations(locale).report;
  if (rawValue === undefined || rawValue === null || rawValue === "" || rawValue === "__later__") {
    return messages.notFilled;
  }
  if (question.type === "staffPlan") return formatStaffPlan(rawValue, locale);
  if (typeof rawValue === "number" && rawValue < 0) return messages.notFilled;
  if (typeof rawValue === "number" && question.unit === "UZS") {
    return formatCurrencyFull(rawValue, "UZS", locale);
  }
  if (typeof rawValue === "number" && question.unit === "%") {
    return `${rawValue}%`;
  }
  if (typeof rawValue === "number" && question.unit) {
    return `${rawValue.toLocaleString(locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US")} ${localizeUnitLabel(question.unit, locale)}`;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((value) => labelValue(value, locale)).join(", ");
  }
  if (typeof rawValue === "object") {
    return formatObjectAnswer(rawValue as Record<string, unknown>, locale);
  }
  return labelValue(rawValue, locale);
}

function buildInterviewRows(project: ProjectRecord, locale: AppLocale) {
  const messages = getTranslations(locale).report;
  const profile = getProjectProfile(project);
  const exportQuestions = flattenTemplateQuestions(resolveTemplateFromProject(project))
    .map(({ block, question }) => ({
      blockName: translateBlock(locale, block.id, block.name, block.description).name,
      question: translateQuestion(locale, question)
    }));

  return exportQuestions.map(({ blockName, question }) => ({
    section: blockName,
    field: question.label,
    answer: formatQuestionAnswer(question, getValueByPath(profile as Record<string, unknown>, question.key), locale),
    unit: localizeUnitLabel(question.unit, locale),
    required: question.optional ? messages.requiredNo : messages.requiredYes
  }));
}

function buildFinancialRows(report: ReportData, financial: FinancialResult, locale: AppLocale): ReportFinancialRow[] {
  const rows: ReportFinancialRow[] = [];

  for (const row of report.keyFigures ?? []) {
    rows.push({
      indicator: row[0],
      value: row[1],
      unit: "",
      comment: row[2]
    });
  }

  rows.push({
    indicator: reportMetric("equipment", locale),
    value: formatCurrencyFull(financial.capex.equipmentCost, "UZS", locale),
    unit: "UZS",
    comment: "CapEx"
  });
  rows.push({
    indicator: reportMetric("premisesSetup", locale),
    value: formatCurrencyFull(financial.capex.premisesSetupCost, "UZS", locale),
    unit: "UZS",
    comment: "CapEx"
  });
  rows.push({
    indicator: reportMetric("workingCapital", locale),
    value: formatCurrencyFull(financial.workingCapital.requiredWorkingCapital, "UZS", locale),
    unit: "UZS",
    comment: tReport(reportMessages.comments.workingCapitalFormula, locale).replace("{months}", String(financial.workingCapital.workingCapitalMonths))
  });
  rows.push({
    indicator: reportMetric("ownContribution", locale),
    value: formatCurrencyWithOriginal(
      financial.financing.ownContributionUZS,
      financial.financing.ownContributionAmount,
      financial.financing.ownContributionCurrency,
      locale
    ),
    unit: "",
    comment: `${financial.financing.ownContributionPct}%`
  });
  rows.push({
    indicator: reportMetric("paybackPeriod", locale),
    value: financial.profitability.paybackMonths === null
      ? reportStatus("notApplicable", locale)
      : String(financial.profitability.paybackMonths),
    unit: locale === "ru" ? "мес." : locale === "uz" ? "oy" : "months",
    comment: financial.profitability.paybackMonths === null
      ? tReport(reportMessages.comments.noNegativeCashPayback, locale)
      : tReport(reportMessages.comments.investmentNetCash, locale)
  });

  return rows;
}

function buildRiskRows(risks: RiskItem[], locale: AppLocale): ReportRiskRow[] {
  const messages = getTranslations(locale).report;
  return localizeRisks(risks, locale).map((risk) => ({
    risk: risk.title,
    level: labelValue(risk.level, locale),
    reason: risk.reason,
    recommendation: risk.mitigation || messages.notFilled
  }));
}

function buildRecommendations(report: ReportData, locale: AppLocale): ReportRecommendationRow[] {
  return report.nextActions.map((action, index) => ({
    area: getTranslations(locale).report.actionPlan,
    recommendation: action,
    priority: index < 2 ? reportStatus("high", locale) : reportStatus("medium", locale)
  }));
}


function sourceLabel(source: unknown, locale: AppLocale) {
  return reportSourceLabel(source, locale);
}

function buildFormulaExportRows(financial: FinancialResult, locale: AppLocale): ReportFormulaExportRow[] {
  return formatFormulaRows(financial, locale).map((row) => ({
    indicator: row.indicator,
    formula: row.formula,
    substitution: row.substitution,
    result: row.result,
    source: sourceLabel(row.source, locale)
  }));
}

function buildCapexRows(financial: FinancialResult, locale: AppLocale): ReportBreakdownRow[] {
  return [
    ...financial.capex.lineItems.map((item) => ({
      item: formatCapexLabel(item.key, item.label, locale),
      amount: formatCurrencyFull(item.amount, "UZS", locale),
      source: sourceLabel(item.source, locale),
      comment: "CapEx"
    })),
    { item: locale === "en" ? "Total CapEx" : locale === "uz" ? "Jami CapEx" : "Итого CapEx", amount: formatCurrencyFull(financial.capex.totalCapEx, "UZS", locale), source: sourceLabel("calculated", locale), comment: locale === "en" ? "Sum of CapEx items" : locale === "uz" ? "CapEx moddalari yigindisi" : "Сумма статей CapEx" }
  ];
}

function buildOpexRows(financial: FinancialResult, locale: AppLocale): ReportBreakdownRow[] {
  return [
    ...financial.opex.lineItems.map((item) => ({
      item: formatOpexLabel(item.key, item.label, locale),
      amount: formatCurrencyFull(item.amount, "UZS", locale),
      source: sourceLabel(item.source, locale),
      comment: "Monthly OpEx"
    })),
    { item: locale === "en" ? "Total monthly OpEx" : locale === "uz" ? "Jami oylik OpEx" : "Итого ежемесячный OpEx", amount: formatCurrencyFull(financial.opex.monthlyFixedOpex, "UZS", locale), source: sourceLabel("calculated", locale), comment: locale === "en" ? "Sum of monthly OpEx items" : locale === "uz" ? "Oylik OpEx moddalari yigindisi" : "Сумма ежемесячных статей OpEx" }
  ];
}

function buildWorkingCapitalRows(financial: FinancialResult, locale: AppLocale): ReportBreakdownRow[] {
  const wc = financial.workingCapital;
  const source = sourceLabel("calculated", locale);
  const fixedCostsNote = locale === "en" ? "Monthly fixed operating costs" : locale === "uz" ? "Oylik doimiy operatsion xarajatlar" : "Ежемесячные фиксированные операционные расходы";
  const bufferNote = locale === "en" ? "Months covered before stable cash inflow" : locale === "uz" ? "Barqaror pul oqimigacha qoplanadigan oylar" : "Количество месяцев запаса до стабильного денежного потока";
  const plusNote = locale === "en" ? "Adds to working capital" : locale === "uz" ? "Aylanma kapitalga qo'shiladi" : "Увеличивает оборотный капитал";
  const minusNote = locale === "en" ? "Reduces working capital need" : locale === "uz" ? "Aylanma kapital ehtiyojini kamaytiradi" : "Снижает потребность в оборотном капитале";
  const totalNote = locale === "en" ? "Fixed costs for buffer period plus stock and payment buffers" : locale === "uz" ? "Bufer davri xarajatlari, zaxira va to'lov buferlari" : "Фиксированные расходы за период буфера плюс запасы и платежные буферы";
  return [
    { item: locale === "en" ? "Monthly fixed OpEx" : locale === "uz" ? "Oylik doimiy OpEx" : "Ежемесячный фиксированный OpEx", amount: formatCurrencyFull(wc.monthlyFixedCosts, "UZS", locale), source, comment: fixedCostsNote },
    { item: locale === "en" ? "Buffer months" : locale === "uz" ? "Bufer oylari" : "Месяцы буфера", amount: String(wc.bufferMonths), source, comment: bufferNote },
    { item: locale === "en" ? "Initial inventory" : locale === "uz" ? "Boshlang'ich zaxira" : "Первоначальный запас", amount: formatCurrencyFull(wc.initialInventory, "UZS", locale), source, comment: plusNote },
    { item: locale === "en" ? "Accounts receivable buffer" : locale === "uz" ? "Debitorlik buferi" : "Буфер дебиторки", amount: formatCurrencyFull(wc.accountsReceivableBuffer, "UZS", locale), source, comment: plusNote },
    { item: locale === "en" ? "Accounts payable buffer" : locale === "uz" ? "Kreditorlik buferi" : "Буфер кредиторки", amount: formatCurrencyFull(wc.accountsPayableBuffer, "UZS", locale), source, comment: minusNote },
    { item: locale === "en" ? "Seasonal stock buffer" : locale === "uz" ? "Mavsumiy zaxira buferi" : "Сезонный запас", amount: formatCurrencyFull(wc.seasonalStockBuffer, "UZS", locale), source, comment: plusNote },
    { item: locale === "en" ? "Total working capital" : locale === "uz" ? "Jami aylanma kapital" : "Итого оборотный капитал", amount: formatCurrencyFull(wc.requiredWorkingCapital, "UZS", locale), source, comment: totalNote }
  ];
}

function buildFinancingRows(financial: FinancialResult, locale: AppLocale): ReportBreakdownRow[] {
  const f = financial.financing;
  const source = sourceLabel("calculated", locale);
  const months = locale === "en" ? "months" : locale === "uz" ? "oy" : "мес.";
  const notSelectedCredit = locale === "en" ? "Credit not selected" : locale === "uz" ? "Kredit tanlanmagan" : "Кредит не выбран";
  const notSelectedLeasing = tReport(reportMessages.comments.leasingNotApplicable, locale);
  const availableComment = locale === "en" ? "Own funds plus confirmed external financing" : locale === "uz" ? "O'z mablag'i va tasdiqlangan tashqi moliyalashtirish" : "Собственные средства плюс подтвержденное внешнее финансирование";
  return [
    { item: locale === "en" ? "Total investment need" : locale === "uz" ? "Jami investitsiya ehtiyoji" : "Общая потребность в инвестициях", amount: formatCurrencyFull(f.totalInvestmentNeed, "UZS", locale), source, comment: locale === "en" ? "CapEx plus working capital" : locale === "uz" ? "CapEx va aylanma kapital" : "CapEx плюс оборотный капитал" },
    { item: locale === "en" ? "Own contribution" : locale === "uz" ? "O'z mablag'i" : "Собственные средства", amount: formatCurrencyWithOriginal(f.ownContributionUZS, f.ownContributionAmount, f.ownContributionCurrency, locale), source: sourceLabel("user_input", locale), comment: `${f.ownContributionPct}%` },
    { item: locale === "en" ? "Approved/requested loan" : locale === "uz" ? "Tasdiqlangan/so'ralgan kredit" : "Кредит", amount: f.creditNeeded === "yes" ? formatCurrencyFull(f.loanRequired, "UZS", locale) : getTranslations(locale).report.notApplicable, source: f.creditNeeded === "yes" ? sourceLabel(f.loanAnnualRateSource, locale) : source, comment: f.creditNeeded === "yes" ? `${f.loanAnnualRatePct}% / ${f.loanTermMonths} ${months}` : notSelectedCredit },
    { item: locale === "en" ? "Leasing" : locale === "uz" ? "Lizing" : "Лизинг", amount: f.leasingRequired > 0 ? formatCurrencyFull(f.leasingRequired, "UZS", locale) : getTranslations(locale).report.notApplicable, source: f.leasingRequired > 0 ? sourceLabel(f.leasingAnnualRateSource, locale) : source, comment: f.leasingRequired > 0 ? `${f.leasingAnnualRatePct}% / ${f.leasingTermMonths} ${months}` : notSelectedLeasing },
    { item: locale === "en" ? "Grants" : locale === "uz" ? "Grantlar" : "Гранты", amount: formatCurrencyFull(f.grants, "UZS", locale), source, comment: locale === "en" ? "Grant funding" : locale === "uz" ? "Grant moliyalashtirish" : "Грантовое финансирование" },
    { item: locale === "en" ? "Other funding" : locale === "uz" ? "Boshqa moliyalashtirish" : "Другое финансирование", amount: formatCurrencyFull(f.otherFunding, "UZS", locale), source, comment: locale === "en" ? "Other confirmed funding" : locale === "uz" ? "Boshqa tasdiqlangan moliyalashtirish" : "Другое подтвержденное финансирование" },
    { item: locale === "en" ? "Available funding" : locale === "uz" ? "Mavjud moliyalashtirish" : "Доступное финансирование", amount: formatCurrencyFull(f.availableFunding, "UZS", locale), source, comment: availableComment },
    { item: reportMetric("financingGap", locale), amount: formatCurrencyFull(f.financingGap, "UZS", locale), source, comment: locale === "en" ? "Uncovered investment need" : locale === "uz" ? "Qoplanmagan investitsiya ehtiyoji" : "Непокрытая потребность в инвестициях" },
    { item: locale === "en" ? "Funding surplus" : locale === "uz" ? "Ortiqcha moliyalashtirish" : "Излишек финансирования", amount: formatCurrencyFull(f.fundingSurplus, "UZS", locale), source, comment: locale === "en" ? "Funding above the investment need" : locale === "uz" ? "Investitsiya ehtiyojidan ortiq mablag'" : "Финансирование сверх потребности" },
    { item: "DSCR", amount: f.dscrLabel, source, comment: locale === "en" ? "EBITDA divided by debt service" : locale === "uz" ? "EBITDA qarz to'lovi bo'yicha bo'lingan" : "EBITDA / платежи по долгу" }
  ];
}

function buildCollateralRows(project: ProjectRecord, locale: AppLocale): ReportBreakdownRow[] {
  const profile = getProjectProfile(project) as Record<string, unknown>;
  const collateralAvailable = profile.collateralAvailable === true || profile.collateralAvailable === "yes";
  const notApplicable = getTranslations(locale).report.notApplicable;
  if (!collateralAvailable) {
    return [{
      item: locale === "en" ? "Collateral" : locale === "uz" ? "Garov" : "Залог",
      amount: notApplicable,
      source: sourceLabel("calculated", locale),
      comment: locale === "en" ? "Collateral not selected" : locale === "uz" ? "Garov tanlanmagan" : "Залог не выбран"
    }];
  }
  const type = typeof profile.collateralType === "string" && profile.collateralType.trim() ? profile.collateralType.trim() : notApplicable;
  const value = Number(profile.collateralEstimatedValue ?? 0);
  const quality = value > 0 ? "user_input" : "not_found";
  return [
    {
      item: locale === "en" ? "Collateral item" : locale === "uz" ? "Garov predmeti" : "Предмет залога",
      amount: type,
      source: sourceLabel("user_input", locale),
      comment: locale === "en" ? "Bank or leasing company must verify acceptability" : locale === "uz" ? "Bank yoki lizing kompaniyasi maqbulligini tekshirishi kerak" : "Банк или лизинговая компания должны подтвердить приемлемость"
    },
    {
      item: locale === "en" ? "Indicative collateral value" : locale === "uz" ? "Taxminiy garov qiymati" : "Ориентировочная стоимость залога",
      amount: value > 0 ? formatCurrencyFull(value, "UZS", locale) : notApplicable,
      source: sourceLabel(quality, locale),
      comment: value > 0
        ? (locale === "en" ? "User-stated indicative value; formal bank valuation is still required" : locale === "uz" ? "Foydalanuvchi kiritgan taxminiy qiymat; bank bahosi talab qilinadi" : "Оценка указана пользователем; банку потребуется собственная оценка")
        : (locale === "en" ? "Reliable market valuation was not found; manual valuation is required" : locale === "uz" ? "Ishonchli bozor bahosi topilmadi; qo'lda baholash talab qilinadi" : "Официальная/надежная рыночная оценка не найдена, требуется ручная оценка")
    },
    {
      item: locale === "en" ? "Supporting documents" : locale === "uz" ? "Tasdiqlovchi hujjatlar" : "Подтверждающие документы",
      amount: labelValue(profile.collateralDocumentsAvailable ?? "not_found", locale),
      source: sourceLabel("user_input", locale),
      comment: locale === "en" ? "Ownership and valuation documents must be checked" : locale === "uz" ? "Mulk huquqi va baholash hujjatlari tekshirilishi kerak" : "Нужно проверить документы собственности и оценку"
    }
  ];
}

function legacyWarningTitle(code: string, locale: AppLocale) {
  const map: Record<string, Record<AppLocale, string>> = {
    financing_gap: { ru: "Разрыв финансирования", en: "Financing gap", uz: "Moliyalashtirish tafovuti" },
    loan_terms_missing: { ru: "Неполные параметры кредита", en: "Incomplete loan terms", uz: "Kredit shartlari to'liq emas" },
    loan_rate_assumption: { ru: "Ставка кредита указана как допущение", en: "Loan rate uses an assumption", uz: "Kredit stavkasi faraz sifatida ishlatilgan" },
    repayment_type_assumption: { ru: "Тип погашения требует проверки", en: "Repayment type requires review", uz: "To'lov turi tekshirilishi kerak" },
    leasing_rate_assumption: { ru: "Ставка лизинга указана как допущение", en: "Leasing rate uses an assumption", uz: "Lizing stavkasi faraz sifatida ishlatilgan" },
    collateral_valuation_missing: { ru: "Оценка залога не подтверждена", en: "Collateral valuation not confirmed", uz: "Garov bahosi tasdiqlanmagan" },
    low_own_contribution: { ru: "Низкая доля собственных средств", en: "Low own contribution", uz: "O'z mablag'i ulushi past" },
    revenue_mismatch: { ru: "Расхождение в выручке", en: "Revenue mismatch", uz: "Tushumda tafovut" }
  };
  return map[code]?.[locale] ?? labelValue(code, locale);
}

function legacyWarningValueLabel(key: string, locale: AppLocale) {
  const map: Record<string, Record<AppLocale, string>> = {
    financingGap: { ru: "Разрыв финансирования", en: "Financing gap", uz: "Moliyalashtirish tafovuti" },
    assumedAnnualRatePct: { ru: "Допущенная годовая ставка", en: "Assumed annual rate", uz: "Faraz qilingan yillik stavka" },
    loanTermMonths: { ru: "Срок кредита", en: "Loan term", uz: "Kredit muddati" },
    loanRequired: { ru: "Сумма кредита", en: "Loan amount", uz: "Kredit summasi" },
    leasingRequired: { ru: "Сумма лизинга", en: "Leasing amount", uz: "Lizing summasi" },
    collateralType: { ru: "Предмет залога", en: "Collateral item", uz: "Garov predmeti" },
    providedRatePct: { ru: "Указанная ставка", en: "Provided rate", uz: "Kiritilgan stavka" },
    preferredRevenueSource: { ru: "Основной расчет выручки", en: "Primary revenue basis", uz: "Asosiy tushum hisobi" }
  };
  return map[key]?.[locale] ?? labelValue(key, locale);
}

function legacyFormatWarningValue(key: string, value: unknown, locale: AppLocale) {
  if (typeof value === "number") {
    if (/pct|rate/i.test(key)) return `${value}%`;
    if (/amount|gap|required|funding|loan|leasing/i.test(key)) return formatCurrencyFull(value, "UZS", locale);
    if (/months/i.test(key)) return `${value} ${locale === "en" ? "months" : locale === "uz" ? "oy" : "мес."}`;
  }
  return labelValue(value, locale);
}

function buildWarningRows(financial: FinancialResult, locale: AppLocale): ReportWarningRow[] {
  return (financial.warnings ?? []).map((warning) => ({
    title: formatWarningTitle(warning.code, locale),
    message: formatWarningMessage(warning.code, warning.message, locale),
    values: warning.values ? Object.entries(warning.values).map(([key, value]) => `${formatWarningValueLabel(key, locale)} - ${formatWarningValue(key, value, locale)}`).join("; ") : "",
    severity: labelValue(warning.severity ?? "medium", locale)
  }));
}

function buildPlaceholderMarketRows(project: ProjectRecord, locale: AppLocale): ReportMarketDataRow[] {
  const messages = getTranslations(locale).report;
  return [{
    indicator: messages.marketData,
    year: "",
    region: typeof project.region === "string" ? project.region : "",
    value: messages.officialDataNotFound,
    unit: "",
    currency: "",
    source: "",
    lastUpdated: "",
    matchQuality: labelValue("not_found", locale),
    explanation: messages.officialDataNotFound
  }];
}

function buildMarketRows(report: ReportData, project: ProjectRecord, locale: AppLocale): ReportMarketDataRow[] {
  const marketData = report.marketData;
  if (!marketData || marketData.dataPoints.length === 0) return buildPlaceholderMarketRows(project, locale);
  return marketData.dataPoints.map((point) => ({
    indicator: point.indicator,
    year: String(point.year),
    region: point.region ?? marketData.region ?? "",
    value: point.value === null || point.value === undefined ? getTranslations(locale).report.officialDataNotFound : String(point.value),
    unit: point.unit ?? "",
    currency: point.currency ?? "",
    source: point.sourceName,
    lastUpdated: point.lastUpdated ? new Date(point.lastUpdated).toISOString() : "",
    matchQuality: labelValue(point.matchQuality ?? "broad_proxy", locale),
    explanation: point.explanation ?? (locale === "en" ? "Selected as contextual market data for the business profile." : locale === "uz" ? "Biznes profili uchun kontekst bozor ma'lumoti sifatida tanlangan." : "Выбрано как справочный рыночный контекст для профиля бизнеса.")
  }));
}

function buildPlaceholderImportExportRows(locale: AppLocale): ReportImportExportRow[] {
  const messages = getTranslations(locale).report;
  return [{
    type: "",
    hsCode: "",
    productCategory: messages.officialDataNotFound,
    year: "",
    country: "",
    valueUsd: "",
    volume: "",
    unit: "",
    source: ""
  }];
}


function buildImportExportRows(report: ReportData, locale: AppLocale): ReportImportExportRow[] {
  const marketData = report.marketData;
  if (!marketData) return buildPlaceholderImportExportRows(locale);
  const rows = marketData.dataPoints
    .filter((point) => point.tradeType || point.hsCode || point.valueUsd !== undefined || point.volume !== undefined)
    .map((point) => ({
      type: point.tradeType ? labelValue(point.tradeType, locale) : "",
      hsCode: point.hsCode ?? "",
      productCategory: point.productCategory ?? point.indicator,
      year: String(point.year),
      country: point.country ?? "",
      valueUsd: point.valueUsd === null || point.valueUsd === undefined ? "" : String(point.valueUsd),
      volume: point.volume === null || point.volume === undefined ? "" : String(point.volume),
      unit: point.unit ?? "",
      source: point.sourceName
    }));
  return rows.length ? rows : buildPlaceholderImportExportRows(locale);
}

function buildPlaceholderSources(locale: AppLocale): ReportSourceRow[] {
  const messages = getTranslations(locale).report;
  return [{
    sourceName: messages.sources,
    sourceType: locale === "en" ? "Note" : locale === "uz" ? "Izoh" : "Примечание",
    url: "",
    year: "",
    lastUpdated: "",
    notes: messages.noOfficialSources
  }];
}


function cleanSourceNote(note: string, locale: AppLocale) {
  return note
    .replace(/\bexact\b/g, labelValue("exact", locale))
    .replace(/\bclose_proxy\b/g, labelValue("close_proxy", locale))
    .replace(/\bbroad_proxy\b/g, labelValue("broad_proxy", locale))
    .replace(/\bnot_found\b/g, labelValue("not_found", locale));
}

function buildSourceRows(report: ReportData, locale: AppLocale): ReportSourceRow[] {
  const marketData = report.marketData;
  if (!marketData || marketData.sources.length === 0) return buildPlaceholderSources(locale);
  return marketData.sources.map((source) => ({
    sourceName: source.sourceName,
    sourceType: labelValue(source.sourceType, locale),
    url: source.sourceUrl ?? "",
    year: source.year ? String(source.year) : "",
    lastUpdated: source.lastUpdated ?? "",
    notes: cleanSourceNote(source.notes ?? "", locale)
  }));
}

function toFileNameBase(project: ProjectRecord) {
  const locale = getReportLocale(project);
  return `finko-business-report-${locale}-${String(project.id ?? "project")}`;
}

function toBusinessType(project: ProjectRecord, locale: AppLocale) {
  const profile = getProjectProfile(project);
  return profile.businessType ? labelValue(profile.businessType, locale) : getTranslations(locale).report.notFilled;
}

export function prepareReportExport(project: ProjectRecord, localeOverride?: unknown): PreparedReportExport {
  const locale = getReportLocale(project, localeOverride);
  const messages = getTranslations(locale).report;
  const rawReport = resolveReportData(project);

  if (!rawReport) {
    throw new Error(messages.exportNotReady);
  }

  const report = localizeReportData(rawReport, locale);
  const profile = getProjectProfile(project);
  const financial = report.financialModel;
  const generatedAt = report.generatedAt ?? new Date().toISOString();
  const executiveSummary = Array.isArray(report.executiveSummary) ? report.executiveSummary : [report.executiveSummary];
  const detailedConclusion = report.detailedConclusion ?? [];
  const summary = [
    { label: messages.projectName, value: typeof project.title === "string" ? project.title : report.title },
    { label: messages.businessType, value: toBusinessType(project, locale) },
    { label: messages.region, value: typeof profile.region === "string" ? profile.region : messages.notFilled },
    { label: messages.district, value: typeof profile.district === "string" ? profile.district : messages.notFilled },
    { label: messages.plannedStart, value: typeof profile.plannedStartPeriod === "string" ? profile.plannedStartPeriod : messages.notFilled },
    { label: messages.overallScore, value: `${report.feasibilityScore}/100` },
    { label: messages.readiness, value: `${report.bankReadinessScore}/100` },
    { label: messages.keyFindings, value: executiveSummary[0] ?? messages.notFilled }
  ];

  return {
    locale,
    fileNameBase: toFileNameBase(project),
    title: report.title,
    cover: [
      { label: messages.projectName, value: typeof project.title === "string" ? project.title : report.title },
      { label: messages.businessType, value: toBusinessType(project, locale) },
      { label: messages.region, value: typeof profile.region === "string" ? profile.region : messages.notFilled },
      { label: messages.district, value: typeof profile.district === "string" ? profile.district : messages.notFilled },
      { label: messages.generatedAt, value: formatDate(generatedAt, locale) },
      {
        label: messages.language,
        value: locale === "uz" ? messages.languageUz : locale === "en" ? messages.languageEn : messages.languageRu
      }
    ],
    summary,
    executiveSummary,
    interviewRows: buildInterviewRows(project, locale),
    financialRows: buildFinancialRows(report, financial, locale),
    risks: buildRiskRows(report.riskMatrix ?? (project.riskResult as RiskItem[]), locale),
    marketData: buildMarketRows(report, project, locale),
    importExport: buildImportExportRows(report, locale),
    recommendations: buildRecommendations(report, locale),
    formulaRows: buildFormulaExportRows(financial, locale),
    capexRows: buildCapexRows(financial, locale),
    opexRows: buildOpexRows(financial, locale),
    financingRows: buildFinancingRows(financial, locale),
    workingCapitalRows: buildWorkingCapitalRows(financial, locale),
    collateralRows: buildCollateralRows(project, locale),
    warnings: buildWarningRows(financial, locale),
    sources: buildSourceRows(report, locale),
    detailedConclusion,
    financingRecommendation: report.financingRecommendation ?? messages.notApplicable,
    disclaimer: report.disclaimer ?? getLocalizedDisclaimer(locale),
    generatedAt: formatDate(generatedAt, locale),
    report
  };
}
