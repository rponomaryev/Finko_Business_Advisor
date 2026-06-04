import { NextResponse } from "next/server";
import { calculateAll } from "@/lib/calculator/financialCalculator";
import { prisma } from "@/lib/db/prisma";
import { calculateBankReadinessScore, calculateFeasibilityScore } from "@/lib/scoring/scoringService";
import { generateRiskMatrix } from "@/lib/scoring/riskEngine";
import { buildReportData } from "@/lib/services/reportService";
import { getMarketData } from "@/lib/marketData/marketDataService";
import { getProjectForSession, toStructuredProjectData } from "@/lib/services/projectService";
import { hasEnoughDataForCalculation } from "@/lib/services/interviewService";
import { resolveTemplateFromProject } from "@/lib/services/templateService";
import { getUsdUzsExchangeRate } from "@/lib/services/exchangeRateService";
import { isAuthResponse, requireUserSession } from "@/lib/server/auth";
import { assertCsrf, checkDailyAIQuota, enforceRateLimit } from "@/lib/server/security";
import { safeProjectDetailDto } from "@/lib/server/dto";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = requireUserSession(request);
  if (isAuthResponse(session)) return session;

  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const { id } = await context.params;
  const limited = enforceRateLimit(request, "ai", session, id);
  if (limited) return limited;

  const dailyQuota = checkDailyAIQuota({ request, session, projectId: id });
  if (dailyQuota) return dailyQuota;

  const project = await getProjectForSession(id, session);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const profile = toStructuredProjectData(project as unknown as Record<string, unknown>);
  const storedRateSnapshot = profile.staffPlan?.exchangeRateSnapshot ?? profile.exchangeRateSnapshot;
  const rateSnapshot = storedRateSnapshot ?? await getUsdUzsExchangeRate();
  const profileWithRate = {
    ...profile,
    exchangeRateUZSPerUSD: rateSnapshot.rate,
    exchangeRateSnapshot: rateSnapshot,
    staffPlan: profile.staffPlan
      ? { ...profile.staffPlan, exchangeRateSnapshot: profile.staffPlan.exchangeRateSnapshot ?? rateSnapshot }
      : profile.staffPlan
  };
  const dynamicTemplate = resolveTemplateFromProject({
    ...(project as unknown as Record<string, unknown>),
    structuredData: profileWithRate
  });
  const template = await prisma.sectorTemplate.findUnique({
    where: { code: dynamicTemplate.code }
  }).catch(() => null);
  const assumptions = (template?.assumptions as typeof dynamicTemplate.assumptions | undefined) ??
    dynamicTemplate.assumptions;

  if (!hasEnoughDataForCalculation(profileWithRate)) {
    return NextResponse.json(
      { error: "Required interview fields are incomplete" },
      { status: 400 }
    );
  }

  const financial = calculateAll(profileWithRate, assumptions, rateSnapshot);
  const risks = generateRiskMatrix(profileWithRate);
  const feasibilityScore = calculateFeasibilityScore(profileWithRate, financial, risks);
  const bankReadinessScore = calculateBankReadinessScore(profileWithRate, financial, risks);
  const marketData = await getMarketData({
    businessType: profileWithRate.businessType ?? project.title,
    region: profileWithRate.region,
    locale: profileWithRate.userLanguage ?? "ru"
  });
  const reportData = buildReportData({
    project: {
      ...profileWithRate,
      title: project.title,
      sectorCode: dynamicTemplate.code
    },
    financial,
    risks,
    feasibilityScore,
    bankReadinessScore,
    marketData
  });

  const updated = await prisma.project.update({
    where: { id },
    data: {
      status: "calculated",
      structuredData: profileWithRate as never,
      exchangeRateUZSPerUSD: rateSnapshot.rate,
      exchangeRateSnapshot: rateSnapshot as never,
      staffPlan: profileWithRate.staffPlan as never,
      financialResult: financial as never,
      riskResult: risks as never,
      feasibilityScore,
      bankReadinessScore,
      reportData: reportData as never
    } as never,
    include: { answers: { orderBy: { createdAt: "asc" } } }
  });

  return NextResponse.json({
    project: safeProjectDetailDto(updated as never),
    financial,
    risks,
    feasibilityScore,
    bankReadinessScore,
    reportData
  });
}
