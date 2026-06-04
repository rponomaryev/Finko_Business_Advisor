import { reportMessages, tReport, type ReportLocale } from "../i18n/reportMessages.ts";
import {
  buildLocalizedInvestmentBreakdown,
  buildLocalizedKeyFigures,
  formatCapexLabel,
  formatFormulaRows,
  formatOpexLabel,
  formatWarningMessage,
  formatWarningTitle,
  localizeRiskConclusion,
  localizeRisks,
  reportMetric,
  reportSourceLabel,
  reportStatus
} from "./reportFormatters.ts";
import type { FinancialResult, RiskItem } from "../types/project.ts";
import type { MarketDataResult } from "../marketData/types.ts";

type ReportData = {
  title: string;
  executiveSummary: string[] | string;
  projectProfile: Record<string, unknown>;
  financialModel: FinancialResult;
  riskMatrix: RiskItem[];
  marketData?: MarketDataResult;
  riskConclusion?: { level: string; reasons: string[]; actions: string[] };
  keyFigures?: Array<[string, string, string]>;
  investmentBreakdown?: Array<[string, string, string]>;
  financingRecommendation?: string;
  detailedConclusion?: string[];
  feasibilityScore: number;
  bankReadinessScore: number;
  recommendedProducts?: unknown;
  nextActions: string[];
  warnings?: FinancialResult["warnings"];
  formulaRows?: FinancialResult["formulaRows"];
  capexBreakdown?: FinancialResult["capex"]["lineItems"];
  opexBreakdown?: FinancialResult["opex"]["lineItems"];
  workingCapitalBreakdown?: FinancialResult["workingCapital"];
  financingBreakdown?: FinancialResult["financing"];
  disclaimer: string;
  generatedAt?: string;
};
import { formatCurrencyCompact, formatCurrencyFull, formatCurrencyWithOriginal } from "../utils/formatCurrency.ts";
import { labelValue } from "../utils/labels.ts";

function safe(value: unknown, locale: ReportLocale): string {
  return value === undefined || value === null || value === "" ? reportStatus("notFilled", locale) : labelValue(value, locale);
}

function marketDataNote(report: ReportData, locale: ReportLocale): string {
  const hasData = Boolean(report.marketData?.dataPoints?.length);
  if (hasData) {
    const sources = report.marketData?.sources.map((source) => source.sourceName).filter(Boolean).slice(0, 3).join(", ");
    if (locale === "en") return `External market data from verified sources is included: ${sources}. Treat it as reference context, not a guarantee of demand at a specific location.`;
    if (locale === "uz") return `Hisobotga tekshirilgan manbalardan tashqi bozor ma'lumotlari kiritilgan: ${sources}. Ularni aniq savdo nuqtasidagi talab kafolati emas, ma'lumotnoma konteksti sifatida o'qing.`;
    return `В отчет включены внешние рыночные данные из проверенных источников: ${sources}. Их нужно читать как справочный контекст, а не как гарантию спроса по конкретной точке продаж.`;
  }
  if (locale === "en") return "No official numeric market data was found for the selected indicator; financial assumptions must be confirmed by commercial offers and actual sales evidence.";
  if (locale === "uz") return "Tanlangan ko'rsatkich bo'yicha rasmiy raqamli bozor ma'lumotlari topilmadi; moliyaviy farazlarni tijorat takliflari va haqiqiy sotuv dalillari bilan tasdiqlash kerak.";
  return "Официальные числовые рыночные данные для выбранного показателя не найдены; финансовые допущения необходимо подтвердить коммерческими предложениями и реальными продажами.";
}

export function generateLocalizedExecutiveSummary(report: ReportData, locale: ReportLocale): string[] {
  const p = report.projectProfile;
  const f = report.financialModel;
  const totalNeed = f.financing?.totalInvestmentNeed ?? (f.capex.totalCapEx + f.workingCapital.requiredWorkingCapital);
  const businessType = safe(p.businessType, locale);
  const region = safe(p.region, locale);
  const district = safe(p.district, locale);
  const idea = safe(p.businessIdea, locale);
  if (locale === "en") {
    return [
      `The project describes the launch of a "${businessType}" business in ${region}, district/city: ${district}. Idea: ${idea}.`,
      `Preliminary investment need is ${formatCurrencyFull(totalNeed, "UZS", locale)}: startup investments ${formatCurrencyFull(f.capex.totalCapEx, "UZS", locale)} and working capital ${formatCurrencyFull(f.workingCapital.requiredWorkingCapital, "UZS", locale)}.`,
      `Own contribution is stated as ${formatCurrencyWithOriginal(f.financing.ownContributionUZS, f.financing.ownContributionAmount, f.financing.ownContributionCurrency, locale)}. Own contribution share of the calculated need: ${f.financing.ownContributionPct}%. The USD/UZS exchange rate is a calculation assumption and must be verified before use.`,
      f.financing.creditNeeded === "no"
        ? "The user does not plan a loan. The project is assessed based on sufficiency of own funds and/or equipment leasing. DSCR for a bank loan is not applicable if there is no debt service."
        : f.financing.creditNeeded === "yes"
          ? `Requested loan: ${formatCurrencyFull(f.financing.loanRequired, "UZS", locale)}, term: ${f.financing.loanTermMonths} months, annual rate: ${f.financing.loanAnnualRatePct}% (${reportSourceLabel(f.financing.loanAnnualRateSource, locale)}), estimated monthly payment: ${formatCurrencyFull(f.financing.estimatedMonthlyLoanPayment, "UZS", locale)}. DSCR: ${f.financing.dscrLabel}.`
          : "The user has not decided on a loan yet. The calculation shows the project without mandatory loan financing and highlights the potential need for external capital separately.",
      marketDataNote(report, locale),
      `Project feasibility score: ${report.feasibilityScore}/100. Financing readiness: ${report.bankReadinessScore}/100. Key validation areas: demand, sales, suppliers, documents, equipment, working capital and location.`,
      "Before submitting an application, confirm commercial offers, preliminary demand, premises documents, permits and financing structure."
    ];
  }
  if (locale === "uz") {
    return [
      `Loyiha ${region} hududi, tuman/shahar: ${district}da "${businessType}" biznesini ishga tushirishni tasvirlaydi. G'oya: ${idea}.`,
      `Dastlabki investitsiya ehtiyoji ${formatCurrencyFull(totalNeed, "UZS", locale)}: boshlang'ich investitsiyalar ${formatCurrencyFull(f.capex.totalCapEx, "UZS", locale)} va aylanma kapital ${formatCurrencyFull(f.workingCapital.requiredWorkingCapital, "UZS", locale)}.`,
      `O'z mablag'i ${formatCurrencyWithOriginal(f.financing.ownContributionUZS, f.financing.ownContributionAmount, f.financing.ownContributionCurrency, locale)} sifatida ko'rsatilgan. Hisoblangan ehtiyojdagi ulushi: ${f.financing.ownContributionPct}%. USD/UZS kursi hisob-kitob farazi bo'lib, ishlatishdan oldin tekshirilishi kerak.`,
      f.financing.creditNeeded === "no"
        ? "Foydalanuvchi kreditni rejalashtirmagan. Loyiha o'z mablag'i va/yoki uskunalar lizingi yetarliligi nuqtayi nazaridan baholanadi. Qarz yuklamasi bo'lmasa, bank krediti uchun DSCR qo'llanilmaydi."
        : f.financing.creditNeeded === "yes"
          ? `So'ralgan kredit: ${formatCurrencyFull(f.financing.loanRequired, "UZS", locale)}, muddat: ${f.financing.loanTermMonths} oy, yillik stavka: ${f.financing.loanAnnualRatePct}% (${reportSourceLabel(f.financing.loanAnnualRateSource, locale)}), hisoblangan oylik to'lov: ${formatCurrencyFull(f.financing.estimatedMonthlyLoanPayment, "UZS", locale)}. DSCR: ${f.financing.dscrLabel}.`
          : "Foydalanuvchi kredit bo'yicha hali qaror qilmagan. Hisob-kitob loyiha majburiy kreditsiz ko'rinishini va tashqi kapital ehtiyojini alohida ko'rsatadi.",
      marketDataNote(report, locale),
      `Loyiha amalga oshirish bahosi: ${report.feasibilityScore}/100. Moliyalashtirishga tayyorlik: ${report.bankReadinessScore}/100. Asosiy tekshiruv zonalari: talab, sotuvlar, yetkazib beruvchilar, hujjatlar, uskunalar, aylanma kapital va lokatsiya.`,
      "Ariza topshirishdan oldin tijorat takliflari, dastlabki talab, joy bo'yicha hujjatlar, ruxsatnomalar va moliyalashtirish tuzilmasini tasdiqlash kerak."
    ];
  }
  return [
    `Проект описывает запуск бизнеса "${businessType}" в регионе: ${region}, район/город: ${district}. Идея: ${idea}.`,
    `Предварительная потребность в инвестициях составляет ${formatCurrencyFull(totalNeed, "UZS", locale)}: стартовые вложения ${formatCurrencyFull(f.capex.totalCapEx, "UZS", locale)} и оборотный капитал ${formatCurrencyFull(f.workingCapital.requiredWorkingCapital, "UZS", locale)}.`,
    `Собственные средства указаны как ${formatCurrencyWithOriginal(f.financing.ownContributionUZS, f.financing.ownContributionAmount, f.financing.ownContributionCurrency, locale)}. Доля собственных средств в расчетной потребности: ${f.financing.ownContributionPct}%. Курс USD/UZS является расчетным допущением и должен быть проверен перед использованием.`,
    f.financing.creditNeeded === "no"
      ? "Пользователь не планирует кредит. Проект оценивается с точки зрения достаточности собственных средств и/или лизинга оборудования. DSCR для банковского кредита не применяется, если нет долговой нагрузки."
      : f.financing.creditNeeded === "yes"
        ? `Запрошенный кредит: ${formatCurrencyFull(f.financing.loanRequired, "UZS", locale)}, срок: ${f.financing.loanTermMonths} мес., ставка: ${f.financing.loanAnnualRatePct}% годовых (${reportSourceLabel(f.financing.loanAnnualRateSource, locale)}), расчетный ежемесячный платеж: ${formatCurrencyFull(f.financing.estimatedMonthlyLoanPayment, "UZS", locale)}. DSCR: ${f.financing.dscrLabel}.`
        : "Пользователь пока не определился с кредитом. Расчет показывает проект без обязательного кредита и отдельно подсвечивает потребность во внешнем капитале.",
    marketDataNote(report, locale),
    `Оценка реализуемости проекта: ${report.feasibilityScore}/100. Готовность к финансированию: ${report.bankReadinessScore}/100. Главные зоны проверки: спрос, продажи, поставщики, документы, оборудование, оборотный капитал и локация.`,
    "До подачи заявки необходимо подтвердить коммерческие предложения, предварительный спрос, документы по помещению, разрешения и структуру финансирования."
  ];
}

export function generateLocalizedNextActions(report: ReportData, locale: ReportLocale): string[] {
  const f = report.financialModel;
  const risks = report.riskMatrix;
  const base = locale === "en" ? [
    "Prepare commercial offers for equipment, launch, service and delivery timelines.",
    "Check documents, permits, contracts and industry requirements before launch.",
    "Collect sales-channel confirmation: letters of intent, preliminary orders and price lists.",
    "Calculate working capital separately: purchases, rent, payroll and customer payment periods.",
    "Update the financial model after checking supplier prices and realistic utilization."
  ] : locale === "uz" ? [
    "Uskunalar, ishga tushirish, servis va yetkazib berish muddatlari bo'yicha tijorat takliflarini tayyorlash.",
    "Ishga tushirishdan oldin hujjatlar, ruxsatnomalar, shartnomalar va soha talablarini tekshirish.",
    "Sotuv kanallarini tasdiqlash: niyat xatlari, dastlabki buyurtmalar va narxlar ro'yxatini yig'ish.",
    "Aylanma kapitalni alohida hisoblash: xaridlar, ijara, ish haqi va mijoz to'lov davrlari.",
    "Yetkazib beruvchi narxlari va real yuklama tekshirilgandan keyin moliyaviy modelni yangilash."
  ] : [
    "Подготовить коммерческие предложения по оборудованию, запуску, сервису и срокам поставки.",
    "Проверить документы, разрешения, договоры и отраслевые требования до запуска.",
    "Собрать подтверждение каналов продаж: письма о намерениях, предварительные заказы, прайс-листы.",
    "Отдельно рассчитать оборотный капитал: закупки, аренда, зарплата и период оплаты клиентами.",
    "Обновить финансовую модель после проверки цен поставщиков и реальной загрузки производства."
  ];
  const actions = [...base];
  if ((report.projectProfile as Record<string, unknown>).creditNeeded === "yes" && !(report.projectProfile as Record<string, unknown>).collateralAvailable) {
    actions.push(locale === "en" ? "For a loan, consider equipment leasing, surety, guarantee, higher own contribution or another collateral source." : locale === "uz" ? "Kredit uchun uskunalar lizingi, kafillik, kafolat, o'z mablag'ini oshirish yoki boshqa ta'minot manbasini ko'rib chiqish." : "Для кредита рассмотреть лизинг оборудования, поручительство, гарантию, увеличение собственных средств или другой источник обеспечения.");
  }
  if ((report.projectProfile as Record<string, unknown>).creditNeeded === "no") {
    actions.push(locale === "en" ? "Check whether own funds and/or leasing are sufficient without a bank loan." : locale === "uz" ? "Bank kreditisiz o'z mablag'i va/yoki lizing yetarliligini tekshirish." : "Проверить, хватает ли собственных средств и/или лизинга без привлечения банковского кредита.");
  }
  if (report.bankReadinessScore < 60) {
    actions.push(locale === "en" ? "Before applying, refine the business plan with a FINKO consultant or a specialized financial consultant." : locale === "uz" ? "Ariza topshirishdan oldin biznes-rejani FINKO konsultanti yoki profil moliyaviy konsultant bilan takomillashtirish." : "До подачи заявки доработать бизнес-план с консультантом FINKO или профильным финансовым консультантом.");
  }
  if (risks.some((risk) => risk.code === "fx_risk" && risk.level === "high")) {
    actions.push(locale === "en" ? "Find local suppliers and include an FX buffer in pricing." : locale === "uz" ? "Mahalliy yetkazib beruvchilarni topish va narxda valyuta buferini belgilash." : "Найти локальных поставщиков и зафиксировать валютный буфер в цене.");
  }
  return actions;
}

export function generateLocalizedDetailedConclusion(report: ReportData, locale: ReportLocale): string[] {
  const risks = localizeRisks(report.riskMatrix, locale);
  const highRisks = risks.filter((risk) => risk.level === "high").slice(0, 3).map((risk) => risk.title).join(", ") || reportStatus("noCriticalRisks", locale);
  const need = formatCurrencyCompact(report.financialModel.financing?.totalInvestmentNeed ?? (report.financialModel.capex.totalCapEx + report.financialModel.workingCapital.requiredWorkingCapital), "UZS", locale);
  if (locale === "en") {
    return [
      `Overall project assessment: ${report.feasibilityScore >= 65 ? reportStatus("feasible", locale) : reportStatus("improveBeforeLaunch", locale)}.`,
      "Project strengths: clear business idea, opportunity to clarify financing and potential for several sales channels if demand is confirmed.",
      `Weaknesses: ${highRisks}. These areas require validation before financial commitments.`,
      `Financial constraint: calculated investment need is ${need}.`,
      "Pre-launch risks: equipment selection, premises or location, suppliers, documents and startup purchases.",
      "Post-launch risks: stable sales, product or service quality, customer payment delays and purchases.",
      "Financing readiness is improved by supplier offers, letters of intent, confirmed collateral or leasing structure, accounting documents and a financial model.",
      "Documents: registration documents, premises agreement, equipment offers, permits, sales data, CapEx and working capital calculations.",
      "Data to verify: equipment prices, real purchase prices, delivery schedule, margin, planned volume, seasonality and buyer payment terms.",
      "Recommended next step: refine the project profile and consult on financing structure before applying."
    ];
  }
  if (locale === "uz") {
    return [
      `Loyihaning umumiy bahosi: ${report.feasibilityScore >= 65 ? reportStatus("feasible", locale) : reportStatus("improveBeforeLaunch", locale)}.`,
      "Loyihaning kuchli tomonlari: tushunarli biznes g'oya, moliyalashtirishni aniqlashtirish imkoniyati va talab tasdiqlansa bir nechta sotuv kanallari salohiyati.",
      `Zaif tomonlar: ${highRisks}. Bu zonalar moliyaviy majburiyatlardan oldin tekshiruvni talab qiladi.`,
      `Moliyaviy cheklov: hisoblangan investitsiya ehtiyoji ${need}.`,
      "Ishga tushirishgacha bo'lgan risklar: uskuna tanlovi, joy yoki lokatsiya, yetkazib beruvchilar, hujjatlar va boshlang'ich xaridlar.",
      "Ishga tushirishdan keyingi risklar: barqaror sotuvlar, mahsulot yoki xizmat sifati, mijozlar to'lovini kechiktirish va xaridlar.",
      "Moliyalashtirishga tayyorlikni yetkazib beruvchi takliflari, niyat xatlari, tasdiqlangan garov yoki lizing tuzilmasi, buxgalteriya hujjatlari va moliyaviy model oshiradi.",
      "Hujjatlar: ro'yxatdan o'tish hujjatlari, joy shartnomasi, uskuna bo'yicha tijorat takliflari, ruxsatnomalar, sotuv ma'lumotlari, CapEx va aylanma kapital hisoblari.",
      "Tekshiriladigan ma'lumotlar: uskuna narxlari, haqiqiy xarid narxlari, yetkazib berish grafigi, marja, rejalashtirilgan hajm, mavsumiylik va xaridorlar to'lov shartlari.",
      "Tavsiya etilgan keyingi qadam: ariza topshirishdan oldin loyiha profilini takomillashtirish va moliyalashtirish tuzilmasi bo'yicha konsultatsiya o'tkazish."
    ];
  }
  return [
    `Общая оценка проекта: ${report.feasibilityScore >= 65 ? reportStatus("feasible", locale) : reportStatus("improveBeforeLaunch", locale)}.`,
    "Сильные стороны проекта: понятная бизнес-идея, возможность уточнить финансирование и потенциал нескольких каналов продаж при подтверждении спроса.",
    `Слабые стороны: ${highRisks}. Эти зоны требуют проверки до финансовых обязательств.`,
    `Финансовое ограничение: расчетная потребность в инвестициях составляет ${need}.`,
    "Риски до запуска: выбор оборудования, помещение или локация, поставщики, документы и стартовые закупки.",
    "Риски после запуска: стабильность продаж, качество продукта или услуги, отсрочка платежей клиентов и закупки.",
    "Готовность к финансированию повышают КП поставщиков, письма о намерениях, подтвержденный залог или лизинговая структура, бухгалтерские документы и финансовая модель.",
    "Документы: регистрационные документы, договор помещения, КП оборудования, разрешения, данные по продажам, расчеты CapEx и оборотного капитала.",
    "Данные для проверки: цены оборудования, реальные закупочные цены, график поставок, маржа, плановый объем, сезонность и условия оплаты покупателей.",
    "Рекомендованный следующий шаг: доработать проектный профиль и провести консультацию по структуре финансирования до подачи заявки."
  ];
}

export function generateLocalizedFinancingRecommendation(report: ReportData, locale: ReportLocale): string {
  const f = report.financialModel.financing;
  if ((report.projectProfile as Record<string, unknown>).creditNeeded === "no") {
    const gap = f.financingGap > 0 ? formatCurrencyFull(f.financingGap, "UZS", locale) : (locale === "en" ? "not identified" : locale === "uz" ? "aniqlanmadi" : "не выявлен");
    if (locale === "en") return `The user does not plan a loan. The project can be assessed based on sufficiency of own funds and/or equipment leasing. Financing gap: ${gap}.`;
    if (locale === "uz") return `Foydalanuvchi kreditni rejalashtirmagan. Loyiha o'z mablag'i va/yoki uskunalar lizingi yetarliligi bo'yicha baholanishi mumkin. Moliyalashtirish bo'shlig'i: ${gap}.`;
    return `Пользователь не планирует кредит. Проект можно оценивать с точки зрения достаточности собственных средств и/или лизинга оборудования. Разрыв финансирования: ${gap}.`;
  }
  if ((report.projectProfile as Record<string, unknown>).creditNeeded === "yes") {
    if (locale === "en") return `A loan of ${formatCurrencyFull(f.loanRequired, "UZS", locale)} is requested. Rate used: ${f.loanAnnualRatePct}% annual (${reportSourceLabel(f.loanAnnualRateSource, locale)}). Estimated payment: ${formatCurrencyFull(f.estimatedMonthlyLoanPayment, "UZS", locale)}, DSCR: ${f.dscrLabel}. Collateral, repayment source and documents must be confirmed.`;
    if (locale === "uz") return `${formatCurrencyFull(f.loanRequired, "UZS", locale)} miqdorida kredit so'ralgan. Ishlatilgan stavka: yillik ${f.loanAnnualRatePct}% (${reportSourceLabel(f.loanAnnualRateSource, locale)}). Hisoblangan to'lov: ${formatCurrencyFull(f.estimatedMonthlyLoanPayment, "UZS", locale)}, DSCR: ${f.dscrLabel}. Garov, to'lov manbai va hujjatlarni tasdiqlash kerak.`;
    return `Кредит запрошен на сумму ${formatCurrencyFull(f.loanRequired, "UZS", locale)}. Использованная ставка: ${f.loanAnnualRatePct}% годовых (${reportSourceLabel(f.loanAnnualRateSource, locale)}). Расчетный платеж: ${formatCurrencyFull(f.estimatedMonthlyLoanPayment, "UZS", locale)}, DSCR: ${f.dscrLabel}. Нужно подтвердить залог, источник погашения и документы.`;
  }
  if (locale === "en") return "A loan has not been selected yet. The calculation shows the project without mandatory loan financing and the potential external capital need after expenses are clarified.";
  if (locale === "uz") return "Kredit hali tanlanmagan. Hisob-kitob loyiha majburiy kreditsiz holatini va xarajatlar aniqlangandan keyin kerak bo'lishi mumkin bo'lgan tashqi kapitalni ko'rsatadi.";
  return "Кредит пока не выбран. Расчет показывает проект без обязательного кредита и какой внешний капитал может потребоваться после уточнения расходов.";
}

function localizeFinancialMeta(financial: FinancialResult, locale: ReportLocale): FinancialResult {
  return {
    ...financial,
    formulaRows: formatFormulaRows(financial, locale),
    capex: {
      ...financial.capex,
      lineItems: financial.capex.lineItems.map((item) => ({ ...item, label: formatCapexLabel(item.key, item.label, locale) }))
    },
    opex: {
      ...financial.opex,
      lineItems: financial.opex.lineItems.map((item) => ({ ...item, label: formatOpexLabel(item.key, item.label, locale) }))
    },
    financing: {
      ...financial.financing,
      dscrLabel: financial.financing.dscr === null ? reportStatus("notApplicable", locale) : financial.financing.dscrLabel
    },
    warnings: (financial.warnings ?? []).map((warning) => ({
      ...warning,
      title: formatWarningTitle(warning.code, locale),
      message: formatWarningMessage(warning.code, warning.message, locale)
    }))
  };
}

export function localizeReportData(report: ReportData, locale: ReportLocale): ReportData {
  const financialModel = localizeFinancialMeta(report.financialModel, locale);
  const baseReport = { ...report, financialModel } as ReportData;
  const riskMatrix = localizeRisks(report.riskMatrix, locale);
  const nextActions = generateLocalizedNextActions(baseReport, locale);
  return {
    ...baseReport,
    executiveSummary: generateLocalizedExecutiveSummary(baseReport, locale),
    keyFigures: buildLocalizedKeyFigures(financialModel, report.projectProfile as { employeesCount?: number | null }, locale),
    investmentBreakdown: buildLocalizedInvestmentBreakdown(financialModel, locale),
    financingRecommendation: generateLocalizedFinancingRecommendation(baseReport, locale),
    detailedConclusion: generateLocalizedDetailedConclusion(baseReport, locale),
    riskMatrix,
    riskConclusion: localizeRiskConclusion(report.riskConclusion, locale, riskMatrix, nextActions),
    nextActions,
    warnings: financialModel.warnings,
    formulaRows: financialModel.formulaRows,
    capexBreakdown: financialModel.capex.lineItems,
    opexBreakdown: financialModel.opex.lineItems,
    disclaimer: locale === "en"
      ? "This report is a preliminary advisory assessment. It is not a guarantee of profit, financing, loan approval, or an investment recommendation. Market numeric data is used only when a source is available; financial assumptions must be verified before making decisions."
      : locale === "uz"
        ? "Ushbu hisobot dastlabki maslahat bahosidir. U foyda, moliyalashtirish, kredit ma'qullanishi yoki investitsiya tavsiyasini kafolatlamaydi. Bozor raqamli ma'lumotlari faqat manba mavjud bo'lsa ishlatiladi; moliyaviy farazlar qaror qabul qilishdan oldin tekshirilishi kerak."
        : report.disclaimer,
    marketData: report.marketData ? {
      ...report.marketData,
      messages: report.marketData.messages.length ? report.marketData.messages.map((message) => message.includes("Официальные числовые") || message.includes("official") ? (locale === "en" ? "No official numeric data was found for this indicator." : locale === "uz" ? "Bu ko'rsatkich bo'yicha rasmiy raqamli ma'lumotlar topilmadi." : message) : message) : report.marketData.messages
    } : report.marketData
  };
}
