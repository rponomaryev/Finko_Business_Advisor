import { NextResponse } from "next/server";
import { extractStructuredFields } from "@/lib/ai/aiService";
import { generateInterviewTransitionMessage } from "@/lib/ai/interviewTransitionGenerator";
import { prisma } from "@/lib/db/prisma";
import {
  getNextInterviewCursor,
  getStableQuestions,
  mapAnswerToProjectField,
  validateRequiredVisibleFields
} from "@/lib/services/interviewService";
import {
  getProjectForSession,
  mergeStructuredData,
  saveAnswer,
  toStructuredProjectData,
  updateProject
} from "@/lib/services/projectService";
import { findTemplateQuestion, resolveTemplateFromProject } from "@/lib/services/templateService";
import { isAuthResponse, requireUserSession } from "@/lib/server/auth";
import { abuseLog, assertCsrf, checkDailyAIQuota, containsPromptInjection, enforceRateLimit } from "@/lib/server/security";
import { safeProjectDetailDto } from "@/lib/server/dto";
import { answerSchema } from "@/lib/validation/projectSchemas";
import type { StructuredProjectData } from "@/lib/types/project";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeExtractionPatch(aiFields: StructuredProjectData, directPatch: Partial<StructuredProjectData>): StructuredProjectData {
  const next: StructuredProjectData = { ...aiFields };
  for (const [key, value] of Object.entries(directPatch)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject((next as Record<string, unknown>)[key])) {
      (next as Record<string, unknown>)[key] = {
        ...((next as Record<string, unknown>)[key] as Record<string, unknown>),
        ...value
      };
    } else {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  return next;
}

function serializeSavedAnswer(answer: unknown) {
  if (Array.isArray(answer)) return answer.join(", ");
  if (answer && typeof answer === "object") return JSON.stringify(answer);
  return String(answer);
}

export async function POST(request: Request) {
  const session = requireUserSession(request);
  if (isAuthResponse(session)) return session;

  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const body = await request.json().catch(() => null);
  const parsed = answerSchema.extend({ projectId: answerSchema.shape.projectId.unwrap() }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid interview answer" }, { status: 400 });
  }

  const answerData = parsed.data;

  const limited = enforceRateLimit(request, "ai", session, answerData.projectId);
  if (limited) return limited;

  const dailyQuota = checkDailyAIQuota({ request, session, projectId: answerData.projectId });
  if (dailyQuota) return dailyQuota;

  if (containsPromptInjection(answerData.message)) {
    abuseLog({ route: "/api/interview/extract", event: "prompt_injection_pattern", actor: session.demoUserId });
  }

  const project = await getProjectForSession(answerData.projectId, session);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const currentProfile = toStructuredProjectData(project as unknown as Record<string, unknown>);
  const template = resolveTemplateFromProject(project as unknown as Record<string, unknown>);
  const directPatch: Partial<StructuredProjectData> = {};
  const answersToSave: Array<{
    questionKey: string;
    question: string;
    answer: string;
    answerType?: string;
  }> = [];

  for (const answer of answerData.answers ?? []) {
    const question = findTemplateQuestion(template, answer.key);
    if (!question) {
      abuseLog({ route: "/api/interview/extract", event: "unknown_answer_key", actor: session.demoUserId });
      return NextResponse.json({ error: "Invalid answer key" }, { status: 400 });
    }
    Object.assign(directPatch, mapAnswerToProjectField(question, answer.answer));
    answersToSave.push({
      questionKey: answer.key,
      question: answer.question,
      answer: serializeSavedAnswer(answer.answer),
      answerType: answer.answerType
    });
  }

  const freeText = answerData.message.trim();

  async function saveCollectedAnswers() {
    for (const answer of answersToSave) {
      await saveAnswer({
        projectId: answerData.projectId,
        ...answer
      });
    }

    if (!freeText) return;
    await saveAnswer({
      projectId: answerData.projectId,
      questionKey: `free_text_${Date.now()}`,
      question: "Свободный ответ предпринимателя",
      answer: freeText,
      answerType: "textarea"
    });
  }

  const knownData = mergeStructuredData(currentProfile, directPatch as Record<string, unknown>);

  if (answerData.advance !== false) {
    const validation = validateRequiredVisibleFields(knownData, answerData.blockId);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Required fields are missing",
          missingRequiredFields: validation.missingFields,
          missingFields: validation.missingFields
        },
        { status: 400 }
      );
    }
  }

  if (answerData.autoSave) {
    await saveCollectedAnswers();
    await updateProject(answerData.projectId, directPatch as Record<string, unknown>);
    const updated = await getProjectForSession(answerData.projectId, session);
    return NextResponse.json({
      mode: project.aiMode ?? "fallback",
      extractedFields: directPatch,
      missingFields: [],
      nextQuestions: [],
      advisorMessage: null,
      project: updated ? safeProjectDetailDto(updated as never) : null
    });
  }

  await saveCollectedAnswers();

  const ai = await extractStructuredFields({
    message: answerData.message,
    knownData
  });
  const mergedPatch = mergeExtractionPatch(ai.extractedFields, directPatch);
  const projectedProfile = mergeStructuredData(currentProfile, mergedPatch as Record<string, unknown>);
  let nextCursor: string | undefined;

  if (answerData.advance !== false) {
    nextCursor = getNextInterviewCursor(projectedProfile, answerData.blockId);
    if (nextCursor) mergedPatch.interviewCursorBlockId = nextCursor;
    if (answerData.blockId) {
      mergedPatch.completedBlockIds = Array.from(new Set([...(projectedProfile.completedBlockIds ?? []), answerData.blockId]));
    }
  }

  let nextBlockState = null as ReturnType<typeof getStableQuestions>["response"] | null;
  if (answerData.advance !== false && nextCursor) {
    const profileForNextBlock = mergeStructuredData(projectedProfile, mergedPatch as Record<string, unknown>);
    const stableNextBlock = getStableQuestions(profileForNextBlock, nextCursor);
    nextBlockState = stableNextBlock.response;
    if (stableNextBlock.planPatch) {
      const mergedWithPlan = mergeStructuredData(mergedPatch, stableNextBlock.planPatch as Record<string, unknown>);
      Object.assign(mergedPatch, mergedWithPlan);
    }
  }

  await updateProject(answerData.projectId, mergedPatch);

  const updated = await prisma.project.update({
    where: { id: answerData.projectId },
    data: {
      aiMode: ai.mode,
      aiExtraction: ai as never
    },
    include: { answers: { orderBy: { createdAt: "asc" } } }
  });

  const updatedProfile = toStructuredProjectData(updated as unknown as Record<string, unknown>);

  return NextResponse.json({
    mode: ai.mode,
    extractedFields: mergedPatch,
    missingFields: ai.missingFields,
    nextQuestions: ai.nextQuestions,
    currentBlockId: answerData.blockId,
    nextBlockId: nextCursor ?? null,
    nextBlockState,
    isInterviewComplete: answerData.advance !== false && !nextCursor,
    advisorMessage: generateInterviewTransitionMessage({
      locale: updatedProfile.userLanguage,
      businessType: updatedProfile.businessType,
      previousBlock: answerData.blockId,
      nextBlock: nextBlockState ? {
        id: nextBlockState.blockId,
        name: nextBlockState.block,
        description: nextBlockState.blockDescription
      } : undefined,
      structuredData: updatedProfile
    }),
    project: safeProjectDetailDto(updated as never)
  });
}
