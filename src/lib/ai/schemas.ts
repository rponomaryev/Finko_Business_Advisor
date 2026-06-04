import { z } from "zod";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
const nullableBoolean = { anyOf: [{ type: "boolean" }, { type: "null" }] };
const nullableStringArray = { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] };
const nullableStringArrayObject = { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] };

const sectionNotesSchemaJson = {
  type: "object",
  additionalProperties: false,
  properties: {
    businessIdea: nullableString,
    premisesInfrastructure: nullableString,
    equipment: nullableString,
    productionCapacity: nullableString,
    rawMaterials: nullableString,
    salesMarketing: nullableString,
    finance: nullableString,
    complianceExperience: nullableString
  },
  required: ["businessIdea", "premisesInfrastructure", "equipment", "productionCapacity", "rawMaterials", "salesMarketing", "finance", "complianceExperience"]
};

const fieldProperties = {
  businessType: nullableString,
  businessIdea: nullableString,
  productOrService: nullableString,
  plannedStartPeriod: nullableString,
  region: nullableString,
  district: nullableString,
  monthlySalesVolume: nullableNumber,
  monthlyOrders: nullableNumber,
  monthlyClients: nullableNumber,
  averageTicket: nullableNumber,
  averageServicePrice: nullableNumber,
  salesUnitLabel: nullableString,
  requiredPermits: nullableString,
  productionType: nullableString,
  toyType: nullableString,
  priceSegment: nullableString,
  premisesStatus: nullableString,
  equipmentCondition: nullableString,
  monthlyCapacity: nullableNumber,
  averagePrice: nullableNumber,
  targetCustomers: nullableStringArray,
  rawMaterialSource: nullableString,
  certificationAwareness: nullableString,
  supplierSelected: nullableBoolean,
  ownContributionAmount: nullableNumber,
  ownContributionCurrency: nullableString,
  ownContributionUZS: nullableNumber,
  exchangeRateUZSPerUSD: nullableNumber,
  creditNeeded: nullableString,
  requestedLoanAmount: nullableNumber,
  requestedLoanCurrency: nullableString,
  requestedLoanUZS: nullableNumber,
  loanPurpose: nullableString,
  loanTermMonths: nullableNumber,
  requestedLeasingAmount: nullableNumber,
  collateralAvailable: nullableBoolean,
  collateralType: nullableString,
  collateralEstimatedValue: nullableNumber,
  experienceLevel: nullableString,
  infrastructureReady: nullableBoolean,
  needsLeasing: nullableBoolean,
  moldRequired: nullableBoolean,
  hasBuyerAgreements: nullableBoolean,
  hasAccountantOrConsultant: nullableBoolean,
  businessProfile: {
    anyOf: [{
      type: "object",
      additionalProperties: false,
      properties: {
        businessCategory: nullableString,
        businessSubcategory: nullableString,
        revenueModel: nullableString,
        operationalModel: nullableString,
        hasInventory: nullableBoolean,
        hasEquipment: nullableBoolean,
        hasPremises: nullableBoolean,
        hasStaff: nullableBoolean,
        hasLicensing: nullableBoolean,
        hasSeasonality: nullableBoolean,
        salesChannels: nullableStringArrayObject,
        keyCostDrivers: nullableStringArrayObject,
        keyRisks: nullableStringArrayObject,
        recommendedInterviewBlocks: nullableStringArrayObject
      },
      required: [
        "businessCategory",
        "businessSubcategory",
        "revenueModel",
        "operationalModel",
        "hasInventory",
        "hasEquipment",
        "hasPremises",
        "hasStaff",
        "hasLicensing",
        "hasSeasonality",
        "salesChannels",
        "keyCostDrivers",
        "keyRisks",
        "recommendedInterviewBlocks"
      ]
    }, { type: "null" }]
  },
  staffPlan: {
    anyOf: [{
      type: "object",
      additionalProperties: false,
      properties: {
        roles: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              role: { type: "string" },
              count: { type: "number" },
              monthlySalaryAmount: { type: "number" },
              monthlySalaryCurrency: { type: "string" }
            },
            required: ["role", "count", "monthlySalaryAmount", "monthlySalaryCurrency"]
          }
        }
      },
      required: ["roles"]
    }, { type: "null" }]
  },
  sectionNotes: { anyOf: [sectionNotesSchemaJson, { type: "null" }] }
};

export const aiExtractionStructuredOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    detectedSector: { type: "string" },
    confidence: { type: "number" },
    extractedFields: {
      type: "object",
      additionalProperties: false,
      properties: fieldProperties,
      required: Object.keys(fieldProperties)
    },
    missingFields: { type: "array", items: { type: "string" } },
    nextQuestions: { type: "array", items: { type: "object", additionalProperties: false, properties: { key: { type: "string" }, question: { type: "string" }, type: { type: "string" }, unit: nullableString, options: nullableStringArray }, required: ["key", "question", "type", "unit", "options"] } },
    advisorMessage: { type: "string" }
  },
  required: ["detectedSector", "confidence", "extractedFields", "missingFields", "nextQuestions", "advisorMessage"]
} as const;

export const aiExtractionZodSchema = z.object({
  detectedSector: z.string().min(1),
  confidence: z.number().min(0).max(1),
  extractedFields: z.object({
    businessType: z.string().nullable().optional(),
    businessIdea: z.string().nullable().optional(),
    productOrService: z.string().nullable().optional(),
    plannedStartPeriod: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    monthlySalesVolume: z.number().nullable().optional(),
    monthlyOrders: z.number().nullable().optional(),
    monthlyClients: z.number().nullable().optional(),
    averageTicket: z.number().nullable().optional(),
    averageServicePrice: z.number().nullable().optional(),
    salesUnitLabel: z.string().nullable().optional(),
    requiredPermits: z.string().nullable().optional(),
    productionType: z.string().nullable().optional(),
    toyType: z.string().nullable().optional(),
    priceSegment: z.string().nullable().optional(),
    premisesStatus: z.string().nullable().optional(),
    equipmentCondition: z.string().nullable().optional(),
    monthlyCapacity: z.number().nullable().optional(),
    averagePrice: z.number().nullable().optional(),
    targetCustomers: z.array(z.string()).nullable().optional(),
    rawMaterialSource: z.string().nullable().optional(),
    certificationAwareness: z.string().nullable().optional(),
    supplierSelected: z.boolean().nullable().optional(),
    ownContributionAmount: z.number().nullable().optional(),
    ownContributionCurrency: z.enum(["UZS", "USD"]).nullable().optional(),
    ownContributionUZS: z.number().nullable().optional(),
    exchangeRateUZSPerUSD: z.number().nullable().optional(),
    creditNeeded: z.enum(["yes", "no", "unknown"]).nullable().optional(),
    requestedLoanAmount: z.number().nullable().optional(),
    requestedLoanCurrency: z.enum(["UZS", "USD"]).nullable().optional(),
    requestedLoanUZS: z.number().nullable().optional(),
    loanPurpose: z.string().nullable().optional(),
    loanTermMonths: z.number().nullable().optional(),
    requestedLeasingAmount: z.number().nullable().optional(),
    collateralAvailable: z.boolean().nullable().optional(),
    collateralType: z.string().nullable().optional(),
    collateralEstimatedValue: z.number().nullable().optional(),
    experienceLevel: z.string().nullable().optional(),
    infrastructureReady: z.boolean().nullable().optional(),
    needsLeasing: z.boolean().nullable().optional(),
    moldRequired: z.boolean().nullable().optional(),
    hasBuyerAgreements: z.boolean().nullable().optional(),
    hasAccountantOrConsultant: z.boolean().nullable().optional(),
    businessProfile: z.object({
      businessCategory: z.string().nullable().optional(),
      businessSubcategory: z.string().nullable().optional(),
      revenueModel: z.string().nullable().optional(),
      operationalModel: z.string().nullable().optional(),
      hasInventory: z.boolean().nullable().optional(),
      hasEquipment: z.boolean().nullable().optional(),
      hasPremises: z.boolean().nullable().optional(),
      hasStaff: z.boolean().nullable().optional(),
      hasLicensing: z.boolean().nullable().optional(),
      hasSeasonality: z.boolean().nullable().optional(),
      salesChannels: z.array(z.string()).nullable().optional(),
      keyCostDrivers: z.array(z.string()).nullable().optional(),
      keyRisks: z.array(z.string()).nullable().optional(),
      recommendedInterviewBlocks: z.array(z.string()).nullable().optional()
    }).nullable().optional(),
    staffPlan: z.object({
      roles: z.array(z.object({
        role: z.string(),
        count: z.number(),
        monthlySalaryAmount: z.number(),
        monthlySalaryCurrency: z.enum(["UZS", "USD"]).or(z.string())
      }))
    }).nullable().optional(),
    sectionNotes: z.object({
      businessIdea: z.string().nullable().optional(),
      premisesInfrastructure: z.string().nullable().optional(),
      equipment: z.string().nullable().optional(),
      productionCapacity: z.string().nullable().optional(),
      rawMaterials: z.string().nullable().optional(),
      salesMarketing: z.string().nullable().optional(),
      finance: z.string().nullable().optional(),
      complianceExperience: z.string().nullable().optional()
    }).nullable().optional()
  }).passthrough(),
  missingFields: z.array(z.string()),
  nextQuestions: z.array(z.object({ key: z.string(), question: z.string(), type: z.enum(["text", "textarea", "number", "select", "multiselect", "boolean", "staffPlan"]).or(z.string()), unit: z.string().nullable().optional(), options: z.array(z.string()).nullable().optional() })),
  advisorMessage: z.string()
});

export type RawAiExtraction = z.infer<typeof aiExtractionZodSchema>;

export function removeNullFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  const entries = Object.entries(fields).flatMap(([key, value]) => {
    if (value === null || value === undefined || value === "") return [];
    if (key === "sectionNotes" && typeof value === "object") {
      const cleaned = removeNullFields(value as Record<string, unknown>);
      return Object.keys(cleaned).length ? [[key, cleaned]] : [];
    }
    return [[key, value]];
  });
  return Object.fromEntries(entries) as Partial<T>;
}
