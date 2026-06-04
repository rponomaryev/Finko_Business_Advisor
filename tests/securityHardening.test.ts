import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("repository does not include local secrets or SQLite database", () => {
  assert.equal(existsSync(join(root, ".env")), false, ".env must not be committed or shipped");
  assert.equal(existsSync(join(root, "prisma/dev.db")), false, "local SQLite db must not be shipped");
  assert.equal(existsSync(join(root, ".env.example")), true, ".env.example must exist");
});

test("Next config has security headers and disables X-Powered-By", () => {
  const config = read("next.config.ts");
  assert.match(config, /poweredByHeader:\s*false/);
  for (const header of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
    assert.match(config, new RegExp(header));
  }
  assert.doesNotMatch(config, /isProduction \? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"/);
});

test("demo auth uses HttpOnly cookie and no localStorage token storage", () => {
  const auth = read("src/lib/server/auth.ts");
  assert.match(auth, /finko_demo_session/);
  assert.match(auth, /httpOnly:\s*true/);
  assert.match(auth, /DEMO_SESSION_SECRET/);
  const code = read("src/app/demo-login/page.tsx") + read("src/components/layout/FinkoHeader.tsx");
  assert.doesNotMatch(code, /localStorage\.setItem\([^)]*TOKEN/i);
  assert.doesNotMatch(code, /DEMO_USER_TOKEN|DEMO_ADMIN_TOKEN|DEMO_SESSION_SECRET/);
});

test("AI requests have minute limit, daily quota and max output tokens", () => {
  assert.match(read("src/lib/server/security.ts"), /checkDailyAIQuota/);
  assert.match(read("src/app/api/interview/extract/route.ts"), /checkDailyAIQuota/);
  assert.match(read("src/app/api/projects/route.ts"), /checkDailyAIQuota/);
  assert.match(read("src/lib/ai/aiService.ts"), /max_output_tokens/);
});

test("Uzbek localization has no Cyrillic and no Cyrillic locale variants", () => {
  const uz = read("src/lib/i18n/uz.ts");
  assert.doesNotMatch(uz, /[а-яёА-ЯЁ]/);
  const all = [
    "src/lib/i18n/uz.ts",
    "src/lib/i18n/ru.ts",
    "src/lib/i18n/en.ts",
    "src/components/layout/FinkoHeader.tsx"
  ].map(read).join("\n");
  assert.doesNotMatch(all, /Ўзбекча|uz-cyrl|uz_Cyrl/);
});

test("exchange-rate service is server-side and has CBU fallback chain", () => {
  const service = read("src/lib/services/exchangeRateService.ts");
  assert.match(service, /cbu\.uz\/ru\/arkhiv-kursov-valyut\/json/);
  assert.match(service, /Ccy\s*===\s*"USD"/);
  assert.match(service, /FALLBACK_RATE\s*=\s*12_500/);
  assert.match(service, /database-fallback/);
  assert.match(read("src/app/api/exchange-rate/route.ts"), /rate.*date.*source/s);
});

