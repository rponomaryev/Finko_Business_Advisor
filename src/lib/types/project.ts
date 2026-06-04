export type RiskLevel = "low" | "medium" | "high";
export type RiskCategory =
  | "market"
  | "financial"
  | "operational"
  | "legal"
  | "infrastructure"
  | "bankability";
export type CurrencyCode = "UZS" | "USD";
export type CreditNeeded = "yes" | "no" | "unknown";
export type Locale = "ru" | "uz" | "en";
export type DataSourceKind =
  | "user_input"
  | "assumption"
  | "estimated"
  | "external_source"
  | "calculated";

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "boolean"
  | "staffPlan";

export type ExchangeRateSnapshot = {
  currency: "USD";
  rate: number;
  date: string;
  source: "cbu.uz" | "database-fallback" | "hardcoded-fallback";
  fetchedAt: string;
};

export type StaffPlanRole = {
  id?: string;
  role: string;
  count: number;
  monthlySalaryAmount: number;
  monthlySalaryCurrency: CurrencyCode;
  monthlySalaryUZS?: number;
};

export type StaffPlan = {
  roles: StaffPlanRole[];
  exchangeRateSnapshot?: ExchangeRateSnapshot;
};

export type InterviewQuestion = {
  key: string;
  label: string;
  question: string;
  type: QuestionType;
  unit?: string | null;
  options?: string[];
  helpText?: string;
  placeholder?: string;
  optional?: boolean;
  showIf?: Partial<Record<keyof StructuredProjectData, unknown | unknown[]>>;
};

export type InterviewBlock = {
  id: string;
  name: string;
  description: string;
  questions: InterviewQuestion[];
};

export type InterviewPlanBlock = {
  blockId: string;
  generatedBy: "ai" | "fallback" | "template";
  generatedAt: string;
  questions: InterviewQuestion[];
  requiredQuestionKeys: string[];
  optionalQuestionKeys: string[];
};

export type InterviewPlan = {
  version: "1.0";
  generatedAt: string;
  blocks: Record<string, InterviewPlanBlock>;
};

export type SectionNotes = {
  businessIdea?: string;
  premisesInfrastructure?: string;
  equipment?: string;
  productionCapacity?: string;
  rawMaterials?: string;
  salesMarketing?: string;
  finance?: string;
  complianceExperience?: string;
};

export type StructuredProjectData = {
  userLanguage?: Locale;
  title?: string;
  sectorCode?: string;
  templateCode?: string;
  businessType?: string;
  region?: string;
  district?: string;
  businessIdea?: string;
  productOrService?: string;
  revenueModel?: string;
  monthlySalesVolume?: number;
  monthlyOrders?: number;
  monthlyClients?: number;
  averageTicket?: number;
  averageServicePrice?: number;
  salesUnitLabel?: string;
  requiredPermits?: string;
  productionType?: string;
  toyType?: string;
  priceSegment?: string;
  productExamples?: string;
  designModel?: string;
  brandedPackaging?: boolean;
  ageGroup?: string;
  premisesStatus?: string;
  premisesAreaSqm?: number;
  infrastructureReady?: boolean;
  equipmentCondition?: string;
  supplierSelected?: boolean;
  supplierOfferAvailable?: boolean;
  equipmentDeliveryMonths?: number;
  serviceSupportUzbekistan?: boolean;
  staffTrainingNeeded?: boolean;
  monthlyCapacity?: number;
  skuCount?: number;
  shiftsPerDay?: number;
  employeesCount?: number;
  defectRatePct?: number;
  qualityControlPlan?: boolean;
  averagePrice?: number;
  targetCustomers?: string[];
  rawMaterialSource?: string;
  suppliersAvailable?: boolean;
  firstMonthRawMaterialStockUZS?: number;
  foreignCurrencyPurchases?: boolean;
  alternativeSuppliers?: boolean;
  hasBuyerAgreements?: boolean;
  clientPaymentTerm?: string;
  seasonalDemand?: boolean;
  firstThreeMonthsMonthlyRevenue?: number;
  stableMonthlyRevenue?: number;
  certificationAwareness?: string;
  packagingLabelingPlan?: boolean;
  sanitaryRequirementsKnown?: boolean;
  hasAccountantOrConsultant?: boolean;
  staffPlan?: StaffPlan;
  exchangeRateSnapshot?: ExchangeRateSnapshot;
  businessProfile?: {
    category?:
      | "food_service"
      | "manufacturing"
      | "retail"
      | "services"
      | "agriculture"
      | "ecommerce"
      | "education"
      | "healthcare"
      | "logistics"
      | "construction"
      | "b2b_services"
      | "generic";
    confidence?: number;
    relevantFocusAreas?: string[];
    businessCategory?: string;
    businessSubcategory?: string;
    revenueModel?: string;
    operationalModel?: string;
    hasInventory?: boolean;
    hasEquipment?: boolean;
    hasPremises?: boolean;
    hasStaff?: boolean;
    hasLicensing?: boolean;
    hasSeasonality?: boolean;
    salesChannels?: string[];
    keyCostDrivers?: string[];
    keyRisks?: string[];
    recommendedInterviewBlocks?: string[];
  };
  ownContribution?: number;
  ownContributionAmount?: number;
  ownContributionCurrency?: CurrencyCode;
  ownContributionUZS?: number;
  exchangeRateUZSPerUSD?: number;
  creditNeeded?: CreditNeeded;
  requestedLoanAmount?: number;
  requestedLoanCurrency?: CurrencyCode;
  requestedLoanUZS?: number;
  loanPurpose?: string;
  loanTermMonths?: number;
  loanAnnualRatePct?: number;
  loanGracePeriodMonths?: number;
  loanRepaymentType?: "annuity" | "equal_principal";
  requestedLeasingAmount?: number;
  requestedLeasingCurrency?: CurrencyCode;
  requestedLeasingUZS?: number;
  leasingItem?: string;
  leasingAdvancePayment?: number;
  leasingTermMonths?: number;
  leasingAnnualRatePct?: number;
  leasingMonthlyPayment?: number;
  leasingSupplier?: string;
  leasingOfferAvailable?: boolean;
  leasingDeliveryInstallationIncluded?: boolean;
  needsLeasing?: boolean;
  workingCapitalCreditNeeded?: boolean;
  calculatedExpenses?: string;
  contingencyReserveAvailable?: boolean;
  collateralAvailable?: boolean;
  collateralType?: string;
  collateralYear?: number;
  collateralCondition?: string;
  collateralEstimatedValue?: number;
  collateralDocumentsAvailable?: boolean;
  experienceLevel?: string;
  plannedStartPeriod?: string;
  moldRequired?: boolean;
  workingCapitalNeeded?: boolean;
  hasOperatingBusiness?: boolean;
  consultantNeeded?: boolean;
  sectionNotes?: SectionNotes;
  otherDetails?: Record<string, string>;
  preferredRevenueSource?: "calculated" | "stable";
  utilizationRatePct?: number;
  rawMaterialCostPerUnit?: number;
  packagingCostPerUnit?: number;
  directLogisticsCostPerUnit?: number;
  marketplaceCommissionPerUnit?: number;
  otherVariableCostPerUnit?: number;
  wasteAllowancePct?: number;
  monthlyRent?: number;
  monthlyUtilities?: number;
  monthlyMarketing?: number;
  monthlyMaintenance?: number;
  monthlyTaxes?: number;
  monthlyLogistics?: number;
  monthlySoftware?: number;
  monthlyInsurance?: number;
  monthlyAccounting?: number;
  monthlyOtherOpex?: number;
  equipmentCapex?: number;
  premisesSetupCapex?: number;
  furnitureFixturesCapex?: number;
  itPosWebsiteCapex?: number;
  registrationCertificationCapex?: number;
  initialInventoryCapex?: number;
  deliveryInstallationCapex?: number;
  trainingLaunchCapex?: number;
  capexReserve?: number;
  otherCapex?: number;
  workingCapitalBufferMonths?: number;
  accountsReceivableBufferUZS?: number;
  accountsPayableBufferUZS?: number;
  seasonalStockBufferUZS?: number;
  approvedLoanAmount?: number;
  approvedLoanCurrency?: CurrencyCode;
  approvedLeasingAmount?: number;
  approvedLeasingCurrency?: CurrencyCode;
  grants?: number;
  otherFunding?: number;
  interviewCursorBlockId?: string;
  interviewPlan?: InterviewPlan;
  completedBlockIds?: string[];
};

export type SectorAssumptions = {
  minViableInvestmentUZS: number;
  recommendedOwnContributionMinPct: number;
  recommendedOwnContributionMaxPct: number;
  typicalGrossMarginMinPct: number;
  typicalGrossMarginMaxPct: number;
  defaultGrossMarginPct: number;
  defaultMonthlyFixedCostsUZS: number;
  defaultVariableCostPct: number;
  defaultLoanAnnualRatePct: number;
  defaultLeasingAnnualRatePct: number;
  defaultLoanTermMonths: number;
  defaultLeasingTermMonths: number;
  defaultWorkingCapitalMonths: number;
  defaultCertificationCostUZS: number;
  defaultMoldCostUZS: number;
  defaultEquipmentCostUZS: number;
  defaultPremisesSetupCostUZS: number;
  defaultPackagingSetupCostUZS: number;
  defaultInitialInventoryCostUZS: number;
  defaultExpectedUtilizationPct: number;
  defaultExchangeRateUZSPerUSD: number;
};

export type FinancialResult = {
  warnings: Array<{
    code: string;
    severity?: "low" | "medium" | "high";
    title?: string;
    message: string;
    messageKey?: string;
    values?: Record<string, string | number>;
  }>;
  formulaRows: Array<{
    indicator: string;
    formula: string;
    substitution: string;
    result: string;
    source: DataSourceKind;
  }>;
  capex: {
    equipmentCost: number;
    moldCost: number;
    premisesSetupCost: number;
    packagingSetupCost: number;
    certificationCost: number;
    initialInventoryCost: number;
    reserveCost: number;
    furnitureFixturesCapex: number;
    itPosWebsiteCapex: number;
    deliveryInstallationCapex: number;
    trainingLaunchCapex: number;
    otherCapex: number;
    totalCapEx: number;
    lineItems: Array<{
      key: string;
      label: string;
      amount: number;
      source: DataSourceKind;
    }>;
  };
  workingCapital: {
    monthlyFixedCosts: number;
    baseMonthlyFixedCosts: number;
    totalMonthlyPayrollUZS: number;
    workingCapitalMonths: number;
    bufferMonths: number;
    initialInventory: number;
    accountsReceivableBuffer: number;
    accountsPayableBuffer: number;
    seasonalStockBuffer: number;
    requiredWorkingCapital: number;
    formula: string;
  };
  revenue: {
    monthlyCapacity: number;
    effectiveUnits: number;
    volumeLabel?: string;
    unitLabel?: string;
    averagePrice: number;
    expectedUtilizationPct: number;
    calculatedMonthlyRevenue: number;
    stableMonthlyRevenue?: number;
    revenueSource: "calculated" | "stable";
    monthlyRevenue: number;
    annualRevenue: number;
  };
  cogs: {
    rawMaterialCostPerUnit: number;
    packagingCostPerUnit: number;
    directLogisticsCostPerUnit: number;
    marketplaceCommissionPerUnit: number;
    otherVariableCostPerUnit: number;
    wasteAllowancePct: number;
    unitCOGS: number;
    wasteAdjustedUnitCOGS: number;
    monthlyCOGS: number;
    source: DataSourceKind;
  };
  opex: {
    monthlyPayroll: number;
    monthlyRent: number;
    monthlyUtilities: number;
    monthlyMarketing: number;
    monthlyMaintenance: number;
    monthlyTaxes: number;
    monthlyLogistics: number;
    monthlySoftware: number;
    monthlyInsurance: number;
    monthlyAccounting: number;
    monthlyOtherOpex: number;
    monthlyFixedOpex: number;
    lineItems: Array<{
      key: string;
      label: string;
      amount: number;
      source: DataSourceKind;
    }>;
  };
  profitability: {
    grossMarginPct: number;
    monthlyGrossProfit: number;
    monthlyEBITDA: number;
    ebitdaMarginPct: number;
    contributionMarginPerUnit: number;
    breakEvenUnits: number | null;
    breakEvenRevenue: number | null;
    monthlyNetCashFlow: number;
    paybackMonths: number | null;
  };
  payroll: {
    roles: StaffPlanRole[];
    totalMonthlyPayrollUZS: number;
    exchangeRateSnapshot?: ExchangeRateSnapshot;
  };
  financing: {
    creditNeeded: CreditNeeded;
    ownContributionAmount: number;
    ownContributionCurrency: CurrencyCode;
    ownContributionUZS: number;
    ownContribution: number;
    ownContributionPct: number;
    exchangeRateUZSPerUSD: number;
    requestedLoanUZS: number;
    loanRequired: number;
    loanCurrency: CurrencyCode;
    loanPurpose?: string;
    loanTermMonths: number;
    loanAnnualRatePct: number;
    loanAnnualRateSource: DataSourceKind;
    loanGracePeriodMonths: number;
    loanRepaymentType: "annuity" | "equal_principal";
    totalLoanInterest: number;
    leasingRequired: number;
    leasingCurrency: CurrencyCode;
    leasingTermMonths: number;
    leasingAnnualRatePct: number;
    leasingAnnualRateSource: DataSourceKind;
    leasingAdvancePayment: number;
    leasingPaymentSource: DataSourceKind;
    estimatedMonthlyLoanPayment: number;
    estimatedMonthlyLeasingPayment: number;
    totalMonthlyDebtService: number;
    totalInvestmentNeed: number;
    availableFunding: number;
    financingGap: number;
    fundingSurplus: number;
    grants: number;
    otherFunding: number;
    dscr: number | null;
    dscrLabel: string;
  };
};

export type RiskItem = {
  code: string;
  title: string;
  category: RiskCategory;
  probability: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  level: RiskLevel;
  score: number;
  description: string;
  reason: string;
  mitigation: string;
  owner?: string;
  timing?: string;
};

export type AiExtractionResult = {
  mode: "openai" | "fallback";
  detectedSector: string;
  confidence: number;
  extractedFields: StructuredProjectData;
  missingFields: string[];
  nextQuestions: Array<{
    key: string;
    question: string;
    type: QuestionType;
    unit?: string | null;
    options?: string[] | null;
  }>;
  advisorMessage: string;
};
