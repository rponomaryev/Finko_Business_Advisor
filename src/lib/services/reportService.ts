import { mockFinancingProducts } from "../data/mockFinancingProducts.ts";
import type { FinancialResult, RiskItem, StructuredProjectData } from "../types/project.ts";
import type { MarketDataResult } from "../marketData/types.ts";
import { formatCurrencyCompact, formatCurrencyFull, formatCurrencyWithOriginal } from "../utils/formatCurrency.ts";
import { labelValue } from "../utils/labels.ts";
import { getProjectProfile } from "../utils/projectClient.ts";
import { getReportLocale } from "../i18n/reportMessages.ts";
import { localizeReportData } from "../report/localizeReport.ts";

export const MVP_DISCLAIMER =
  "Данный отчет является предварительной консультационной оценкой. Он не является гарантией прибыли, финансирования, одобрения кредита или инвестиционной рекомендацией. Рыночные числовые данные используются только при наличии источника; финансовые допущения необходимо проверить перед принятием решений.";

const localizedDisclaimers = {
  ru: MVP_DISCLAIMER,
  uz: "Ushbu hisobot dastlabki maslahat bahosidir. U foyda, moliyalashtirish, kredit ma'qullanishi yoki investitsiya tavsiyasini kafolatlamaydi. Bozor raqamli ma'lumotlari faqat manba mavjud bo'lsa ishlatiladi; moliyaviy farazlar qaror qabul qilishdan oldin tekshirilishi kerak.",
  en: "This report is a preliminary advisory assessment. It is not a guarantee of profit, financing, loan approval, or an investment recommendation. Market numeric data is used only when a source is available; financial assumptions must be verified before making decisions."
} as const;

export function getLocalizedDisclaimer(locale?: StructuredProjectData["userLanguage"]): string {
  return localizedDisclaimers[locale ?? "ru"] ?? localizedDisclaimers.ru;
}

const na = "Не применяется";
const safe = (value: unknown) => (value === undefined || value === null || value === "" ? "Не указано" : labelValue(value));
const employeeCountFromPayroll = (financial: FinancialResult, project: StructuredProjectData) => {
  const explicit = Number(project.employeesCount ?? 0);
  if (explicit > 0) return explicit;
  return financial.payroll?.roles?.reduce((sum, role) => sum + Math.max(0, Number(role.count ?? 0)), 0) ?? 0;
};
const payrollBreakdown = (financial: FinancialResult) => financial.payroll?.roles?.length
  ? financial.payroll.roles.map((role) => `${role.role} - ${role.count}`).join("; ")
  : "Данные пользователя";
const sourceLabelRu = (source: unknown) => source === "assumption" ? "Допущение" : source === "user_input" ? "Данные пользователя" : "Расчет";

export function generateExecutiveSummary(input: {
  project: StructuredProjectData;
  financial: FinancialResult;
  feasibilityScore: number;
  bankReadinessScore: number;
  marketData?: MarketDataResult;
}): string[] {
  const p = input.project;
  const f = input.financial;
  const totalNeed = f.financing?.totalInvestmentNeed ?? (f.capex.totalCapEx + f.workingCapital.requiredWorkingCapital);
  const businessType = safe(p.businessType);
  const marketDataNote = input.marketData?.dataPoints?.length
    ? `В отчет включены внешние рыночные данные из проверенных источников: ${input.marketData.sources.map((source) => source.sourceName).filter(Boolean).slice(0, 3).join(", ")}. Их нужно читать как справочный контекст, а не как гарантию спроса по конкретной точке продаж.`
    : "Официальные числовые рыночные данные для выбранного показателя не найдены; финансовые допущения необходимо подтвердить коммерческими предложениями и реальными продажами.";

  return [
    `Проект описывает запуск бизнеса "${businessType}" в регионе: ${safe(p.region)}, район/город: ${safe(p.district)}. Идея: ${safe(p.businessIdea)}.`,
    `Предварительная потребность в инвестициях составляет ${formatCurrencyFull(totalNeed)}: стартовые вложения ${formatCurrencyFull(f.capex.totalCapEx)} и оборотный капитал ${formatCurrencyFull(f.workingCapital.requiredWorkingCapital)}.`,
    `Собственные средства указаны как ${formatCurrencyWithOriginal(f.financing.ownContributionUZS, f.financing.ownContributionAmount, f.financing.ownContributionCurrency)}. Доля собственных средств в расчетной потребности: ${f.financing.ownContributionPct}%. Курс USD/UZS является расчетным допущением и должен быть проверен перед использованием.`,
    f.financing.creditNeeded === "no"
      ? "Пользователь не планирует кредит. Проект оценивается с точки зрения достаточности собственных средств и/или лизинга оборудования. DSCR для банковского кредита не применяется, если нет долговой нагрузки."
      : f.financing.creditNeeded === "yes"
        ? `Запрошенный кредит: ${formatCurrencyFull(f.financing.loanRequired)}, срок: ${f.financing.loanTermMonths} мес., ставка: ${f.financing.loanAnnualRatePct}% годовых (${sourceLabelRu(f.financing.loanAnnualRateSource)}), расчетный ежемесячный платеж: ${formatCurrencyFull(f.financing.estimatedMonthlyLoanPayment)}. DSCR: ${f.financing.dscrLabel}.`
      : "Пользователь пока не определился с кредитом. Расчет показывает проект без обязательного кредита и отдельно подсвечивает потребность во внешнем капитале.",
    marketDataNote,
    `Оценка реализуемости проекта: ${input.feasibilityScore}/100. Готовность к финансированию: ${input.bankReadinessScore}/100. Главные зоны проверки: спрос, продажи, поставщики, документы, оборудование, оборотный капитал и локация.`,
    "До подачи заявки необходимо подтвердить коммерческие предложения, предварительный спрос, документы по помещению, разрешения и структуру финансирования."
  ];
}

export function generateNextActions(input: { project: StructuredProjectData; risks: RiskItem[]; bankReadinessScore: number }): string[] {
  const actions = [
    "Подготовить коммерческие предложения по оборудованию, запуску, сервису и срокам поставки.",
    "Проверить документы, разрешения, договоры и отраслевые требования до запуска.",
    "Собрать подтверждение каналов продаж: письма о намерениях, предварительные заказы, прайс-листы.",
    "Отдельно рассчитать оборотный капитал: закупки, аренда, зарплата и период оплаты клиентами.",
    "Обновить финансовую модель после проверки цен поставщиков и реальной загрузки производства."
  ];
  if (input.project.creditNeeded === "yes" && !input.project.collateralAvailable) {
    actions.push("Для кредита рассмотреть лизинг оборудования, поручительство, гарантию, увеличение собственных средств или другой источник обеспечения.");
  }
  if (input.project.creditNeeded === "no") {
    actions.push("Проверить, хватает ли собственных средств и/или лизинга без привлечения банковского кредита.");
  }
  if (input.bankReadinessScore < 60) actions.push("До подачи заявки доработать бизнес-план с консультантом FINKO или профильным финансовым консультантом.");
  if (input.risks.some((risk) => risk.code === "fx_risk" && risk.level === "high")) actions.push("Найти локальных поставщиков и зафиксировать валютный буфер в цене.");
  return actions;
}

export function generateDetailedConclusion(input: { project: StructuredProjectData; financial: FinancialResult; risks: RiskItem[]; feasibilityScore: number; bankReadinessScore: number }): string[] {
  const highRisks = input.risks.filter((risk) => risk.level === "high").slice(0, 3).map((risk) => risk.title).join(", ") || "критичных рисков не выявлено";
  return [
    `Общая оценка проекта: ${input.feasibilityScore >= 65 ? "предварительно реализуемый" : "требует доработки перед запуском"}.`,
    "Сильные стороны проекта: понятная бизнес-идея, возможность уточнить финансирование и потенциал нескольких каналов продаж при подтверждении спроса.",
    `Слабые стороны: ${highRisks}. Эти зоны требуют проверки до финансовых обязательств.`,
    `Финансовое ограничение: расчетная потребность в инвестициях составляет ${formatCurrencyCompact(input.financial.financing?.totalInvestmentNeed ?? (input.financial.capex.totalCapEx + input.financial.workingCapital.requiredWorkingCapital))}.`,
    "Риски до запуска: выбор оборудования, помещение или локация, поставщики, документы и стартовые закупки.",
    "Риски после запуска: стабильность продаж, качество продукта или услуги, отсрочка платежей клиентов и закупки.",
    "Готовность к финансированию повышают КП поставщиков, письма о намерениях, подтвержденный залог или лизинговая структура, бухгалтерские документы и финансовая модель.",
    "Документы: регистрационные документы, договор помещения, КП оборудования, разрешения, данные по продажам, расчеты CapEx и оборотного капитала.",
    "Данные для проверки: цены оборудования, реальные закупочные цены, график поставок, маржа, плановый объем, сезонность и условия оплаты покупателей.",
    "Рекомендованный следующий шаг: доработать проектный профиль и провести консультацию по структуре финансирования до подачи заявки."
  ];
}

export function buildReportData(input: { project: StructuredProjectData & { title?: string; sectorCode?: string }; financial: FinancialResult; risks: RiskItem[]; feasibilityScore: number; bankReadinessScore: number; marketData?: MarketDataResult }) {
  const f = input.financial;
  const p = input.project;
  const totalInvestment = f.financing?.totalInvestmentNeed ?? (f.capex.totalCapEx + f.workingCapital.requiredWorkingCapital);
  const payrollTotal = f.payroll?.totalMonthlyPayrollUZS ?? 0;
  const exchangeRate = f.payroll?.exchangeRateSnapshot?.rate ?? f.financing.exchangeRateUZSPerUSD;
  const employeeCount = employeeCountFromPayroll(f, p);
  const nextActions = generateNextActions({ project: p, risks: input.risks, bankReadinessScore: input.bankReadinessScore });
  const highRisks = input.risks.filter((risk) => risk.level === "high");
  const baseReport = {
    title: input.project.title ?? "Предварительный отчет FINKO SME Business Advisor",
    executiveSummary: generateExecutiveSummary(input),
    projectProfile: p,
    financialModel: f,
    riskMatrix: input.risks,
    marketData: input.marketData,
    riskConclusion: {
      level: highRisks.length >= 3 ? "Высокий" : highRisks.length ? "Средний" : "Низкий",
      reasons: input.risks.slice(0, 3).map((risk) => risk.reason),
      actions: nextActions.slice(0, 3)
    },
    keyFigures: [
      ["Общий объем инвестиций", formatCurrencyFull(totalInvestment), "CapEx + оборотный капитал"],
      ["Собственные средства", formatCurrencyWithOriginal(f.financing.ownContributionUZS, f.financing.ownContributionAmount, f.financing.ownContributionCurrency), "Указанная сумма и эквивалент в UZS"],
      ["Доля собственных средств", `${f.financing.ownContributionPct}%`, "От расчетной потребности"],
      ["Разрыв финансирования", f.financing.financingGap > 0 ? formatCurrencyFull(f.financing.financingGap) : na, f.financing.financingGap > 0 ? "Нужно закрыть до запуска" : "Потребность покрыта"],
      ["Сумма кредита", f.financing.creditNeeded === "yes" ? formatCurrencyFull(f.financing.loanRequired) : na, f.financing.creditNeeded === "no" ? "Кредит не выбран" : "Требует уточнения"],
      ["Годовая ставка кредита", f.financing.creditNeeded === "yes" ? `${f.financing.loanAnnualRatePct}%` : na, f.financing.creditNeeded === "yes" ? sourceLabelRu(f.financing.loanAnnualRateSource) : "Кредит не применяется"],
      ["Ежемесячный платеж по кредиту", f.financing.creditNeeded === "yes" ? formatCurrencyFull(f.financing.estimatedMonthlyLoanPayment) : na, f.financing.creditNeeded === "yes" ? `${f.financing.loanAnnualRatePct}% годовых, ${f.financing.loanTermMonths} мес.` : "Кредит не применяется"],
      ["Сумма лизинга", f.financing.leasingRequired ? formatCurrencyFull(f.financing.leasingRequired) : na, f.financing.leasingRequired ? `${f.financing.leasingAnnualRatePct}% / ${f.financing.leasingTermMonths} мес.` : "Лизинг не применяется"],
      ["Стартовые CapEx", formatCurrencyFull(f.capex.totalCapEx), "Сумма видимых статей CapEx"],
      ["Оборотный капитал", formatCurrencyFull(f.workingCapital.requiredWorkingCapital), `${f.workingCapital.bufferMonths} мес. фиксированных расходов + запасы/буферы`],
      ["Фонд оплаты труда в месяц", formatCurrencyFull(payrollTotal), "Сумма по ролям и количеству сотрудников"],
      ["Месячная выручка", formatCurrencyFull(f.revenue.monthlyRevenue), "Volume × Price × Utilization"],
      ["Годовая выручка", formatCurrencyFull(f.revenue.annualRevenue), "Месячная выручка x 12"],
      ["COGS", formatCurrencyFull(f.cogs.monthlyCOGS), f.cogs.source === "assumption" ? "Допущение по себестоимости" : "Данные пользователя"],
      ["COGS за единицу", formatCurrencyFull(f.cogs.wasteAdjustedUnitCOGS), "С учетом списаний/потерь"],
      ["Валовая маржа", `${f.profitability.grossMarginPct}%`, "Gross profit / Revenue"],
      ["EBITDA", formatCurrencyFull(f.profitability.monthlyEBITDA), "Gross profit - OpEx"],
      ["Точка безубыточности", f.profitability.breakEvenRevenue === null ? na : formatCurrencyFull(f.profitability.breakEvenRevenue), "Fixed OpEx / Contribution margin"],
      ["DSCR", f.financing.dscrLabel, f.financing.totalMonthlyDebtService > 0 ? "EBITDA / Debt service" : "Не применяется без долговой нагрузки"],
      ["Срок окупаемости", f.profitability.paybackMonths === null ? na : `${f.profitability.paybackMonths} мес.`, f.profitability.paybackMonths === null ? "Не рассчитывается при отрицательном денежном потоке" : "Investment need / Net cash flow"],
      ["Количество сотрудников", employeeCount > 0 ? `${employeeCount}` : "Не указано", employeeCount > 0 ? payrollBreakdown(f) : "Данные пользователя"],
      ["Курс USD/UZS", exchangeRate.toLocaleString("ru-RU"), f.payroll?.exchangeRateSnapshot?.source === "cbu.uz" ? "Центральный банк Узбекистана" : "Расчетное допущение"],
      ["Дата курса USD/UZS", f.payroll?.exchangeRateSnapshot?.date ?? "Не указано", f.payroll?.exchangeRateSnapshot?.source ?? "Расчетное допущение"],
      ["Плановый объем", `${f.revenue.monthlyCapacity.toLocaleString("ru-RU")} ${f.revenue.unitLabel ?? "ед./мес."}`, "Данные пользователя" ]
    ],
    investmentBreakdown: [
      ...f.capex.lineItems.map((item) => [item.label, formatCurrencyFull(item.amount), item.source === "user_input" ? "Данные пользователя" : "Допущение"]),
      ["Оборотный капитал", formatCurrencyFull(f.workingCapital.requiredWorkingCapital), "Фиксированные расходы, запасы и буферы"],
      ["Итого инвестиций", formatCurrencyFull(totalInvestment), "CapEx + необходимый оборотный капитал"]
    ],
    financingRecommendation: p.creditNeeded === "no"
      ? `Пользователь не планирует кредит. Проект можно оценивать с точки зрения достаточности собственных средств и/или лизинга оборудования. Разрыв финансирования: ${f.financing.financingGap > 0 ? formatCurrencyFull(f.financing.financingGap) : "не выявлен"}.`
      : p.creditNeeded === "yes"
        ? `Кредит запрошен на сумму ${formatCurrencyFull(f.financing.loanRequired)}. Использованная ставка: ${f.financing.loanAnnualRatePct}% годовых (${sourceLabelRu(f.financing.loanAnnualRateSource)}). Расчетный платеж: ${formatCurrencyFull(f.financing.estimatedMonthlyLoanPayment)}, DSCR: ${f.financing.dscrLabel}. Нужно подтвердить залог, источник погашения и документы.`
        : "Кредит пока не выбран. Расчет показывает проект без обязательного кредита и какой внешний капитал может потребоваться после уточнения расходов.",
    detailedConclusion: generateDetailedConclusion(input),
    feasibilityScore: input.feasibilityScore,
    bankReadinessScore: input.bankReadinessScore,
    recommendedProducts: mockFinancingProducts,
    nextActions,
    warnings: f.warnings,
    formulaRows: f.formulaRows,
    capexBreakdown: f.capex.lineItems,
    opexBreakdown: f.opex.lineItems,
    workingCapitalBreakdown: f.workingCapital,
    financingBreakdown: f.financing,
    disclaimer: getLocalizedDisclaimer(p.userLanguage),
    generatedAt: new Date().toISOString()
  };

  return localizeReportData(baseReport as any, getReportLocale({ structuredData: p as Record<string, unknown>, userLanguage: p.userLanguage }));
}

export type ReportData = ReturnType<typeof buildReportData>;

export function hasCalculatedProjectReport(project: Record<string, unknown>) {
  return Boolean(
    project.financialResult &&
    project.riskResult &&
    typeof project.feasibilityScore === "number" &&
    typeof project.bankReadinessScore === "number"
  );
}

export function resolveReportData(project: Record<string, unknown>): ReportData | null {
  if (project.reportData && typeof project.reportData === "object") {
    const locale = getReportLocale(project);
    return localizeReportData(project.reportData as any, locale) as ReportData;
  }

  if (!hasCalculatedProjectReport(project)) {
    return null;
  }

  const profile = getProjectProfile(project);
  return buildReportData({
    project: {
      ...profile,
      title: typeof project.title === "string" ? project.title : undefined,
      sectorCode: typeof project.sectorCode === "string" ? project.sectorCode : profile.sectorCode
    },
    financial: project.financialResult as FinancialResult,
    risks: project.riskResult as RiskItem[],
    feasibilityScore: Number(project.feasibilityScore),
    bankReadinessScore: Number(project.bankReadinessScore)
  });
}

export function exportReportJson(reportData: unknown): string {
  return JSON.stringify(reportData, null, 2);
}
