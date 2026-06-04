import test from "node:test";
import assert from "node:assert/strict";
import { resolveTemplateForData } from "../src/lib/services/templateService.ts";
import { getFreeAnswerPlaceholder, translateQuestion } from "../src/lib/i18n/interviewLabels.ts";
import { formatCurrencyCompact, formatCurrencyFull } from "../src/lib/utils/formatCurrency.ts";
import { localizeUnitLabel } from "../src/lib/utils/labels.ts";

test("generic interview questions and units are localized for English", () => {
  const template = resolveTemplateForData({ businessType: "Fast food cafe" });
  const questions = Object.fromEntries(template.interviewBlocks.flatMap((block) => block.questions).map((question) => [question.key, translateQuestion("en", question)]));

  assert.equal(questions.monthlyRent.label, "Monthly rent");
  assert.equal(questions.equipmentCapex.question, "How much will the equipment and key inventory cost?");
  assert.equal(questions.rawMaterialCostPerUnit.label, "Raw materials/goods per unit");
  assert.equal(questions.preferredRevenueSource.label, "Primary revenue basis");
  assert.equal(questions.workingCapitalBufferMonths.unit, "months");
  assert.equal(localizeUnitLabel("заказов/мес.", "en"), "orders/month");

  const text = JSON.stringify(Object.values(questions).filter((question) => [
    "monthlyRent",
    "equipmentCapex",
    "premisesSetupCapex",
    "itPosWebsiteCapex",
    "utilizationRatePct",
    "rawMaterialCostPerUnit",
    "preferredRevenueSource",
    "seasonalDemand",
    "workingCapitalBufferMonths",
    "grants",
    "otherFunding"
  ].includes(String(question.key))));
  assert.doesNotMatch(text, /Аренда|Сколько|Какая|Буфер|Гранты|Сезонность|Сырье|Упаковка/);
});

test("UZS currency labels are localized outside Russian", () => {
  assert.equal(formatCurrencyFull(12_000_000, "UZS", "en"), "12,000,000 UZS");
  assert.equal(formatCurrencyCompact(544_300_000, "UZS", "en"), "544.3 m UZS");
  assert.equal(formatCurrencyFull(12_000_000, "UZS", "uz").replace(/\u00a0/g, " "), "12 000 000 UZS");
  assert.equal(formatCurrencyFull(12_000_000, "UZS", "ru").replace(/\u00a0/g, " "), "12 000 000 сум");
});


test("textarea placeholders are localized and section-specific", () => {
  const template = resolveTemplateForData({ businessType: "Store" });
  const questions = Object.fromEntries(template.interviewBlocks.flatMap((block) => block.questions).map((question) => [question.key, translateQuestion("en", question)]));

  assert.match(String(questions["sectionNotes.businessIdea"].placeholder), /who will buy/);
  assert.match(String(questions["sectionNotes.premisesInfrastructure"].placeholder), /foot traffic/);
  assert.match(String(questions["sectionNotes.rawMaterials"].placeholder), /suppliers/);
  assert.doesNotMatch(String(questions["sectionNotes.businessIdea"].placeholder), /Опишите|кто клиент|продаваться/);
  assert.notEqual(
    getFreeAnswerPlaceholder("en", "business_idea"),
    getFreeAnswerPlaceholder("en", "finance")
  );
  assert.match(String(getFreeAnswerPlaceholder("en", "equipment")), /equipment/i);
});

test("interview transition localizes next block name", async () => {
  const { generateInterviewTransitionMessage } = await import("../src/lib/ai/interviewTransitionGenerator.ts");
  const message = generateInterviewTransitionMessage({
    locale: "en",
    businessType: "Store",
    nextBlock: {
      id: "compliance",
      name: "Документы и опыт",
      description: "Проверяем разрешения, документы и компетенции команды."
    },
    structuredData: {
      region: "Tashkent City",
      district: "Mirabad",
      businessIdea: "I want to open a small store"
    }
  });

  assert.match(message, /next section: Documents and experience/);
  assert.doesNotMatch(message, /Документы|опыт|разрешения/);
});
