import test from "node:test";
import assert from "node:assert/strict";
import { getTranslations, normalizeLocale } from "../src/lib/i18n/index.ts";
import { getRegions } from "../src/lib/data/regions.ts";
import { labelValue } from "../src/lib/utils/labels.ts";

test("i18n supports ru, uz latin and en", () => {
  assert.equal(normalizeLocale("uz"), "uz");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("xx"), "ru");
  assert.equal(getTranslations("ru").newProject.businessType, "Тип бизнеса / предприятия");
  assert.equal(getTranslations("uz").report.downloadPdf, "PDF yuklab olish");
  assert.equal(getTranslations("en").report.downloadExcel, "Download Excel");
  assert.equal(/[А-Яа-яЁё]/.test(getTranslations("uz").newProject.title), false);
});

test("regions are complete and localized", () => {
  assert.equal(getRegions("ru").length, 14);
  assert.equal(getRegions("uz").some((region) => region.label.includes("Toshkent shahri")), true);
  assert.equal(getRegions("en").some((region) => region.label.includes("Tashkent City")), true);
});


test("raw enum values are localized for UI and exports", () => {
  assert.equal(labelValue("calculated", "ru"), "Использовать расчетную выручку");
  assert.equal(labelValue("stable", "ru"), "Использовать указанную стабильную выручку");
  assert.equal(labelValue("financing_gap", "ru"), "Разрыв финансирования");
  assert.equal(labelValue("yes", "en"), "Yes");
  assert.equal(labelValue("no", "uz"), "Yo'q");
});
