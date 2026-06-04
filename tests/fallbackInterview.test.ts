import test from "node:test";
import assert from "node:assert/strict";
import { fallbackToDeterministicFlow, getNextFallbackQuestions } from "../src/lib/ai/fallbackInterview.ts";

test("fallback extraction detects a coffee shop without using toy sector defaults", () => {
  const result = fallbackToDeterministicFlow({
    message: "Хочу открыть кофейню в Ташкенте. Помещение в аренду, новое оборудование, своих денег 120 млн сум."
  });

  assert.equal(result.detectedSector, "coffee_shop");
  assert.equal(result.extractedFields.businessType, "Кофейня");
  assert.equal(result.extractedFields.region, "Ташкентская область");
  assert.equal(result.extractedFields.premisesStatus, "rent");
  assert.equal(result.extractedFields.equipmentCondition, "new");
  assert.equal(result.extractedFields.ownContributionUZS, 120000000);
  assert.equal(result.extractedFields.toyType, undefined);
  assert.ok(result.nextQuestions.length > 0);
});

test("fallback question flow asks dynamic generic questions and hides toy keys", () => {
  const response = getNextFallbackQuestions({
    businessType: "Швейный цех",
    businessIdea: "Пошив школьной формы",
    region: "Ферганская область",
    productOrService: "Школьная форма"
  });

  assert.equal(response.templateCode, "sewing_workshop");
  assert.ok(response.step >= 1);
  assert.ok(response.questions.length >= 1 && response.questions.length <= 3);
  assert.ok(response.questions.every((question) => !["toyType", "productionType"].includes(question.key)));
});
