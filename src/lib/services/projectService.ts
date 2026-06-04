import { prisma } from "../db/prisma.ts";
import type { DemoSession } from "../server/auth.ts";
import type { StructuredProjectData } from "../types/project.ts";
import { generateBusinessTemplate } from "../ai/templateGenerator.ts";
import { getUsdUzsExchangeRate } from "./exchangeRateService.ts";
import { mergeStructuredData } from "../utils/structuredDataPatch.ts";
export { applyDottedKeyPatch, mergeStructuredData, safeDeepMerge } from "../utils/structuredDataPatch.ts";

const projectFieldKeys: Array<keyof StructuredProjectData> = [
  "userLanguage",
  "businessType",
  "region",
  "district",
  "businessIdea",
  "plannedStartPeriod",
  "productionType",
  "toyType",
  "premisesStatus",
  "equipmentCondition",
  "monthlyCapacity",
  "averagePrice",
  "targetCustomers",
  "rawMaterialSource",
  "certificationAwareness",
  "supplierSelected",
  "ownContribution",
  "ownContributionAmount",
  "ownContributionCurrency",
  "ownContributionUZS",
  "exchangeRateUZSPerUSD",
  "creditNeeded",
  "requestedLoanAmount",
  "requestedLoanCurrency",
  "requestedLoanUZS",
  "loanPurpose",
  "loanTermMonths",
  "requestedLeasingAmount",
  "staffPlan",
  "businessProfile",
  "exchangeRateSnapshot",
  "collateralAvailable",
  "collateralType",
  "collateralEstimatedValue",
  "experienceLevel",
  "sectionNotes"
];

function stringifyCustomers(customers: unknown): string | undefined {
  if (Array.isArray(customers)) return customers.join(",");
  if (typeof customers === "string") return customers;
  return undefined;
}

function dbPatchFromStructuredData(data: Partial<StructuredProjectData>) {
  const patch: Record<string, unknown> = {};
  for (const key of projectFieldKeys) {
    if (data[key] === undefined) continue;
    if (key === "targetCustomers") patch[key] = stringifyCustomers(data[key]);
    else patch[key] = data[key];
  }
  return patch;
}

async function normalizeStaffPlanForStorage(data: StructuredProjectData): Promise<StructuredProjectData> {
  const plan = data.staffPlan;
  if (!plan?.roles?.length) return data;

  const hasUsdSalary = plan.roles.some((role) => role.monthlySalaryCurrency === "USD");
  const snapshot = hasUsdSalary
    ? plan.exchangeRateSnapshot ?? data.exchangeRateSnapshot ?? await getUsdUzsExchangeRate()
    : plan.exchangeRateSnapshot ?? data.exchangeRateSnapshot;

  const roles = plan.roles.map((role) => {
    const amount = Number(role.monthlySalaryAmount ?? 0);
    const count = Math.max(1, Math.round(Number(role.count ?? 1)));
    const monthlySalaryCurrency = role.monthlySalaryCurrency ?? "UZS";
    const monthlySalaryUZS = monthlySalaryCurrency === "USD"
      ? Math.round(amount * (snapshot?.rate ?? 12_500))
      : Math.round(amount);

    return {
      ...role,
      count,
      monthlySalaryCurrency,
      monthlySalaryUZS
    };
  });

  return {
    ...data,
    exchangeRateSnapshot: snapshot ?? data.exchangeRateSnapshot,
    exchangeRateUZSPerUSD: snapshot?.rate ?? data.exchangeRateUZSPerUSD,
    staffPlan: {
      ...plan,
      roles,
      exchangeRateSnapshot: snapshot
    }
  };
}

function parseCustomers(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return undefined;
}

export function toStructuredProjectData(project: Record<string, unknown>): StructuredProjectData {
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
    staffPlan: project.staffPlan && typeof project.staffPlan === "object" ? (project.staffPlan as never) : structured.staffPlan,
    businessProfile: project.businessProfile && typeof project.businessProfile === "object" ? (project.businessProfile as never) : structured.businessProfile,
    exchangeRateSnapshot: project.exchangeRateSnapshot && typeof project.exchangeRateSnapshot === "object" ? (project.exchangeRateSnapshot as never) : structured.exchangeRateSnapshot,
    collateralAvailable: (project.collateralAvailable as boolean | undefined) ?? structured.collateralAvailable,
    collateralType: (project.collateralType as string | undefined) ?? structured.collateralType,
    collateralEstimatedValue: (project.collateralEstimatedValue as number | undefined) ?? structured.collateralEstimatedValue,
    experienceLevel: (project.experienceLevel as string | undefined) ?? structured.experienceLevel,
    sectionNotes:
      project.sectionNotes && typeof project.sectionNotes === "object"
        ? (project.sectionNotes as never)
        : structured.sectionNotes
  };
}

export async function ensureDemoUser(session: DemoSession) {
  return prisma.user.upsert({
    where: { id: session.demoUserId },
    update: {},
    create: {
      id: session.demoUserId,
      name: session.role === "admin" ? "FINKO demo admin" : "FINKO demo user"
    }
  });
}

export async function createProject(input: {
  session: DemoSession;
  businessType: string;
  businessIdea: string;
  region: string;
  district?: string;
  plannedStartPeriod?: string;
  userLanguage?: "ru" | "uz" | "en";
  consentGiven: true;
  consentLocale?: "ru" | "uz" | "en";
  consentVersion?: string;
  aiMode?: string;
  extractedFields?: StructuredProjectData;
  aiExtraction?: unknown;
}) {
  await ensureDemoUser(input.session);
  const template = await generateBusinessTemplate({
    businessType: input.businessType,
    businessIdea: input.businessIdea
  });
  const title = `${input.businessType.trim()} - ${input.region.trim()}`;
  const structuredData: StructuredProjectData = {
    userLanguage: input.userLanguage ?? "ru",
    businessType: input.businessType,
    businessIdea: input.businessIdea,
    region: input.region,
    district: input.district,
    plannedStartPeriod: input.plannedStartPeriod,
    sectorCode: template.code,
    templateCode: template.code,
    ...(input.extractedFields ?? {})
  };

  const normalizedStructuredData = await normalizeStaffPlanForStorage(structuredData);

  return prisma.project.create({
    data: {
      userId: input.session.demoUserId,
      title,
      sectorCode: template.code,
      userLanguage: normalizedStructuredData.userLanguage,
      businessType: normalizedStructuredData.businessType,
      businessIdea: input.businessIdea,
      region: normalizedStructuredData.region,
      district: normalizedStructuredData.district,
      plannedStartPeriod: normalizedStructuredData.plannedStartPeriod,
      aiMode: input.aiMode ?? "fallback",
      aiExtraction: input.aiExtraction as never,
      templateData: template as never,
      structuredData: normalizedStructuredData as never,
      sectionNotes: normalizedStructuredData.sectionNotes as never,
      consentGiven: input.consentGiven,
      consentTimestamp: new Date(),
      consentVersion: input.consentVersion ?? "1.0",
      consentLocale: input.consentLocale ?? input.userLanguage ?? "ru",
      ...dbPatchFromStructuredData(normalizedStructuredData)
    } as never,
    include: { answers: true }
  });
}

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: { answers: { orderBy: { createdAt: "asc" } } }
  });
}

export async function getProjectForSession(id: string, session: DemoSession) {
  return prisma.project.findFirst({
    where: { id, userId: session.demoUserId },
    include: { answers: { orderBy: { createdAt: "asc" } } }
  });
}

export async function deleteProjectForSession(id: string, session: DemoSession) {
  const project = await prisma.project.findFirst({
    where: { id, userId: session.demoUserId },
    select: { id: true }
  });
  if (!project) return null;
  await prisma.project.delete({ where: { id } });
  return { id };
}

export async function updateProject(id: string, data: Partial<StructuredProjectData> & Record<string, unknown>) {
  const current = await getProject(id);
  const currentStructured = current ? toStructuredProjectData(current as unknown as Record<string, unknown>) : {};
  const nextStructured = await normalizeStaffPlanForStorage(mergeStructuredData(currentStructured, data));

  return prisma.project.update({
    where: { id },
    data: {
      structuredData: nextStructured as never,
      sectionNotes: nextStructured.sectionNotes as never,
      ...dbPatchFromStructuredData(nextStructured)
    } as never,
    include: { answers: true }
  });
}


export async function updateProjectForSession(id: string, session: DemoSession, data: Partial<StructuredProjectData> & Record<string, unknown>) {
  const existing = await getProjectForSession(id, session);
  if (!existing) return null;
  return updateProject(id, data);
}

export async function saveAnswer(input: {
  projectId: string;
  questionKey: string;
  question: string;
  answer: string;
  answerType?: string;
}) {
  return prisma.projectAnswer.upsert({
    where: {
      projectId_questionKey: {
        projectId: input.projectId,
        questionKey: input.questionKey
      }
    },
    update: {
      question: input.question,
      answer: input.answer,
      answerType: input.answerType
    },
    create: input
  });
}

export async function updateStructuredData(id: string, data: Partial<StructuredProjectData>) {
  return updateProject(id, data);
}

export async function markInterviewCompleted(id: string) {
  return prisma.project.update({
    where: { id },
    data: { status: "interview_completed" },
    include: { answers: true }
  });
}
