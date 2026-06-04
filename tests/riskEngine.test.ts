import test from "node:test";
import assert from "node:assert/strict";
import { generateRiskMatrix } from "../src/lib/scoring/riskEngine.ts";

test("risk engine returns at least eight contextual risks", () => {
  const risks = generateRiskMatrix({
    certificationAwareness: "not_aware",
    rawMaterialSource: "import",
    creditNeeded: "yes",
    collateralAvailable: false,
    equipmentCondition: "used",
    experienceLevel: "low",
    targetCustomers: ["bazaars"]
  });

  assert.ok(risks.length >= 8);
  assert.equal(risks.find((risk) => risk.code === "certification_risk")?.level, "high");
  assert.equal(risks.find((risk) => risk.code === "fx_risk")?.level, "high");
  assert.equal(risks.find((risk) => risk.code === "collateral_risk")?.level, "high");
  assert.ok(risks.every((risk) => risk.probability >= 1 && risk.impact >= 1 && risk.score === risk.probability * risk.impact));
});
