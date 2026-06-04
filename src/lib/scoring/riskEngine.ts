import type { RiskCategory, RiskItem, RiskLevel, StructuredProjectData } from "../types/project";

const levelRank: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };
const categoryLabels: Record<RiskCategory, string> = {
  market: "Рынок",
  financial: "Финансы",
  operational: "Операции",
  legal: "Право/сертификация",
  infrastructure: "Инфраструктура",
  bankability: "Финансируемость"
};

function levelFromScore(score: number): RiskLevel {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function risk(input: Omit<RiskItem, "level" | "score">): RiskItem {
  const score = input.probability * input.impact;
  return { ...input, score, level: levelFromScore(score) };
}

function hasDetailed(text?: string): boolean {
  return Boolean(text && text.trim().length >= 40);
}

function isToyBusiness(project: StructuredProjectData): boolean {
  return /игруш|toy|o'yinchoq|oyinchoq/i.test(`${project.businessType ?? ""} ${project.productOrService ?? ""}`);
}

export function evaluateCertificationRisk(project: StructuredProjectData): RiskItem {
  const toyBusiness = isToyBusiness(project);
  const isYoungAge = toyBusiness && project.ageGroup === "age_0_3";
  const hasPlan = project.certificationAwareness === "aware" || project.hasAccountantOrConsultant || hasDetailed(project.sectionNotes?.complianceExperience);
  const probability: 1 | 2 | 3 = hasPlan ? 1 : project.certificationAwareness === "partly_aware" ? 2 : 3;
  const impact: 1 | 2 | 3 = isYoungAge || project.certificationAwareness !== "aware" ? 3 : 2;
  return risk({
    code: "certification_risk",
    title: toyBusiness ? "Безопасность продукции и маркировка" : "Документы и разрешения",
    category: "legal",
    probability,
    impact,
    description: toyBusiness
      ? "Игрушки и детские товары требуют подтверждения безопасности, корректной маркировки и документов до продаж."
      : "Для запуска бизнеса могут потребоваться регистрация, договоры, разрешения, санитарные или отраслевые документы.",
    reason: hasPlan
      ? "План документов или консультант указан, но подтверждающие материалы нужно проверить."
      : isYoungAge
        ? "Игрушки для детей 0-3 лет требуют особенно внимательной проверки, а план документов не подтвержден."
        : "Пока нет полного понимания обязательных документов и разрешений.",
    mitigation: toyBusiness
      ? "Проверить требования к игрушкам, получить консультацию, заложить бюджет и сроки сертификации до закупки материалов и упаковки."
      : "Проверить отраслевые требования, получить консультацию, заложить бюджет и сроки оформления до запуска.",
    owner: "Предприниматель / консультант",
    timing: "До запуска продаж"
  });
}

export function evaluateFxRisk(project: StructuredProjectData): RiskItem {
  const imported = project.rawMaterialSource === "import" || project.rawMaterialSource === "mixed" || project.foreignCurrencyPurchases;
  const equipmentImported = project.equipmentCondition !== "not_selected" && !project.serviceSupportUzbekistan;
  const probability: 1 | 2 | 3 = imported && equipmentImported ? 3 : imported ? 2 : 1;
  const impact: 1 | 2 | 3 = project.alternativeSuppliers ? 2 : imported ? 3 : 1;
  return risk({
    code: "fx_risk",
    title: "Валютный риск",
    category: "financial",
    probability,
    impact,
    description: "Сырье, оборудование и запасные части могут зависеть от курса валют, а продажи обычно идут в UZS.",
    reason: imported ? "Планируются импортные или смешанные поставки, валютный буфер не подтвержден." : "Основная цепочка поставок выглядит локальной.",
    mitigation: "Сравнить локальных и импортных поставщиков, предусмотреть валютный запас в цене и иметь 2-3 альтернативных поставщика.",
    owner: "Финансы / закупки",
    timing: "До закупки сырья"
  });
}

export function evaluateWorkingCapitalRisk(project: StructuredProjectData): RiskItem {
  const paymentTerm = project.clientPaymentTerm;
  const longPayment = paymentTerm === "days_30" || paymentTerm === "days_60_plus";
  const ownUZS = Number(project.ownContributionUZS ?? project.ownContribution ?? project.ownContributionAmount ?? 0);
  const estimatedFixedCosts = 45_000_000;
  const monthsCovered = ownUZS / estimatedFixedCosts;
  const probability: 1 | 2 | 3 = longPayment && monthsCovered < 2 ? 3 : monthsCovered >= 3 ? 1 : 2;
  const impact: 1 | 2 | 3 = project.rawMaterialSource === "import" || !project.contingencyReserveAvailable ? 3 : 2;
  return risk({
    code: "working_capital_risk",
    title: "Оборотный капитал",
    category: "financial",
    probability,
    impact,
    description: "Бизнесу нужны деньги на закупки, аренду, зарплату и период до оплаты от клиентов.",
    reason: longPayment
      ? "Клиенты могут платить через 30+ дней, поэтому требуется резерв на закупки, зарплату и аренду."
      : monthsCovered >= 3
        ? "Собственные средства предварительно покрывают не менее 3 месяцев фиксированных расходов."
        : "Резерв оборотного капитала выглядит ограниченным.",
    mitigation: "Отдельно рассчитать закупки, график оплат клиентов и минимум 3 месяца фиксированных расходов.",
    owner: "Финансы",
    timing: "До подачи заявки"
  });
}

export function evaluateEquipmentRisk(project: StructuredProjectData): RiskItem {
  const noService = project.serviceSupportUzbekistan === false || project.supplierSelected === false;
  const probability: 1 | 2 | 3 = project.equipmentCondition === "used" || noService ? 3 : project.supplierSelected ? 1 : 2;
  const impact: 1 | 2 | 3 = project.monthlyCapacity && project.monthlyCapacity > 40000 ? 3 : 2;
  return risk({
    code: "equipment_risk",
    title: "Оборудование и сервис",
    category: "operational",
    probability,
    impact,
    description: "Срыв поставки, монтаж или простой оборудования снижает продажи, выпуск или качество услуги.",
    reason: project.equipmentCondition === "used" ? "Планируется б/у оборудование, сервис и запасные части нужно подтвердить." : noService ? "Поставщик или сервисная поддержка не подтверждены." : "Новое оборудование и поставщик указаны, но КП и гарантию нужно проверить.",
    mitigation: "Получить КП, гарантию, условия сервиса, список запасных частей или альтернатив и план обучения персонала.",
    owner: "Производство",
    timing: "До аванса поставщику"
  });
}

export function evaluateInfrastructureRisk(project: StructuredProjectData): RiskItem {
  const probability: 1 | 2 | 3 = project.premisesStatus === "searching" || project.premisesStatus === "land_required" ? 3 : project.infrastructureReady ? 1 : 2;
  const impact: 1 | 2 | 3 = project.infrastructureReady ? 2 : 3;
  return risk({
    code: "infrastructure_risk",
    title: "Помещение и инфраструктура",
    category: "infrastructure",
    probability,
    impact,
    description: "Площадка или локация влияет на запуск, поток клиентов, коммунальные условия, склад и доступ к транспорту.",
    reason: project.infrastructureReady ? "Помещение и инфраструктура заявлены, но параметры нужно проверить документально." : "Нет подтверждения готовности помещения, электричества или вентиляции.",
    mitigation: "Проверить коммунальные условия, склад, договор аренды/собственности, трафик и ограничения по деятельности.",
    owner: "Операции",
    timing: "До монтажа оборудования"
  });
}

export function evaluateSalesChannelRisk(project: StructuredProjectData): RiskItem {
  const channels = project.targetCustomers ?? [];
  const probability: 1 | 2 | 3 = channels.length >= 3 && project.hasBuyerAgreements ? 1 : channels.length >= 2 ? 2 : 3;
  const impact: 1 | 2 | 3 = project.averagePrice ? 2 : 3;
  return risk({
    code: "sales_channel_concentration",
    title: "Продажи и концентрация каналов",
    category: "market",
    probability,
    impact,
    description: "Зависимость от одного канала продаж повышает риск недозагрузки мощности и кассовых разрывов.",
    reason: channels.length >= 3 && project.hasBuyerAgreements ? "Указано несколько каналов и есть предварительные договоренности." : `Указано каналов продаж: ${channels.length || 0}. Подтвержденный спрос нужно усилить.`,
    mitigation: "Собрать письма о намерениях, прайс-листы, предварительные заказы и план продаж минимум по 3 каналам.",
    owner: "Продажи",
    timing: "До запуска производства"
  });
}

export function evaluateCollateralRisk(project: StructuredProjectData): RiskItem {
  if (project.creditNeeded === "no") {
    return {
      code: "collateral_risk",
      title: "Залог",
      category: "bankability",
      probability: 1,
      impact: 1,
      level: "low",
      score: 1,
      description: "Не применяется: пользователь не планирует кредитное финансирование.",
      reason: "Кредит не выбран, поэтому отсутствие залога не штрафует проект.",
      mitigation: "Оценивать достаточность собственных средств и/или лизинга оборудования.",
      owner: "Финансы",
      timing: "При изменении структуры финансирования"
    };
  }
  const hasCollateral = project.collateralAvailable === true;
  const value = Number(project.collateralEstimatedValue ?? 0);
  const loan = Number(project.requestedLoanUZS ?? project.requestedLoanAmount ?? 0);
  const probability: 1 | 2 | 3 = hasCollateral ? (value >= loan * 0.8 ? 1 : 2) : 3;
  const impact: 1 | 2 | 3 = project.creditNeeded === "yes" ? 3 : 2;
  return risk({
    code: "collateral_risk",
    title: "Залог и структура кредита",
    category: "bankability",
    probability,
    impact,
    description: "При кредитном финансировании банк оценивает залог, денежные потоки и документы.",
    reason: hasCollateral ? "Залог указан, но оценку и приемлемость нужно подтвердить." : "Кредит нужен, но залог не указан или не подтвержден.",
    mitigation: "Рассмотреть лизинг оборудования, увеличение собственных средств, гарантию, поручительство или альтернативные источники финансирования.",
    owner: "Финансы / банк",
    timing: "До подачи заявки"
  });
}

export function evaluateBankabilityRisk(project: StructuredProjectData): RiskItem {
  const detailedFinance = hasDetailed(project.sectionNotes?.finance);
  const probability: 1 | 2 | 3 = project.hasBuyerAgreements && detailedFinance ? 1 : project.hasBuyerAgreements ? 2 : 3;
  const impact: 1 | 2 | 3 = project.creditNeeded === "no" ? 2 : 3;
  return risk({
    code: "bankability_risk",
    title: "Готовность к финансированию",
    category: "bankability",
    probability,
    impact,
    description: "Для банка или лизинговой компании нужны продажи, финансовая модель, документы и понятный источник погашения.",
    reason: project.hasBuyerAgreements ? "Есть заявленные договоренности, их нужно подтвердить документами." : "Предварительные договоренности с покупателями пока не подтверждены.",
    mitigation: "Собрать КП, письма о намерениях, документы по помещению, план сертификации и управленческую финансовую модель.",
    owner: "Предприниматель / консультант",
    timing: "До подачи заявки"
  });
}

function evaluateMarketDemandRisk(project: StructuredProjectData): RiskItem {
  const hasDemandNotes = hasDetailed(project.sectionNotes?.salesMarketing);
  const hasChannels = (project.targetCustomers ?? []).length >= 2;
  return risk({
    code: "market_demand",
    title: "Рыночный спрос",
    category: "market",
    probability: hasDemandNotes && hasChannels ? 1 : hasChannels ? 2 : 3,
    impact: project.averagePrice || project.stableMonthlyRevenue ? 2 : 3,
    description: "Без подтвержденного спроса бизнес может не выйти на плановую выручку.",
    reason: hasDemandNotes && hasChannels ? "Каналы и спрос описаны, но их нужно подтвердить документами или тестовыми продажами." : "Подтверждение спроса и каналов продаж пока недостаточно конкретное.",
    mitigation: "Проверить цены конкурентов, собрать предварительные заказы, письма о намерениях или результаты тестовых продаж.",
    owner: "Продажи",
    timing: "До запуска"
  });
}

export function generateRiskMatrix(project: StructuredProjectData): RiskItem[] {
  return [
    evaluateMarketDemandRisk(project),
    evaluateCertificationRisk(project),
    evaluateFxRisk(project),
    evaluateInfrastructureRisk(project),
    evaluateWorkingCapitalRisk(project),
    evaluateEquipmentRisk(project),
    evaluateSalesChannelRisk(project),
    evaluateBankabilityRisk(project),
    evaluateCollateralRisk(project)
  ].sort((a, b) => levelRank[b.level] - levelRank[a.level] || b.score - a.score);
}

export function riskCategoryLabel(category: RiskCategory): string {
  return categoryLabels[category];
}
