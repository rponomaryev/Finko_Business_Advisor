# FINAL_CHANGES.md

## FINKO SME Business Advisor - доработка после теста сценария “Мини-пекарня”

Дата сборки: 2026-06-04  
Архив: `Finko_Business_fixed.zip`

## Что исправлено

### UI/i18n и enum values

- Все пользовательские значения select/dropdown теперь проходят через общий label/localization layer.
- Для русского, английского и узбекского добавлены человекочитаемые значения:
  - `calculated` -> “Использовать расчетную выручку” / “Use calculated revenue” / узбекский перевод;
  - `stable` -> “Использовать указанную стабильную выручку” / “Use stated stable revenue” / узбекский перевод;
  - `yes`, `no`, `none`, `annuity`, `equal_principal`, `user_input`, `assumption`, `exact`, `close_proxy`, `broad_proxy`, `not_found`, `financing_gap`, `financingGap` и source type values.
- Placeholder select на русском заменен на “Выберите вариант”.
- Экспорт PDF/Excel теперь не должен показывать raw enum values как пользовательский текст.

### Кредитная модель

- Если кредит выбран, interview раскрывает обязательные вопросы:
  - сумма кредита;
  - валюта кредита;
  - срок кредита;
  - годовая ставка;
  - льготный период;
  - тип погашения;
  - цель кредита;
  - залог и документы по залогу.
- Расчет платежа использует PMT с годовой ставкой.
- Если ставка не введена, расчет использует явное допущение из sector assumptions и добавляет warning `loan_rate_assumption`.
- В financial result, FormulaSheet, PDF и Excel теперь есть источник ставки: “Данные пользователя” или “Допущение”.
- DSCR больше не выглядит как расчет на скрытом параметре.

### Лизинг

- Если лизинг выбран, interview раскрывает полный набор вопросов:
  - сумма и валюта лизинга;
  - предмет лизинга;
  - первоначальный взнос;
  - срок;
  - ставка/удорожание;
  - ежемесячный платеж, если известен;
  - поставщик;
  - коммерческое предложение;
  - доставка и монтаж.
- Если лизинг не выбран, в PDF/Excel показывается “Лизинг не применяется”, без мусорных `0`, `-1` и скрытых значений.
- Лизинговый платеж и источник ставки отображаются прозрачно.

### Залог

- Добавлены поля для структуры залога:
  - тип залога;
  - год;
  - состояние;
  - ориентировочная стоимость;
  - документы по залогу.
- В PDF и Excel добавлен отдельный раздел/лист “Залог”.
- Если пользователь указал залог, но стоимость не указана, появляется warning о необходимости оценки.
- В отчете указано, что оценка является предварительной, а банк/лизинговая компания должна подтвердить приемлемость и стоимость.

### Сотрудники и payroll

- Исправлен вывод `[object Object]` для staff/payroll в интервью и экспортных таблицах.
- Количество сотрудников агрегируется из ролей staffPlan.
- Если есть роли, отчет показывает общее количество сотрудников и breakdown по ролям.
- В sample bakery PDF теперь отображается “Количество сотрудников: 4”, а не “Не указано”.

### Market data relevance

- Добавлен слой relevance/filtering перед выводом market data.
- Каждый market indicator содержит `matchQuality`: `exact`, `close_proxy`, `broad_proxy`, `not_found`.
- Broad proxy не попадает в основной график как product-specific statistic.
- Для мини-пекарни общий `Exports of goods and services` / `Imports of goods and services` больше не показывается как рыночная статистика, если пользователь не указал импорт/экспорт.
- Для пекарни добавлены релевантные close proxy candidates: food manufacturing, retail food trade, input price pressure.
- Для import equipment trade/macro indicators разрешены только как broad/contextual или HS/trade proxy с явным объяснением.
- В UI/Excel/PDF добавлены match quality и объяснение релевантности.

### PDF export

- Исправлен рендеринг логотипа: используется PNG asset с сохранением пропорций, фиксированной высотой и auto-width.
- Warnings в PDF/Excel выводятся локализованно:
  - без `financing_gap` как пользовательского кода;
  - без `financingGap: 33300000`;
  - значения форматируются как “Разрыв финансирования - 33 300 000 сум”.
- PDF включает секции: финансовая модель, формулы, CapEx, OpEx, оборотный капитал, финансирование, залог, warnings, риски, market data, источники, рекомендации и disclaimer.
- Проверен render sample bakery PDF в PNG: логотип не растянут, не обрезан, не сдвинут.

### Excel export

- Workbook содержит лист “Залог”.
- Market data sheet содержит columns: показатель, год, регион, значение, источник, качество совпадения, релевантность.
- Warnings sheet больше не выводит internal code как основной пользовательский текст.
- FormulaSheet сохраняет формулы, подстановки, результат и источник.
- Excel export проверяется тестом на отсутствие `[object Object]`, `undefined`, `null`, `NaN`, `Infinity`, `-1 сум`, `financing_gap`, `financingGap`, raw `calculated`, raw `stable`.

### Business-agnostic interview / fallback

- Добавлены расширяемые classifier/template dictionaries и profile modifiers для:
  - мини-пекарни;
  - киоска мороженого;
  - мебельного цеха;
  - салона красоты;
  - швейной мастерской;
  - птицефермы;
  - онлайн-магазина одежды;
  - импорта оборудования;
  - кафе/общепита;
  - автомойки/сервисного бизнеса;
  - производственной мастерской;
  - фермерского хозяйства;
  - розничного магазина;
  - лизинга оборудования.
- Эти правила являются classifier/template dictionaries, а не fixed report flow.
- Financial calculator, PDF exporter, Excel exporter и report generator не используют `if bakery -> fixed report`.

## Созданные / обновленные sample artifacts

- `sample-bakery-report.xlsx`
- `sample-bakery-report.pdf`
- `sample-ice-cream-kiosk-report.xlsx`
- `sample-ice-cream-kiosk-report.pdf`
- `sample-furniture-workshop-report.xlsx`
- `sample-furniture-workshop-report.pdf`
- `sample-beauty-salon-report.xlsx`
- `sample-beauty-salon-report.pdf`
- `sample-sewing-workshop-report.xlsx`
- `sample-ecommerce-store-report.xlsx`
- `sample-import-equipment-report.xlsx`

Sample reports используются только как regression/demo/visual QA artifacts. Production logic не читает sample files как source of truth.

## Измененные ключевые файлы

- `src/lib/utils/labels.ts`
- `src/lib/i18n/ru.ts`
- `src/lib/i18n/en.ts`
- `src/lib/i18n/uz.ts`
- `src/lib/types/project.ts`
- `src/lib/validation/projectSchemas.ts`
- `src/lib/calculator/financialCalculator.ts`
- `src/lib/data/sectorTemplates/genericBusinessTemplate.ts`
- `src/lib/data/sectorTemplates/plasticToyProduction.ts`
- `src/lib/ai/fallbackInterview.ts`
- `src/lib/marketData/hsCodeMapper.ts`
- `src/lib/marketData/officialDataClient.ts`
- `src/lib/marketData/marketDataService.ts`
- `src/components/advisor/MarketDataPanel.tsx`
- `src/components/advisor/ReportPreview.tsx`
- `src/components/advisor/FinancialModelPanel.tsx`
- `src/lib/services/reportService.ts`
- `src/lib/export/reportExportTypes.ts`
- `src/lib/export/excelReportExporter.ts`
- `src/lib/export/pdfReportExporter.ts`
- `scripts/generate-sample-reports.ts`
- `tests/excelExport.test.ts`
- `tests/financialCalculator.test.ts`
- `tests/i18n.test.ts`
- `tests/marketDataValidation.test.ts`

## Business-agnostic verification

- bakery is regression scenario only
- no bakery hardcode in core logic
- no ice cream hardcode in core logic
- scenarios tested:
  - bakery
  - ice cream kiosk
  - furniture workshop
  - beauty salon
  - sewing workshop
  - poultry farm
  - ecommerce store
  - import/export
- each scenario generated different relevant interview questions
- sample reports are demo/regression only

## AI/interview verification

- AI analyzes user input and extracts business profile
- fallback uses classifier dictionaries and profile modifiers
- questions adapt by business type
- universal financial fields remain consistent

## Market data verification

- indicators are filtered by business relevance
- bakery does not receive random total imports/exports
- other businesses do not receive bakery indicators
- not_found behavior works when exact data is unavailable

## Audit commands run

```bash
rg -n "bakery|пекар|bread|выпечк|самса|булоч" src tests scripts FINAL_CHANGES.md
rg -n "ice cream|ice-cream|морожен|food kiosk" src tests scripts FINAL_CHANGES.md
rg -n "calculated|stable|financing_gap|financingGap|employeeCount|Exports of goods and services|Imports of goods and services" src tests scripts FINAL_CHANGES.md
```

Audit interpretation:

- bakery/ice-cream terms remain only in allowed places: tests, sample generation script, classifier dictionaries, template/profile modifiers and market relevance dictionaries;
- no fixed bakery report is used in financial calculator core, PDF exporter core or Excel exporter core;
- technical values are still present internally where needed as enum values, warning codes, tests and mapping labels, but exports route through formatter/localizer before user-visible output.

## Verification commands

```bash
npm ci --ignore-scripts --prefer-offline --no-audit --no-fund
npm test
npm run lint
```

Results in this sandbox:

- `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` - passed after running detached to avoid sandbox command timeout; installed 560 packages.
- `npm test` - passed, 32/32 tests.
- `npm run lint` - passed, no ESLint warnings/errors; only Next.js deprecation notice for `next lint`.
- `npm run db:generate` - failed in this sandbox because Prisma attempted to download engine checksum from `binaries.prisma.sh` and DNS/network returned `getaddrinfo EAI_AGAIN binaries.prisma.sh`.
- `npm run typecheck` - blocked without generated Prisma client because `db:generate` could not complete. A local temporary Prisma type stub was used only to validate application TypeScript changes; with that stub, `tsc --noEmit` passed. The stub was removed and is not included.
- `npm run build` - compilation succeeded, but Next build failed during page-data collection because generated Prisma client was absent: `Cannot find module '.prisma/client/default'`. This is a consequence of the same blocked `db:generate` step.

## PDF verification

```bash
python /home/oai/skills/pdfs/scripts/render_pdf.py sample-bakery-report.pdf --out_dir /mnt/data/render_bakery_sample --dpi 120
```

Result: rendered 9 pages successfully. First-page logo was visually checked after render and preserves aspect ratio.

## Remaining limitations / notes

- Prisma generation/build need to be rerun in a network-enabled environment or with Prisma engines cached locally.
- Market data exactness still depends on available official datasets; when exact data is absent, the report marks close/broad proxy or not_found honestly.
- Sample market data in generated samples is demo/regression data and is not used by production logic.

## Hotfix 2026-06-04: conditional finance questions and interview navigation

Fixed a UI/interview flow regression where conditional finance questions were not shown immediately after selecting `Кредит: Да` or `Лизинг: Да`.

Changes:
- Persisted interview plan now stores the full block question set, not only questions visible at the moment the block was first opened.
- Reopening a saved/persisted block re-evaluates `showIf` against the current answers, so loan, collateral and leasing follow-up fields appear correctly.
- Client-side block validation now uses currently visible questions, so newly revealed mandatory loan fields must be filled before saving.
- Project summary sidebar now uses live unsaved answers for section progress, so choosing credit/leasing immediately affects visible completion state.
- Added regression test coverage for finance block credit/collateral follow-up questions.


## v3 local run fixes

- Fixed local CSRF validation for localhost ports so `NEXT_PUBLIC_APP_URL=http://localhost:3000` does not block a dev server opened on `localhost:3001`.
- Fixed `scripts/bootstrap-db.ts` so it creates/adds the current Prisma columns (`consentGiven`, `businessType` on `SectorTemplate`, staff/exchange-rate tables, etc.) instead of leaving an old SQLite schema.
- The new project form now shows the backend error in development and redirects to `/demo-login` when the session cookie is stale/invalid.
