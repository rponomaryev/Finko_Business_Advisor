# FINKO SME Business Advisor

FINKO SME Business Advisor is a local Next.js application for preliminary assessment of business ideas. The app helps an entrepreneur describe a business, complete a structured interview, calculate a financial model, review risks, see market-data tables when official data has been uploaded, and export the report to PDF or Excel.

The project is no longer limited to plastic toy production. The user enters the business type, and the app uses a dynamic/generic business template for the interview.

## Tech stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Prisma ORM
- SQLite
- Zod
- ExcelJS
- pdf-lib
- Optional OpenAI structured extraction with deterministic fallback

## Requirements

- Node.js 20+
- npm
- Internet access for the first `npx prisma generate` run, because Prisma may download engine binaries

## Environment setup

Copy the example environment file:

```bash
cp .env.example .env
```

Default local SQLite setup:

```env
DATABASE_URL="file:./dev.db"
DEMO_USER_TOKEN=demo
DEMO_ADMIN_TOKEN=admin-demo
DEMO_SESSION_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
AI_PROVIDER=openai
AI_FALLBACK_ENABLED=true
```

OpenAI is optional. If `OPENAI_API_KEY` is empty, the deterministic fallback interview is used.

## Clean local start

```bash
npm ci
npx prisma generate
npm run db:bootstrap
npm run db:seed
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Production-style local start

```bash
npm ci
npx prisma generate
npm run db:bootstrap
npm run db:seed
npm run build
npm run start
```

If port 3000 is busy:

```bash
npm run dev -- -p 3001
# or
npm run start -- -p 3001
```

## Main flow

1. Start consultation.
2. Enter business type, business idea, region, district/city and planned launch period.
3. Complete the interview sections.
4. Save each section with the explicit "Save section and continue" button.
5. Calculate the assessment after required fields are complete.
6. Open the report.
7. Download PDF or Excel.

## Market data

The app supports official/source-backed market data in two ways:

1. Server-side fetch from verified public sources during report generation:
   - National Statistics Committee of Uzbekistan (`api.stat.uz` / `stat.uz`)
   - Open Data Portal of the Republic of Uzbekistan (`data.egov.uz`)
   - World Bank Open Data for international comparison indicators

2. Admin upload for curated datasets:

```txt
/admin/market-data/upload
```

Supported formats:

- CSV
- XLSX
- JSON

Recommended columns:

```csv
sector,businessType,indicator,year,region,value,unit,currency,hsCode,activityCode,tradeType,country,productCategory,valueUsd,volume,sourceName,sourceUrl,sourceType,lastUpdated
```

Rules:

- Numbers are shown only with a source.
- AI must not invent company counts, revenue, import/export values or customs statistics.
- If official data is not available or a public API is temporarily unavailable, the report states that official numerical data was not found.
- Server-side fetches use short timeouts so the report still opens even when an external data portal is slow.

## Report export

The final report supports:

- PDF download
- Excel `.xlsx` download
- Print

Excel contains separate sheets for summary, interview data, financial model, risks, market data, import/export, recommendations and sources.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Note: `typecheck` and `build` require a generated Prisma client. Run `npx prisma generate` first.

## Production deployment security checklist

- Run production with `npm ci && npx prisma generate && npm run build`, then `npm run start`.
- Do not deploy `npm run dev`.
- Set strong `DEMO_USER_TOKEN`, `DEMO_ADMIN_TOKEN`, and `DEMO_SESSION_SECRET` values in the host environment.
- Set `NEXT_PUBLIC_APP_URL` to the exact HTTPS origin used by the public demo.
- Use managed Postgres with TLS for production instead of local SQLite.
- Keep `.env`, SQLite files, API keys, and uploaded raw data out of git.
- Confirm security headers are present and `X-Powered-By` is absent.
- Check auth, CSRF, rate limiting, export, and admin upload flows before public access.
- Do not log prompts, raw user messages, uploaded files, financial data, headers, authorization values, or env vars.

## Important UX rule

Autosave is disabled. Interview data is saved only when the user clicks the section save button or performs an explicit action such as calculation or section navigation.

## Disclaimer

The report is a preliminary advisory assessment. It is not a guarantee of profit, investment, financing, loan approval or leasing approval. Financial assumptions and market data must be verified before business decisions are made.

## Security and deployment notes

This project must be shipped without local secrets or local databases. Keep `.env`, `.env.*`, `prisma/dev.db`, `*.db`, `*.sqlite`, `.next/` and `node_modules/` out of Git and out of ZIP archives. Use `.env.example` as the only committed environment template.

Required local variables:

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="replace-with-rotated-test-key"
OPENAI_MODEL="gpt-4.1-mini"
AI_PROVIDER="openai"
DEMO_USER_TOKEN="replace-with-demo-user-code"
DEMO_ADMIN_TOKEN="replace-with-demo-admin-code"
DEMO_SESSION_SECRET="replace-with-32-plus-random-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
OFFICIAL_DATA_TIMEOUT_MS=4500
OFFICIAL_DATA_MAX_STAT_UZ_DATASETS=3
```

Generate a local session secret:

```bash
openssl rand -base64 32
```

Local setup:

```bash
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000/demo-login`, enter `DEMO_USER_TOKEN`, create a project, pass the interview, calculate the preliminary assessment, then open the report.

Pre-deploy verification:

```bash
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
npm run build
npm run start
```

Railway variables:

- `DATABASE_URL` — use managed PostgreSQL in production, not SQLite.
- `OPENAI_API_KEY` — use a rotated production key.
- `OPENAI_MODEL`
- `AI_PROVIDER=openai`
- `DEMO_USER_TOKEN`
- `DEMO_ADMIN_TOKEN`
- `DEMO_SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL=https://<your-railway-domain>`
- optional `OPENAI_MAX_OUTPUT_TOKENS=1200`
- optional `OFFICIAL_DATA_TIMEOUT_MS=4500`
- optional `OFFICIAL_DATA_MAX_STAT_UZ_DATASETS=3`

Railway build/start commands:

```bash
npm ci && npx prisma generate && npm run build
npm run start
```

Exchange-rate verification:

```bash
curl -i http://localhost:3000/api/exchange-rate
```

Expected safe response shape:

```json
{ "rate": 12500, "date": "2026-06-02", "source": "cbu.uz" }
```

The frontend must never call the Central Bank API directly. It should only use `/api/exchange-rate` for display; backend calculations use the server-side exchange-rate service and persisted snapshots.

## Windows local reset if Prisma reports drift

For local demo testing on Windows, if `npx prisma migrate dev` reports drift or an existing index, reset the local SQLite database and use `db push`:

```powershell
Remove-Item -Force .\prisma\dev.db -ErrorAction SilentlyContinue
Remove-Item -Force .\prisma\dev.db-journal -ErrorAction SilentlyContinue
Remove-Item -Force .\prisma\dev.db-wal -ErrorAction SilentlyContinue
Remove-Item -Force .\prisma\dev.db-shm -ErrorAction SilentlyContinue
npx prisma db push
npx prisma generate
npm run dev
```

Then open `http://localhost:3000/demo-login`, sign in with `DEMO_USER_TOKEN`, create a new project, complete all required sections and press `Calculate preliminary assessment` on the final interview screen.
