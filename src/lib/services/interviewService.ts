import { getMissingFields, getNextCursorBlockId, getNextFallbackQuestions, showIfMatches, valueByPath } from "../ai/fallbackInterview.ts";
import { persistedInterviewPlanBlockSchema } from "../validation/projectSchemas.ts";
import { resolveTemplateForData } from "./templateService.ts";
import type { InterviewPlanBlock, InterviewQuestion, StaffPlan, StructuredProjectData } from "../types/project.ts";

export type InterviewQuestionResponse = ReturnType<typeof getNextFallbackQuestions>;

type StableQuestionSet = {
  response: InterviewQuestionResponse;
  planPatch?: Pick<StructuredProjectData, "interviewPlan">;
};

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "" || value === "__later__";
  return Array.isArray(value) && value.length === 0;
}

function isStaffPlanMissing(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  const plan = value as Partial<StaffPlan>;
  return !Array.isArray(plan.roles) || plan.roles.length === 0 || plan.roles.some((role) => {
    const salary = Number((role as unknown as { monthlySalaryAmount?: unknown }).monthlySalaryAmount ?? 0);
    return !role.role?.trim() || Number(role.count ?? 0) <= 0 || salary <= 0;
  });
}

function isQuestionMissing(question: Pick<InterviewQuestion, "key" | "type" | "optional">, data: StructuredProjectData) {
  if (question.optional) return false;
  const value = valueByPath(data, question.key);
  if (question.type === "staffPlan") return isStaffPlanMissing(value);
  return isMissing(value);
}

function applyDottedKeyPatch(target: StructuredProjectData, key: string, value: unknown) {
  if (!key.includes(".")) {
    (target as Record<string, unknown>)[key] = value;
    return target;
  }

  const [root, child] = key.split(".");
  if (root === "sectionNotes") {
    target.sectionNotes = {
      ...(target.sectionNotes ?? {}),
      [child]: value
    };
  } else if (root === "otherDetails") {
    target.otherDetails = {
      ...(target.otherDetails ?? {}),
      [child]: String(value ?? "")
    };
  }
  return target;
}

function normalizeStoredBlock(block: unknown): InterviewPlanBlock | undefined {
  const parsed = persistedInterviewPlanBlockSchema.safeParse(block);
  return parsed.success ? parsed.data as InterviewPlanBlock : undefined;
}

function getTemplateBlockQuestions(data: StructuredProjectData, blockId: string): InterviewQuestion[] {
  const template = resolveTemplateForData(data);
  return template.interviewBlocks.find((item) => item.id === blockId)?.questions ?? [];
}

function mergeQuestionsByTemplateOrder(
  data: StructuredProjectData,
  blockId: string,
  persistedQuestions: InterviewQuestion[],
  currentQuestions: InterviewQuestion[]
): InterviewQuestion[] {
  const persistedByKey = new Map(persistedQuestions.map((question) => [question.key, question] as const));
  const currentByKey = new Map(currentQuestions.map((question) => [question.key, question] as const));
  const templateQuestions = getTemplateBlockQuestions(data, blockId);
  const templateByKey = new Map(templateQuestions.map((question) => [question.key, question] as const));
  const orderedKeys = [
    ...templateQuestions.map((question) => question.key),
    ...persistedQuestions.map((question) => question.key),
    ...currentQuestions.map((question) => question.key)
  ];

  return Array.from(new Set(orderedKeys))
    .map((key) => persistedByKey.get(key) ?? currentByKey.get(key) ?? templateByKey.get(key))
    .filter((question): question is InterviewQuestion => Boolean(question));
}

function buildRequiredQuestionsFromPlan(data: StructuredProjectData, planBlock: InterviewPlanBlock, visibleQuestions?: InterviewQuestion[]): InterviewQuestion[] {
  const template = resolveTemplateForData(data);
  const requiredKeys = new Set([...template.requiredInputs, ...planBlock.requiredQuestionKeys]);
  const questions = visibleQuestions ?? mergeQuestionsByTemplateOrder(data, planBlock.blockId, planBlock.questions, []);

  return questions
    .filter((question) => requiredKeys.has(question.key))
    .filter((question) => showIfMatches(question, data));
}

function withPersistedQuestionSet(response: InterviewQuestionResponse, data: StructuredProjectData, planBlock: InterviewPlanBlock): InterviewQuestionResponse {
  const questions = mergeQuestionsByTemplateOrder(data, planBlock.blockId, planBlock.questions, response.questions);
  const visibleQuestions = questions.filter((question) => showIfMatches(question, data));
  const requiredVisibleQuestions = buildRequiredQuestionsFromPlan(data, planBlock, visibleQuestions);
  const missingRequired = requiredVisibleQuestions
    .filter((question) => isQuestionMissing(question, data))
    .map((question) => question.key);

  return {
    ...response,
    questions,
    requiredVisibleQuestions,
    canAdvance: missingRequired.length === 0,
    isManualBlock: response.isManualBlock,
    isInterviewComplete: response.missingFields.length === 0
  };
}

function buildInterviewPlanBlock(
  response: InterviewQuestionResponse,
  data: StructuredProjectData,
  generatedBy: InterviewPlanBlock["generatedBy"] = "template"
): InterviewPlanBlock {
  const template = resolveTemplateForData(data);
  const requiredKeys = new Set(template.requiredInputs);
  const fullBlockQuestions = getTemplateBlockQuestions(data, response.blockId);
  const questionsForPlan = fullBlockQuestions.length ? fullBlockQuestions : response.questions;
  const requiredVisibleQuestions = response.requiredVisibleQuestions?.length
    ? response.requiredVisibleQuestions
    : questionsForPlan.filter((question) => requiredKeys.has(question.key) && showIfMatches(question, data));

  const requiredQuestionKeys = Array.from(new Set([
    ...requiredVisibleQuestions.map((question) => question.key),
    ...questionsForPlan.filter((question) => requiredKeys.has(question.key)).map((question) => question.key)
  ]));
  const optionalQuestionKeys = questionsForPlan
    .filter((question) => !requiredKeys.has(question.key) || question.optional)
    .map((question) => question.key);

  return {
    blockId: response.blockId,
    generatedBy,
    generatedAt: new Date().toISOString(),
    questions: questionsForPlan,
    requiredQuestionKeys,
    optionalQuestionKeys
  };
}

export function getPersistedInterviewPlanBlock(data: StructuredProjectData, blockId: string): InterviewPlanBlock | undefined {
  return normalizeStoredBlock(data.interviewPlan?.blocks?.[blockId]);
}

export function getStableQuestions(data: StructuredProjectData, blockId?: string): StableQuestionSet {
  const response = getNextFallbackQuestions(data, blockId ? { blockId, includeAnswered: true } : {});
  const persistedBlock = getPersistedInterviewPlanBlock(data, response.blockId);
  if (persistedBlock) return { response: withPersistedQuestionSet(response, data, persistedBlock) };

  const planBlock = buildInterviewPlanBlock(response, data);
  const parsed = persistedInterviewPlanBlockSchema.safeParse(planBlock);
  if (!parsed.success) return { response };

  const parsedPlanBlock = parsed.data as InterviewPlanBlock;
  const generatedAt = data.interviewPlan?.generatedAt ?? planBlock.generatedAt;
  return {
    response: withPersistedQuestionSet(response, data, parsedPlanBlock),
    planPatch: {
      interviewPlan: {
        version: "1.0",
        generatedAt,
        blocks: {
          [response.blockId]: parsedPlanBlock
        }
      }
    }
  };
}

export function getNextQuestions(data: StructuredProjectData, blockId?: string) {
  return getStableQuestions(data, blockId).response;
}

export function getCurrentBlock(data: StructuredProjectData): string {
  return getNextFallbackQuestions(data).block;
}

export function calculateCompletion(data: StructuredProjectData): number {
  return getNextFallbackQuestions(data).completionPct;
}

export function getNextInterviewCursor(data: StructuredProjectData, currentBlockId?: string): string | undefined {
  return getNextCursorBlockId(data, currentBlockId);
}

export function validateRequiredVisibleFields(data: StructuredProjectData, blockId?: string) {
  if (!blockId) return { valid: true, missingFields: [] as string[] };

  const persistedBlock = getPersistedInterviewPlanBlock(data, blockId);
  if (persistedBlock) {
    const requiredQuestions = buildRequiredQuestionsFromPlan(data, persistedBlock).filter((question) => showIfMatches(question, data));
    const missingFields = requiredQuestions
      .filter((question) => isQuestionMissing(question, data))
      .map((question) => question.key);
    return { valid: missingFields.length === 0, missingFields };
  }

  const template = resolveTemplateForData(data);
  const block = template.interviewBlocks.find((item) => item.id === blockId);
  if (!block) return { valid: true, missingFields: [] as string[] };
  const required = new Set(template.requiredInputs);
  const missingFields = block.questions
    .filter((question) => required.has(question.key) && showIfMatches(question, data))
    .filter((question) => isQuestionMissing(question, data))
    .map((question) => question.key);
  return { valid: missingFields.length === 0, missingFields };
}

export function normalizeQuestionAnswer(question: Pick<InterviewQuestion, "key" | "type">, answer: unknown): unknown {
  if (answer === "__later__") return undefined;

  if (question.type === "staffPlan") return answer;

  if (question.type === "number") {
    const value = typeof answer === "number" ? answer : Number(String(answer).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? value : undefined;
  }

  if (question.type === "boolean") {
    if (typeof answer === "boolean") return answer;
    return ["true", "yes", "да", "ha", "есть", "1"].includes(String(answer).toLowerCase());
  }

  if (question.type === "multiselect") {
    if (Array.isArray(answer)) return answer.map(String);
    return String(answer)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(answer);
}

export function mapAnswerToProjectField(
  question: Pick<InterviewQuestion, "key" | "type">,
  answer: unknown
): Partial<StructuredProjectData> {
  const value = normalizeQuestionAnswer(question, answer);
  if (value === undefined) return {};
  const patch: StructuredProjectData = {};
  applyDottedKeyPatch(patch, question.key, value);
  return patch;
}

export function hasEnoughDataForCalculation(data: StructuredProjectData): boolean {
  // The calculator has safe assumptions/fallbacks for non-critical optional data.
  // The button must become available as soon as the required visible interview fields are complete.
  return getMissingFields(data).length === 0;
}
