import { reportMessages, tReport, type ReportLocale } from "../i18n/reportMessages.ts";
import type { DataSourceKind, FinancialResult, RiskItem } from "../types/project.ts";
import { formatCurrencyFull, formatCurrencyWithOriginal } from "../utils/formatCurrency.ts";
import { labelValue, localizeUnitLabel } from "../utils/labels.ts";

const numberLocale = (locale: ReportLocale) => locale === "en" ? "en-US" : locale === "uz" ? "uz-UZ" : "ru-RU";
const n = (value: number, locale: ReportLocale) => value.toLocaleString(numberLocale(locale));
const fill = (template: string, params: Record<string, string | number>) => Object.entries(params).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);

export function reportSourceLabel(source: unknown, locale: ReportLocale): string {
  const key = String(source ?? "") as keyof typeof reportMessages.source;
  return key in reportMessages.source ? tReport(reportMessages.source[key], locale) : labelValue(source, locale);
}

export function reportStatus(key: keyof typeof reportMessages.statuses, locale: ReportLocale): string {
  return tReport(reportMessages.statuses[key], locale);
}

export function reportMetric(key: keyof typeof reportMessages.metrics, locale: ReportLocale): string {
  return tReport(reportMessages.metrics[key], locale);
}

export function formatCapexLabel(key: string, fallback: string, locale: ReportLocale): string {
  const map = reportMessages.capex as Record<string, Record<ReportLocale, string>>;
  return map[key]?.[locale] ?? fallback;
}

export function formatOpexLabel(key: string, fallback: string, locale: ReportLocale): string {
  const map = reportMessages.opex as Record<string, Record<ReportLocale, string>>;
  return map[key]?.[locale] ?? fallback;
}

export function formatFormulaRows(financial: FinancialResult, locale: ReportLocale): FinancialResult["formulaRows"] {
  const f = financial;
  const money = (value: number | null) => value === null ? reportStatus("notApplicable", locale) : formatCurrencyFull(value, "UZS", locale);
  const formulas = reportMessages.formulas;
  return [
    {
      indicator: tReport(formulas.monthlyRevenue.indicator, locale),
      formula: tReport(formulas.monthlyRevenue.formula, locale),
      substitution: `${n(f.revenue.monthlyCapacity, locale)} × ${n(f.revenue.averagePrice, locale)} × ${f.revenue.expectedUtilizationPct}%`,
      result: money(f.revenue.monthlyRevenue),
      source: f.revenue.revenueSource === "stable" ? "user_input" : "calculated"
    },
    {
      indicator: tReport(formulas.cogs.indicator, locale),
      formula: tReport(formulas.cogs.formula, locale),
      substitution: `${n(f.revenue.effectiveUnits, locale)} × ${n(f.cogs.unitCOGS, locale)} × ${1 + f.cogs.wasteAllowancePct / 100}`,
      result: money(f.cogs.monthlyCOGS),
      source: f.cogs.source
    },
    {
      indicator: tReport(formulas.grossMargin.indicator, locale),
      formula: tReport(formulas.grossMargin.formula, locale),
      substitution: `${n(f.profitability.monthlyGrossProfit, locale)} / ${n(f.revenue.monthlyRevenue, locale)}`,
      result: `${f.profitability.grossMarginPct}%`,
      source: "calculated"
    },
    {
      indicator: tReport(formulas.opex.indicator, locale),
      formula: tReport(formulas.opex.formula, locale),
      substitution: f.opex.lineItems.map((item) => n(item.amount, locale)).join(" + "),
      result: money(f.opex.monthlyFixedOpex),
      source: "calculated"
    },
    {
      indicator: tReport(formulas.workingCapital.indicator, locale),
      formula: tReport(formulas.workingCapital.formula, locale),
      substitution: `${n(f.workingCapital.monthlyFixedCosts, locale)} × ${f.workingCapital.bufferMonths} + ${n(f.workingCapital.initialInventory, locale)} + ${n(f.workingCapital.accountsReceivableBuffer, locale)} - ${n(f.workingCapital.accountsPayableBuffer, locale)} + ${n(f.workingCapital.seasonalStockBuffer, locale)}`,
      result: money(f.workingCapital.requiredWorkingCapital),
      source: "calculated"
    },
    {
      indicator: tReport(formulas.financingGap.indicator, locale),
      formula: tReport(formulas.financingGap.formula, locale),
      substitution: `${n(f.financing.totalInvestmentNeed, locale)} - ${n(f.financing.availableFunding, locale)}`,
      result: money(f.financing.financingGap),
      source: "calculated"
    },
    {
      indicator: tReport(formulas.breakEven.indicator, locale),
      formula: tReport(formulas.breakEven.formula, locale),
      substitution: `${n(f.opex.monthlyFixedOpex, locale)} / ${n(f.profitability.contributionMarginPerUnit, locale)}`,
      result: f.profitability.breakEvenUnits === null ? reportStatus("notCalculated", locale) : `${n(f.profitability.breakEvenUnits, locale)} ${localizeUnitLabel(f.revenue.unitLabel ?? (locale === "en" ? "units" : locale === "uz" ? "birlik" : "ед."), locale)}`,
      source: "calculated"
    },
    {
      indicator: tReport(formulas.loanDscr.indicator, locale),
      formula: tReport(formulas.loanDscr.formula, locale),
      substitution: `${f.financing.loanAnnualRatePct}% / 12, ${f.financing.loanTermMonths} ${locale === "en" ? "months" : locale === "uz" ? "oy" : "мес."}, ${n(f.financing.loanRequired, locale)}; ${n(f.profitability.monthlyEBITDA, locale)} / ${n(f.financing.totalMonthlyDebtService, locale)}`,
      result: f.financing.totalMonthlyDebtService > 0 ? `${money(f.financing.totalMonthlyDebtService)}; DSCR ${f.financing.dscrLabel}` : reportStatus("notApplicable", locale),
      source: f.financing.loanAnnualRateSource === "assumption" || f.financing.leasingAnnualRateSource === "assumption" ? "assumption" : "calculated"
    }
  ];
}

function employeeCountFromFinancial(financial: FinancialResult): number {
  return financial.payroll?.roles?.reduce((sum, role) => sum + Math.max(0, Number(role.count ?? 0)), 0) ?? 0;
}

export function payrollBreakdown(financial: FinancialResult, locale: ReportLocale): string {
  return financial.payroll?.roles?.length
    ? financial.payroll.roles.map((role) => `${role.role} - ${role.count}`).join("; ")
    : tReport(reportMessages.comments.userData, locale);
}

export function buildLocalizedKeyFigures(financial: FinancialResult, project: { employeesCount?: number | null }, locale: ReportLocale): Array<[string, string, string]> {
  const f = financial;
  const m = (key: keyof typeof reportMessages.metrics) => reportMetric(key, locale);
  const c = (key: keyof typeof reportMessages.comments) => tReport(reportMessages.comments[key], locale);
  const totalInvestment = f.financing?.totalInvestmentNeed ?? (f.capex.totalCapEx + f.workingCapital.requiredWorkingCapital);
  const payrollTotal = f.payroll?.totalMonthlyPayrollUZS ?? 0;
  const employeeCount = Number(project.employeesCount ?? 0) > 0 ? Number(project.employeesCount) : employeeCountFromFinancial(f);
  const exchangeRate = f.payroll?.exchangeRateSnapshot?.rate ?? f.financing.exchangeRateUZSPerUSD;
  const notApplicable = reportStatus("notApplicable", locale);
  return [
    [m("totalInvestmentNeed"), formatCurrencyFull(totalInvestment, "UZS", locale), c("capexPlusWorkingCapital")],
    [m("ownContribution"), formatCurrencyWithOriginal(f.financing.ownContributionUZS, f.financing.ownContributionAmount, f.financing.ownContributionCurrency, locale), c("ownContributionEquivalent")],
    [m("ownContributionShare"), `${f.financing.ownContributionPct}%`, c("ownContributionOfNeed")],
    [m("financingGap"), f.financing.financingGap > 0 ? formatCurrencyFull(f.financing.financingGap, "UZS", locale) : notApplicable, f.financing.financingGap > 0 ? c("gapToClose") : c("needCovered")],
    [m("loanAmount"), f.financing.creditNeeded === "yes" ? formatCurrencyFull(f.financing.loanRequired, "UZS", locale) : notApplicable, f.financing.creditNeeded === "no" ? c("creditNotSelected") : c("creditNeedsClarification")],
    [m("annualLoanRate"), f.financing.creditNeeded === "yes" ? `${f.financing.loanAnnualRatePct}%` : notApplicable, f.financing.creditNeeded === "yes" ? reportSourceLabel(f.financing.loanAnnualRateSource, locale) : c("creditNotApplicable")],
    [m("monthlyLoanPayment"), f.financing.creditNeeded === "yes" ? formatCurrencyFull(f.financing.estimatedMonthlyLoanPayment, "UZS", locale) : notApplicable, f.financing.creditNeeded === "yes" ? fill(c("annualMonths"), { rate: f.financing.loanAnnualRatePct, months: f.financing.loanTermMonths }) : c("creditNotApplicable")],
    [m("leasingAmount"), f.financing.leasingRequired ? formatCurrencyFull(f.financing.leasingRequired, "UZS", locale) : notApplicable, f.financing.leasingRequired ? `${f.financing.leasingAnnualRatePct}% / ${f.financing.leasingTermMonths} ${locale === "en" ? "months" : locale === "uz" ? "oy" : "мес."}` : c("leasingNotApplicable")],
    [m("startupCapex"), formatCurrencyFull(f.capex.totalCapEx, "UZS", locale), c("capexVisibleItems")],
    [m("workingCapital"), formatCurrencyFull(f.workingCapital.requiredWorkingCapital, "UZS", locale), fill(c("workingCapitalFormula"), { months: f.workingCapital.bufferMonths })],
    [m("monthlyPayroll"), formatCurrencyFull(payrollTotal, "UZS", locale), c("payrollByRoles")],
    [m("monthlyRevenue"), formatCurrencyFull(f.revenue.monthlyRevenue, "UZS", locale), c("monthlyRevenueFormula")],
    [m("annualRevenue"), formatCurrencyFull(f.revenue.annualRevenue, "UZS", locale), c("annualRevenueFormula")],
    [m("cogs"), formatCurrencyFull(f.cogs.monthlyCOGS, "UZS", locale), f.cogs.source === "assumption" ? c("cogsAssumption") : c("userData")],
    [m("cogsPerUnit"), formatCurrencyFull(f.cogs.wasteAdjustedUnitCOGS, "UZS", locale), c("wasteAdjusted")],
    [m("grossMargin"), `${f.profitability.grossMarginPct}%`, c("grossProfitRevenue")],
    [m("ebitda"), formatCurrencyFull(f.profitability.monthlyEBITDA, "UZS", locale), c("grossProfitOpex")],
    [m("breakEven"), f.profitability.breakEvenRevenue === null ? notApplicable : formatCurrencyFull(f.profitability.breakEvenRevenue, "UZS", locale), c("fixedContribution")],
    [m("dscr"), f.financing.dscrLabel, f.financing.totalMonthlyDebtService > 0 ? c("debtService") : c("noDebtService")],
    [m("paybackPeriod"), f.profitability.paybackMonths === null ? notApplicable : `${f.profitability.paybackMonths} ${locale === "en" ? "months" : locale === "uz" ? "oy" : "мес."}`, f.profitability.paybackMonths === null ? c("noNegativeCashPayback") : c("investmentNetCash")],
    [m("employeeCount"), employeeCount > 0 ? `${employeeCount}` : reportStatus("notFilled", locale), employeeCount > 0 ? payrollBreakdown(f, locale) : c("userData")],
    [m("exchangeRate"), exchangeRate.toLocaleString(numberLocale(locale)), f.payroll?.exchangeRateSnapshot?.source === "cbu.uz" ? c("exchangeRateCbu") : c("exchangeRateAssumption")],
    [m("exchangeRateDate"), f.payroll?.exchangeRateSnapshot?.date ?? reportStatus("notFilled", locale), f.payroll?.exchangeRateSnapshot?.source ?? c("exchangeRateAssumption")],
    [m("plannedVolume"), `${n(f.revenue.monthlyCapacity, locale)} ${localizeUnitLabel(f.revenue.unitLabel ?? (locale === "en" ? "units/month" : locale === "uz" ? "birlik/oy" : "ед./мес."), locale)}`, c("userData")]
  ];
}

export function buildLocalizedInvestmentBreakdown(financial: FinancialResult, locale: ReportLocale): Array<[string, string, string]> {
  const c = (key: keyof typeof reportMessages.comments) => tReport(reportMessages.comments[key], locale);
  const totalInvestment = financial.financing?.totalInvestmentNeed ?? (financial.capex.totalCapEx + financial.workingCapital.requiredWorkingCapital);
  return [
    ...financial.capex.lineItems.map((item) => [formatCapexLabel(item.key, item.label, locale), formatCurrencyFull(item.amount, "UZS", locale), reportSourceLabel(item.source, locale)] as [string, string, string]),
    [reportMetric("workingCapital", locale), formatCurrencyFull(financial.workingCapital.requiredWorkingCapital, "UZS", locale), c("workingCapitalFormula").replace("{months}", String(financial.workingCapital.bufferMonths))],
    [locale === "en" ? "Total investments" : locale === "uz" ? "Jami investitsiyalar" : "Итого инвестиций", formatCurrencyFull(totalInvestment, "UZS", locale), c("capexPlusWorkingCapital")]
  ];
}

const warningTitles: Record<string, Record<ReportLocale, string>> = {
  revenue_conflict: { ru: "Расхождение в выручке", en: "Revenue mismatch", uz: "Tushumda tafovut" },
  cogs_assumption: { ru: "Допущение по себестоимости", en: "COGS assumption", uz: "Tannarx farazi" },
  negative_contribution_margin: { ru: "Отрицательная маржа", en: "Negative contribution margin", uz: "Manfiy marjinal daromad" },
  loan_conflict: { ru: "Конфликт по кредиту", en: "Loan conflict", uz: "Kredit bo'yicha nomuvofiqlik" },
  leasing_conflict: { ru: "Конфликт по лизингу", en: "Leasing conflict", uz: "Lizing bo'yicha nomuvofiqlik" },
  rent_missing: { ru: "Не указана аренда", en: "Rent missing", uz: "Ijara ko'rsatilmagan" },
  loan_terms_missing: { ru: "Неполные условия кредита", en: "Incomplete loan terms", uz: "Kredit shartlari to'liq emas" },
  loan_rate_assumption: { ru: "Ставка кредита указана как допущение", en: "Loan rate uses an assumption", uz: "Kredit stavkasi faraz sifatida ishlatilgan" },
  repayment_type_assumption: { ru: "Тип погашения требует проверки", en: "Repayment type requires review", uz: "To'lov turi tekshirilishi kerak" },
  leasing_rate_assumption: { ru: "Ставка лизинга указана как допущение", en: "Leasing rate uses an assumption", uz: "Lizing stavkasi faraz sifatida ishlatilgan" },
  collateral_valuation_missing: { ru: "Оценка залога не подтверждена", en: "Collateral valuation not confirmed", uz: "Garov bahosi tasdiqlanmagan" },
  fx_buffer_missing: { ru: "Не уточнен валютный буфер", en: "FX buffer not specified", uz: "Valyuta buferi aniqlanmagan" },
  seasonality_buffer_missing: { ru: "Не задан сезонный буфер", en: "Seasonal buffer missing", uz: "Mavsumiy bufer kiritilmagan" },
  financing_gap: { ru: "Разрыв финансирования", en: "Financing gap", uz: "Moliyalashtirish bo'shlig'i" }
};

const warningMessages: Record<string, Record<ReportLocale, string>> = {
  revenue_conflict: { ru: "Указанная стабильная выручка отличается от расчета по объему, цене и загрузке.", en: "The stated stable revenue differs from the calculation based on volume, price and utilization.", uz: "Kiritilgan barqaror tushum hajm, narx va yuklama bo'yicha hisob-kitobdan farq qiladi." },
  cogs_assumption: { ru: "Себестоимость за единицу не указана; COGS и маржа рассчитаны по допущению.", en: "Unit COGS is not specified; COGS and margin are calculated using an assumption.", uz: "Bir birlik tannarxi kiritilmagan; COGS va marja faraz asosida hisoblangan." },
  negative_contribution_margin: { ru: "Себестоимость равна или выше цены продажи; точка безубыточности не рассчитывается корректно.", en: "Cost is equal to or higher than sales price; break-even cannot be calculated reliably.", uz: "Tannarx sotuv narxiga teng yoki undan yuqori; zararsizlik nuqtasi ishonchli hisoblanmaydi." },
  loan_conflict: { ru: "Выбран вариант без кредита, но указана сумма кредита.", en: "No-credit option is selected, but a loan amount is entered.", uz: "Kreditsiz variant tanlangan, lekin kredit summasi kiritilgan." },
  leasing_conflict: { ru: "Выбран вариант без лизинга, но указана сумма лизинга.", en: "No-leasing option is selected, but a leasing amount is entered.", uz: "Lizingsiz variant tanlangan, lekin lizing summasi kiritilgan." },
  rent_missing: { ru: "Помещение отмечено как аренда, но ежемесячная аренда не указана; использовано допущение.", en: "Premises are marked as rented, but monthly rent is missing; an assumption was used.", uz: "Joy ijara deb belgilangan, lekin oylik ijara kiritilmagan; faraz ishlatilgan." },
  loan_terms_missing: { ru: "Кредит указан, но сумма, срок и/или цель кредита не заполнены полностью.", en: "A loan is selected, but amount, term and/or purpose is incomplete.", uz: "Kredit tanlangan, ammo summa, muddat va/yoki maqsad to'liq kiritilmagan." },
  loan_rate_assumption: { ru: "Процентная ставка кредита не указана. Расчет платежа и DSCR выполнен по допущению.", en: "Loan interest rate is not specified. Payment and DSCR are calculated using an assumption.", uz: "Kredit foiz stavkasi kiritilmagan. To'lov va DSCR faraz asosida hisoblangan." },
  repayment_type_assumption: { ru: "Пока поддерживается только аннуитетный расчет; график равными долями нужно проверить отдельно.", en: "Only annuity calculation is currently supported; equal-principal schedules must be checked separately.", uz: "Hozircha faqat annuitet hisob-kitobi qo'llab-quvvatlanadi; teng asosiy qarz grafigi alohida tekshirilishi kerak." },
  leasing_rate_assumption: { ru: "Ставка/удорожание лизинга не указаны. Расчет платежа выполнен по допущению.", en: "Leasing rate/markup is not specified. Payment is calculated using an assumption.", uz: "Lizing stavkasi/ustamasi kiritilmagan. To'lov faraz asosida hisoblangan." },
  collateral_valuation_missing: { ru: "Залог указан текстом, но надежная рыночная оценка не найдена или не введена.", en: "Collateral is described, but reliable market valuation is missing.", uz: "Garov ko'rsatilgan, ammo ishonchli bozor bahosi kiritilmagan yoki topilmagan." },
  fx_buffer_missing: { ru: "Указаны импортные поставки, но валютный буфер/валюта закупок не уточнены.", en: "Imported supplies are indicated, but FX buffer or purchase currency is not specified.", uz: "Import ta'minoti ko'rsatilgan, lekin valyuta buferi yoki xarid valyutasi aniqlanmagan." },
  seasonality_buffer_missing: { ru: "Продажи сезонные, но сезонный запас/буфер не задан; использовано упрощенное допущение.", en: "Sales are seasonal, but seasonal stock/buffer is missing; a simplified assumption was used.", uz: "Sotuvlar mavsumiy, ammo mavsumiy zaxira/bufer kiritilmagan; soddalashtirilgan faraz ishlatilgan." },
  financing_gap: { ru: "Есть разрыв финансирования. Нужно увеличить собственные средства, подтвердить кредит/лизинг или сократить стартовые вложения.", en: "There is a financing gap. Increase own funds, confirm loan/leasing, or reduce startup investments.", uz: "Moliyalashtirish bo'shlig'i bor. O'z mablag'ini oshirish, kredit/lizingni tasdiqlash yoki boshlang'ich xarajatlarni kamaytirish kerak." }
};

export function formatWarningTitle(code: string, locale: ReportLocale): string {
  return warningTitles[code]?.[locale] ?? labelValue(code, locale);
}

export function formatWarningMessage(code: string, fallback: string, locale: ReportLocale): string {
  return warningMessages[code]?.[locale] ?? fallback;
}

export function formatWarningValueLabel(key: string, locale: ReportLocale): string {
  const map: Record<string, Record<ReportLocale, string>> = {
    financingGap: reportMessages.metrics.financingGap,
    assumedAnnualRatePct: { ru: "Допущенная годовая ставка", en: "Assumed annual rate", uz: "Faraz qilingan yillik stavka" },
    assumedLeasingAnnualRatePct: { ru: "Допущенная ставка лизинга", en: "Assumed leasing rate", uz: "Faraz qilingan lizing stavkasi" },
    loanRequired: reportMessages.metrics.loanAmount,
    requestedLoanAmount: reportMessages.metrics.loanAmount,
    requestedLeasingAmount: reportMessages.metrics.leasingAmount,
    leasingRequired: reportMessages.metrics.leasingAmount,
    collateralType: { ru: "Предмет залога", en: "Collateral item", uz: "Garov predmeti" },
    calculatedMonthlyRevenue: reportMessages.metrics.monthlyRevenue,
    stableMonthlyRevenue: { ru: "Стабильная выручка", en: "Stable revenue", uz: "Barqaror tushum" },
    differencePct: { ru: "Отклонение", en: "Difference", uz: "Tafovut" },
    assumedUnitCOGS: reportMessages.metrics.cogsPerUnit
  };
  return map[key]?.[locale] ?? labelValue(key, locale);
}

export function formatWarningValue(key: string, value: unknown, locale: ReportLocale): string {
  if (typeof value === "number") {
    if (/pct|rate/i.test(key)) return `${value}%`;
    if (/amount|gap|required|loan|leasing|funding|revenue|cogs/i.test(key)) return formatCurrencyFull(value, "UZS", locale);
  }
  return labelValue(value, locale);
}

const riskCopy: Record<string, Record<ReportLocale, { title: string; description: string; reason: string; mitigation: string }>> = {
  market_demand: {
    ru: { title: "Рыночный спрос", description: "Без подтвержденного спроса бизнес может не выйти на плановую выручку.", reason: "Каналы и спрос описаны, но их нужно подтвердить документами или тестовыми продажами.", mitigation: "Проверить цены конкурентов, собрать предварительные заказы, письма о намерениях или результаты тестовых продаж." },
    en: { title: "Market demand", description: "Without confirmed demand, the business may not reach planned revenue.", reason: "Channels and demand are described, but need confirmation through documents or test sales.", mitigation: "Check competitor prices and collect pre-orders, letters of intent, or test sales results." },
    uz: { title: "Bozor talabi", description: "Tasdiqlangan talab bo'lmasa, biznes rejalashtirilgan tushumga chiqa olmasligi mumkin.", reason: "Kanallar va talab tasvirlangan, lekin hujjatlar yoki test sotuvlar bilan tasdiqlash kerak.", mitigation: "Raqobatchilar narxini tekshirish, oldindan buyurtmalar, niyat xatlari yoki test sotuv natijalarini yig'ish." }
  },
  certification_risk: {
    ru: { title: "Документы и разрешения", description: "Для запуска бизнеса могут потребоваться регистрация, договоры, разрешения, санитарные или отраслевые документы.", reason: "План документов или консультант указан, но подтверждающие материалы нужно проверить.", mitigation: "Проверить отраслевые требования, получить консультацию, заложить бюджет и сроки оформления до запуска." },
    en: { title: "Documents and permits", description: "Business launch may require registration, contracts, permits, sanitary or industry documents.", reason: "A document plan or consultant is indicated, but supporting materials must be checked.", mitigation: "Check industry requirements, get consultation, and budget time and cost for formalization before launch." },
    uz: { title: "Hujjatlar va ruxsatnomalar", description: "Biznesni ishga tushirish uchun ro'yxatdan o'tish, shartnomalar, ruxsatnomalar, sanitariya yoki soha hujjatlari kerak bo'lishi mumkin.", reason: "Hujjatlar rejasi yoki konsultant ko'rsatilgan, lekin tasdiqlovchi materiallarni tekshirish kerak.", mitigation: "Soha talablarini tekshirish, maslahat olish, ishga tushirishdan oldin rasmiylashtirish xarajati va muddatini rejalashtirish." }
  },
  fx_risk: {
    ru: { title: "Валютный риск", description: "Сырье, оборудование и запасные части могут зависеть от курса валют, а продажи обычно идут в UZS.", reason: "Планируются импортные или смешанные поставки, валютный буфер не подтвержден.", mitigation: "Сравнить локальных и импортных поставщиков, предусмотреть валютный запас в цене и иметь 2-3 альтернативных поставщика." },
    en: { title: "FX risk", description: "Raw materials, equipment and spare parts may depend on exchange rates, while sales are usually in UZS.", reason: "Imported or mixed supplies are planned, and the FX buffer is not confirmed.", mitigation: "Compare local and imported suppliers, include an FX buffer in pricing, and keep 2-3 alternative suppliers." },
    uz: { title: "Valyuta riski", description: "Xomashyo, uskunalar va ehtiyot qismlar valyuta kursiga bog'liq bo'lishi mumkin, sotuvlar esa odatda UZSda bo'ladi.", reason: "Import yoki aralash ta'minot rejalashtirilgan, valyuta buferi tasdiqlanmagan.", mitigation: "Mahalliy va import yetkazib beruvchilarni solishtirish, narxda valyuta zaxirasini hisobga olish va 2-3 muqobil yetkazib beruvchi topish." }
  },
  infrastructure_risk: {
    ru: { title: "Помещение и инфраструктура", description: "Площадка или локация влияет на запуск, поток клиентов, коммунальные условия, склад и доступ к транспорту.", reason: "Помещение и инфраструктура заявлены, но параметры нужно проверить документально.", mitigation: "Проверить коммунальные условия, склад, договор аренды/собственности, трафик и ограничения по деятельности." },
    en: { title: "Premises and infrastructure", description: "Site and location affect launch, customer flow, utilities, storage and transport access.", reason: "Premises and infrastructure are stated, but parameters need documentary verification.", mitigation: "Check utilities, storage, lease/ownership agreement, traffic and activity restrictions." },
    uz: { title: "Joy va infratuzilma", description: "Joy yoki lokatsiya ishga tushirish, mijozlar oqimi, kommunal sharoit, ombor va transportga kirishga ta'sir qiladi.", reason: "Joy va infratuzilma ko'rsatilgan, lekin parametrlarni hujjatlar bilan tekshirish kerak.", mitigation: "Kommunal sharoit, ombor, ijara/mulk shartnomasi, trafik va faoliyat cheklovlarini tekshirish." }
  },
  working_capital_risk: {
    ru: { title: "Оборотный капитал", description: "Бизнесу нужны деньги на закупки, аренду, зарплату и период до оплаты от клиентов.", reason: "Резерв оборотного капитала выглядит ограниченным.", mitigation: "Отдельно рассчитать закупки, график оплат клиентов и минимум 3 месяца фиксированных расходов." },
    en: { title: "Working capital", description: "The business needs cash for purchases, rent, payroll and the period before customer payments.", reason: "The working capital reserve looks limited.", mitigation: "Separately calculate purchases, customer payment schedule and at least 3 months of fixed expenses." },
    uz: { title: "Aylanma kapital", description: "Biznesga xaridlar, ijara, ish haqi va mijozlardan to'lov kelguncha bo'lgan davr uchun mablag' kerak.", reason: "Aylanma kapital zaxirasi cheklangan ko'rinadi.", mitigation: "Xaridlar, mijoz to'lovlari jadvali va kamida 3 oylik doimiy xarajatlarni alohida hisoblash." }
  },
  equipment_risk: {
    ru: { title: "Оборудование и сервис", description: "Срыв поставки, монтаж или простой оборудования снижает продажи, выпуск или качество услуги.", reason: "Планируется оборудование, сервис и запасные части нужно подтвердить.", mitigation: "Получить КП, гарантию, условия сервиса, список запасных частей или альтернатив и план обучения персонала." },
    en: { title: "Equipment and service", description: "Delivery, installation or equipment downtime can reduce sales, output or service quality.", reason: "Equipment is planned; service and spare parts need confirmation.", mitigation: "Obtain commercial offers, warranty, service terms, spare-part or alternative lists, and staff training plan." },
    uz: { title: "Uskunalar va servis", description: "Yetkazib berish, montaj yoki uskunaning to'xtab qolishi sotuv, ishlab chiqarish yoki xizmat sifatini pasaytiradi.", reason: "Uskunalar rejalashtirilgan; servis va ehtiyot qismlarni tasdiqlash kerak.", mitigation: "Tijorat takliflari, kafolat, servis shartlari, ehtiyot qismlar yoki muqobillar ro'yxati va xodimlarni o'qitish rejasini olish." }
  },
  sales_channel_concentration: {
    ru: { title: "Продажи и концентрация каналов", description: "Зависимость от одного канала продаж повышает риск недозагрузки мощности и кассовых разрывов.", reason: "Подтвержденный спрос нужно усилить.", mitigation: "Собрать письма о намерениях, прайс-листы, предварительные заказы и план продаж минимум по 3 каналам." },
    en: { title: "Sales and channel concentration", description: "Dependence on one sales channel increases underutilization and cash-gap risk.", reason: "Confirmed demand needs to be strengthened.", mitigation: "Collect letters of intent, price lists, preliminary orders and a sales plan for at least 3 channels." },
    uz: { title: "Sotuvlar va kanallar konsentratsiyasi", description: "Bitta sotuv kanaliga bog'liqlik quvvatdan kam foydalanish va kassa uzilishi riskini oshiradi.", reason: "Tasdiqlangan talabni kuchaytirish kerak.", mitigation: "Niyat xatlari, narxlar ro'yxati, dastlabki buyurtmalar va kamida 3 kanal bo'yicha sotuv rejasini yig'ish." }
  },
  bankability_risk: {
    ru: { title: "Готовность к финансированию", description: "Для банка или лизинговой компании нужны продажи, финансовая модель, документы и понятный источник погашения.", reason: "Предварительные договоренности с покупателями пока не подтверждены.", mitigation: "Собрать КП, письма о намерениях, документы по помещению, план сертификации и управленческую финансовую модель." },
    en: { title: "Financing readiness", description: "A bank or leasing company needs sales evidence, a financial model, documents and a clear repayment source.", reason: "Preliminary buyer agreements are not yet confirmed.", mitigation: "Collect commercial offers, letters of intent, premises documents, certification plan and management financial model." },
    uz: { title: "Moliyalashtirishga tayyorlik", description: "Bank yoki lizing kompaniyasi uchun sotuv dalillari, moliyaviy model, hujjatlar va aniq to'lov manbai kerak.", reason: "Xaridorlar bilan dastlabki kelishuvlar hali tasdiqlanmagan.", mitigation: "Tijorat takliflari, niyat xatlari, joy bo'yicha hujjatlar, sertifikatlash rejasi va boshqaruv moliyaviy modelini yig'ish." }
  },
  collateral_risk: {
    ru: { title: "Залог и структура кредита", description: "При кредитном финансировании банк оценивает залог, денежные потоки и документы.", reason: "Залог указан, но оценку и приемлемость нужно подтвердить.", mitigation: "Рассмотреть лизинг оборудования, увеличение собственных средств, гарантию, поручительство или альтернативные источники финансирования." },
    en: { title: "Collateral and loan structure", description: "For loan financing, a bank assesses collateral, cash flows and documents.", reason: "Collateral is indicated, but valuation and acceptability must be confirmed.", mitigation: "Consider equipment leasing, higher own contribution, guarantees, surety or alternative financing sources." },
    uz: { title: "Garov va kredit tuzilmasi", description: "Kredit moliyalashtirishida bank garov, pul oqimlari va hujjatlarni baholaydi.", reason: "Garov ko'rsatilgan, lekin bahosi va maqbulligini tasdiqlash kerak.", mitigation: "Uskunalar lizingi, o'z mablag'ini oshirish, kafolat, kafil yoki muqobil moliyalashtirish manbalarini ko'rib chiqish." }
  }
};

export function localizeRisk(risk: RiskItem, locale: ReportLocale): RiskItem {
  const copy = riskCopy[risk.code]?.[locale];
  if (!copy) return { ...risk, title: labelValue(risk.title, locale), reason: risk.reason, description: risk.description, mitigation: risk.mitigation };
  return { ...risk, ...copy };
}

export function localizeRisks(risks: RiskItem[], locale: ReportLocale): RiskItem[] {
  return risks.map((risk) => localizeRisk(risk, locale));
}

export function localizeRiskConclusion(conclusion: { level: string; reasons: string[]; actions: string[] } | undefined, locale: ReportLocale, localizedRisks: RiskItem[], actions: string[]) {
  if (!conclusion) return undefined;
  const highCount = localizedRisks.filter((risk) => risk.level === "high").length;
  const level = highCount >= 3 ? reportStatus("high", locale) : highCount ? reportStatus("medium", locale) : reportStatus("low", locale);
  return { level, reasons: localizedRisks.slice(0, 3).map((risk) => risk.reason), actions: actions.slice(0, 3) };
}
