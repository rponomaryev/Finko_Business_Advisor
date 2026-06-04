import test from "node:test";
import assert from "node:assert/strict";
import { calculateAll, calculateMonthlyPayment } from "../src/lib/calculator/financialCalculator.ts";
import { buildGenericBusinessTemplate } from "../src/lib/data/sectorTemplates/genericBusinessTemplate.ts";

test("annuity payment returns zero for empty principal", () => {
  assert.equal(calculateMonthlyPayment(0, 26, 36), 0);
});

test("financial calculator builds a generic business financial model", () => {
  const template = buildGenericBusinessTemplate("Кофейня");
  const result = calculateAll(
    {
      businessType: "Кофейня",
      monthlyCapacity: 2800,
      salesUnitLabel: "заказов/мес.",
      averagePrice: 28000,
      ownContributionAmount: 120000000,
      ownContributionCurrency: "UZS",
      creditNeeded: "yes",
      requestedLoanAmount: 180000000,
      requestedLeasingAmount: 0,
      equipmentCondition: "new",
      premisesStatus: "rent"
    },
    template.assumptions
  );

  assert.equal(result.revenue.monthlyCapacity, 2800);
  assert.equal(result.revenue.unitLabel, "заказов/мес.");
  assert.equal(result.revenue.averagePrice, 28000);
  assert.equal(result.revenue.monthlyRevenue, 50960000);
  assert.equal(result.capex.moldCost, 0);
  assert.equal(result.workingCapital.requiredWorkingCapital, 114000000);
  assert.equal(result.financing.loanRequired, 180000000);
  assert.equal(result.financing.leasingRequired, 0);
  assert.ok(result.financing.dscr !== null);
  assert.equal(result.financing.loanAnnualRateSource, "assumption");
  assert.equal(result.warnings.some((warning) => warning.code === "loan_rate_assumption"), true);
});

test("loan and leasing terms are transparent when user provides rates", () => {
  const template = buildGenericBusinessTemplate("Кофейня");
  const result = calculateAll(
    {
      businessType: "Кофейня",
      monthlyCapacity: 3000,
      averagePrice: 30000,
      ownContributionAmount: 200000000,
      ownContributionCurrency: "UZS",
      creditNeeded: "yes",
      requestedLoanAmount: 100000000,
      requestedLoanCurrency: "UZS",
      loanTermMonths: 36,
      loanAnnualRatePct: 24,
      loanRepaymentType: "annuity",
      needsLeasing: true,
      requestedLeasingAmount: 50000000,
      requestedLeasingCurrency: "UZS",
      leasingTermMonths: 24,
      leasingAnnualRatePct: 22,
      equipmentCondition: "new",
      premisesStatus: "rent"
    },
    template.assumptions
  );

  assert.equal(result.financing.loanAnnualRatePct, 24);
  assert.equal(result.financing.loanAnnualRateSource, "user_input");
  assert.equal(result.financing.leasingAnnualRateSource, "user_input");
  assert.equal(result.warnings.some((warning) => warning.code === "loan_rate_assumption"), false);
});
