import ExcelJS from "exceljs";
import path from "node:path";
import { accessSync } from "node:fs";
import { prepareReportExport, type PreparedReportExport } from "./reportExportTypes.ts";
import { reportMetric } from "../report/reportFormatters.ts";

const BRAND = "FFE11446";
const LIGHT = "FFF4F5F7";
const BORDER = "FFE5E7EB";

function sheetNames(locale: PreparedReportExport["locale"]) {
  if (locale === "en") {
    return {
      overview: "Overview",
      interview: "Interview",
      financial: "Financial model",
      formulas: "Formulas",
      capex: "CapEx",
      opex: "OpEx",
      financing: "Financing",
      risks: "Risks",
      readiness: "Readiness",
      market: "Market data",
      importExport: "Import Export",
      sources: "Sources",
      charts: "Charts",
      recommendations: "Recommendations"
    };
  }
  if (locale === "uz") {
    return {
      overview: "Sharh",
      interview: "Intervyu",
      financial: "Moliyaviy model",
      formulas: "Formulalar",
      capex: "CapEx",
      opex: "OpEx",
      financing: "Moliyalashtirish",
      risks: "Risklar",
      readiness: "Tayyorlik",
      market: "Bozor ma'lumotlari",
      importExport: "Import eksport",
      sources: "Manbalar",
      charts: "Grafiklar",
      recommendations: "Tavsiyalar"
    };
  }
  return {
    overview: "Обзор",
    interview: "Интервью",
    financial: "Финансовая модель",
    formulas: "Формулы",
    capex: "CapEx",
    opex: "OpEx",
    financing: "Финансирование",
    risks: "Риски",
    readiness: "Готовность",
    market: "Рыночные данные",
    importExport: "Импорт и экспорт",
    sources: "Источники",
    charts: "Графики",
    recommendations: "Рекомендации"
  };
}

function headers(locale: PreparedReportExport["locale"]) {
  if (locale === "en") {
    return {
      generatedAt: "Generated at",
      keyFindings: "Key findings",
      field: "Field",
      value: "Value",
      interview: ["Section", "Field", "Answer", "Unit", "Required"],
      financial: ["Indicator", "Value", "Unit", "Comment"],
      formula: ["Indicator", "Formula", "Substitution", "Result", "Source", "Input A", "Input B", "Input C", "Excel formula"],
      breakdown: ["Item", "Amount", "Source", "Comment"],
      risks: ["Risk", "Level", "Reason", "Recommendation"],
      market: ["Indicator", "Year", "Region", "Value", "Unit", "Currency", "Source", "Last Updated", "Match quality", "Relevance"],
      importExport: ["Type", "HS Code", "Product Category", "Year", "Country", "Value USD", "Volume", "Unit", "Source"],
      recommendations: ["Area", "Recommendation", "Priority"],
      sources: ["Source Name", "Source Type", "URL", "Year", "Last Updated", "Notes"],
      warnings: ["Warning type", "Warning", "Values", "Severity"]
    };
  }
  if (locale === "uz") {
    return {
      generatedAt: "Yaratilgan vaqt",
      keyFindings: "Asosiy xulosalar",
      field: "Maydon",
      value: "Qiymat",
      interview: ["Bo'lim", "Maydon", "Javob", "Birlik", "Majburiy"],
      financial: ["Ko'rsatkich", "Qiymat", "Birlik", "Izoh"],
      formula: ["Ko'rsatkich", "Formula", "Qo'yilgan qiymatlar", "Natija", "Manba", "A", "B", "C", "Excel formula"],
      breakdown: ["Modda", "Summa", "Manba", "Izoh"],
      risks: ["Risk", "Daraja", "Sabab", "Tavsiya"],
      market: ["Ko'rsatkich", "Yil", "Hudud", "Qiymat", "Birlik", "Valyuta", "Manba", "Yangilangan", "Moslik sifati", "Dolzarblik"],
      importExport: ["Tur", "HS Code", "Kategoriya", "Yil", "Davlat", "USD qiymat", "Hajm", "Birlik", "Manba"],
      recommendations: ["Yo'nalish", "Tavsiya", "Ustuvorlik"],
      sources: ["Manba", "Turi", "URL", "Yil", "Yangilangan", "Izoh"],
      warnings: ["Ogohlantirish turi", "Ogohlantirish", "Qiymatlar", "Muhimlik"]
    };
  }
  return {
    generatedAt: "Сформировано",
    keyFindings: "Ключевые выводы",
    field: "Показатель",
    value: "Значение",
    interview: ["Раздел", "Поле", "Ответ", "Ед.", "Обяз."],
    financial: ["Показатель", "Значение", "Ед.", "Комментарий"],
    formula: ["Показатель", "Формула", "Подстановка", "Результат", "Источник", "A", "B", "C", "Excel-формула"],
    breakdown: ["Статья", "Сумма", "Источник", "Комментарий"],
    risks: ["Риск", "Уровень", "Причина", "Рекомендация"],
    market: ["Показатель", "Год", "Регион", "Значение", "Ед.", "Валюта", "Источник", "Обновлено", "Качество совпадения", "Релевантность"],
    importExport: ["Тип", "HS Code", "Категория продукта", "Год", "Страна", "Стоимость USD", "Объем", "Ед.", "Источник"],
    recommendations: ["Раздел", "Рекомендация", "Приоритет"],
    sources: ["Источник", "Тип", "URL", "Год", "Обновлено", "Примечание"],
    warnings: ["Тип предупреждения", "Предупреждение", "Значения", "Уровень"]
  };
}

function safeCell(value: unknown, locale: PreparedReportExport["locale"] = "ru"): string | number | boolean | ExcelJS.CellRichTextValue | ExcelJS.CellFormulaValue | null {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (value === -1) return locale === "en" ? "Not specified" : locale === "uz" ? "Ko'rsatilmagan" : "Не указано";
    return value;
  }
  if (typeof value === "boolean") return value ? (locale === "en" ? "Yes" : locale === "uz" ? "Ha" : "Да") : (locale === "en" ? "No" : locale === "uz" ? "Yo'q" : "Нет");
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") {
    if (["undefined", "null", "NaN", "Infinity", "[object Object]"].includes(value.trim()) || /^-1\s+(сум|UZS)$/i.test(value.trim())) return "";
    if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
    return value;
  }
  return String(value);
}

function addSafeRow(sheet: ExcelJS.Worksheet, values: unknown[], locale: PreparedReportExport["locale"] = "ru") {
  return sheet.addRow(values.map((value) => safeCell(value, locale)));
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell((cell) => {
    cell.border = { top: { style: "thin", color: { argb: BORDER } }, left: { style: "thin", color: { argb: BORDER } }, bottom: { style: "thin", color: { argb: BORDER } }, right: { style: "thin", color: { argb: BORDER } } };
  });
}

function finalizeWorksheet(worksheet: ExcelJS.Worksheet, widths: number[]) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.columns = widths.map((width) => ({ width }));
  worksheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => {
      cell.border = { top: { style: "thin", color: { argb: BORDER } }, left: { style: "thin", color: { argb: BORDER } }, bottom: { style: "thin", color: { argb: BORDER } }, right: { style: "thin", color: { argb: BORDER } } };
    });
    if (rowNumber === 1) row.height = 22;
  });
}

function maybeAddLogo(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) {
  try {
    const logoPath = path.join(process.cwd(), "public", "finko-logo.png");
    accessSync(logoPath);
    const logoId = workbook.addImage({ filename: logoPath, extension: "png" });
    sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 70, height: 28 } });
  } catch {
    // Logo is optional for local tests, but used when available in the project.
  }
}

function addOverviewSheet(workbook: ExcelJS.Workbook, data: PreparedReportExport) {
  const h = headers(data.locale);
  const sheet = workbook.addWorksheet(sheetNames(data.locale).overview);
  maybeAddLogo(workbook, sheet);
  addSafeRow(sheet, [data.title, ""], data.locale);
  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").font = { bold: true, size: 16 };
  addSafeRow(sheet, [h.generatedAt, data.generatedAt], data.locale);
  sheet.addRow([]);
  const header = addSafeRow(sheet, [h.field, h.value], data.locale);
  applyHeaderStyle(header);
  for (const row of data.summary) addSafeRow(sheet, [row.label, row.value], data.locale);
  sheet.addRow([]);
  const keyFindingsHeader = addSafeRow(sheet, [h.keyFindings, ""], data.locale);
  keyFindingsHeader.font = { bold: true };
  for (const item of data.executiveSummary) addSafeRow(sheet, [item, ""], data.locale);
  sheet.addRow([]);
  addSafeRow(sheet, [data.locale === "ru" ? "Ограничение ответственности" : data.locale === "uz" ? "Ogohlantirish" : "Disclaimer", data.disclaimer], data.locale);
  finalizeWorksheet(sheet, [34, 100]);
}

function addTableSheet(workbook: ExcelJS.Workbook, name: string, headerLabels: string[], rows: unknown[][], widths: number[], locale: PreparedReportExport["locale"] = "ru") {
  const sheet = workbook.addWorksheet(name);
  const header = addSafeRow(sheet, headerLabels, locale);
  applyHeaderStyle(header);
  for (const row of rows) addSafeRow(sheet, row, locale);
  finalizeWorksheet(sheet, widths);
  return sheet;
}

function addFinancialSheet(workbook: ExcelJS.Workbook, data: PreparedReportExport) {
  const h = headers(data.locale);
  const sheet = addTableSheet(
    workbook,
    sheetNames(data.locale).financial,
    h.financial,
    data.financialRows.map((row) => [row.indicator, row.value, row.unit, row.comment]),
    [34, 24, 14, 54],
    data.locale
  );
  sheet.getColumn(2).numFmt = "#,##0";
}

function addFormulaSheet(workbook: ExcelJS.Workbook, data: PreparedReportExport) {
  const h = headers(data.locale);
  const sheet = workbook.addWorksheet(sheetNames(data.locale).formulas);
  const header = addSafeRow(sheet, h.formula, data.locale);
  applyHeaderStyle(header);
  for (const row of data.formulaRows) {
    const excelRow = addSafeRow(sheet, [row.indicator, row.formula, row.substitution, row.result, row.source, "", "", "", ""], data.locale);
    const n = excelRow.number;
    if (/выруч|revenue/i.test(row.indicator)) {
      sheet.getCell(`F${n}`).value = data.report.financialModel.revenue.monthlyCapacity;
      sheet.getCell(`G${n}`).value = data.report.financialModel.revenue.averagePrice;
      sheet.getCell(`H${n}`).value = data.report.financialModel.revenue.expectedUtilizationPct / 100;
      sheet.getCell(`I${n}`).value = { formula: `F${n}*G${n}*H${n}`, result: data.report.financialModel.revenue.calculatedMonthlyRevenue };
    } else if (/cogs/i.test(row.indicator)) {
      sheet.getCell(`F${n}`).value = data.report.financialModel.revenue.effectiveUnits;
      sheet.getCell(`G${n}`).value = data.report.financialModel.cogs.unitCOGS;
      sheet.getCell(`H${n}`).value = 1 + data.report.financialModel.cogs.wasteAllowancePct / 100;
      sheet.getCell(`I${n}`).value = { formula: `F${n}*G${n}*H${n}`, result: data.report.financialModel.cogs.monthlyCOGS };
    } else if (/gap|разрыв/i.test(row.indicator)) {
      sheet.getCell(`F${n}`).value = data.report.financialModel.financing.totalInvestmentNeed;
      sheet.getCell(`G${n}`).value = data.report.financialModel.financing.availableFunding;
      sheet.getCell(`I${n}`).value = { formula: `MAX(F${n}-G${n},0)`, result: data.report.financialModel.financing.financingGap };
    } else if (/working|оборот/i.test(row.indicator)) {
      sheet.getCell(`F${n}`).value = data.report.financialModel.workingCapital.monthlyFixedCosts;
      sheet.getCell(`G${n}`).value = data.report.financialModel.workingCapital.bufferMonths;
      sheet.getCell(`H${n}`).value = data.report.financialModel.workingCapital.initialInventory + data.report.financialModel.workingCapital.accountsReceivableBuffer - data.report.financialModel.workingCapital.accountsPayableBuffer + data.report.financialModel.workingCapital.seasonalStockBuffer;
      sheet.getCell(`I${n}`).value = { formula: `F${n}*G${n}+H${n}`, result: data.report.financialModel.workingCapital.requiredWorkingCapital };
    }
  }
  finalizeWorksheet(sheet, [28, 34, 52, 22, 22, 16, 16, 16, 22]);
  sheet.getColumn(9).numFmt = "#,##0";
}

function addReadinessSheet(workbook: ExcelJS.Workbook, data: PreparedReportExport) {
  const names = sheetNames(data.locale);
  const rows = [
    [data.locale === "ru" ? "Оценка реализуемости" : data.locale === "uz" ? "Amalga oshirish bahosi" : "Feasibility score", `${data.report.feasibilityScore}/100`],
    [data.locale === "ru" ? "Готовность к финансированию" : data.locale === "uz" ? "Moliyalashtirishga tayyorlik" : "Financing readiness", `${data.report.bankReadinessScore}/100`],
    [data.locale === "ru" ? "Рекомендация" : data.locale === "uz" ? "Tavsiya" : "Recommendation", data.financingRecommendation]
  ];
  addTableSheet(workbook, names.readiness, [headers(data.locale).field, headers(data.locale).value], rows, [34, 90], data.locale);
}

function addChartsSheet(workbook: ExcelJS.Workbook, data: PreparedReportExport) {
  const names = sheetNames(data.locale);
  const sheet = workbook.addWorksheet(names.charts);
  maybeAddLogo(workbook, sheet);
  addSafeRow(sheet, [data.locale === "ru" ? "Chart-ready data / встроенные диаграммы" : data.locale === "uz" ? "Grafiklar uchun ma'lumot" : "Chart-ready data", ""], data.locale);
  sheet.addRow([]);
  const header = addSafeRow(sheet, [data.locale === "ru" ? "Серия" : data.locale === "uz" ? "Seriya" : "Series", data.locale === "ru" ? "Статья" : data.locale === "uz" ? "Modda" : "Item", data.locale === "ru" ? "Сумма" : data.locale === "uz" ? "Summa" : "Amount"], data.locale);
  applyHeaderStyle(header);
  const rows: Array<[string, string, string]> = [
    ...data.capexRows.filter((r) => !/итого|total|jami/i.test(r.item)).map((r) => ["CapEx", r.item, r.amount] as [string, string, string]),
    ...data.opexRows.filter((r) => !/итого|total|jami/i.test(r.item)).map((r) => ["OpEx", r.item, r.amount] as [string, string, string]),
    ["Revenue/COGS/EBITDA", reportMetric("monthlyRevenue", data.locale), data.report.financialModel.revenue.monthlyRevenue.toString()],
    ["Revenue/COGS/EBITDA", "COGS", data.report.financialModel.cogs.monthlyCOGS.toString()],
    ["Revenue/COGS/EBITDA", "EBITDA", data.report.financialModel.profitability.monthlyEBITDA.toString()],
    [data.locale === "ru" ? "Финансирование" : data.locale === "uz" ? "Moliyalashtirish" : "Financing", reportMetric("ownContribution", data.locale), data.report.financialModel.financing.ownContributionUZS.toString()],
    [data.locale === "ru" ? "Финансирование" : data.locale === "uz" ? "Moliyalashtirish" : "Financing", reportMetric("loanAmount", data.locale), data.report.financialModel.financing.loanRequired.toString()],
    [data.locale === "ru" ? "Финансирование" : data.locale === "uz" ? "Moliyalashtirish" : "Financing", reportMetric("leasingAmount", data.locale), data.report.financialModel.financing.leasingRequired.toString()],
    [data.locale === "ru" ? "Финансирование" : data.locale === "uz" ? "Moliyalashtirish" : "Financing", reportMetric("financingGap", data.locale), data.report.financialModel.financing.financingGap.toString()]
  ];
  for (const row of rows) addSafeRow(sheet, row, data.locale);
  sheet.addRow([]);
  addSafeRow(sheet, [data.locale === "ru" ? "Примечание" : data.locale === "uz" ? "Izoh" : "Note", data.locale === "ru" ? "ExcelJS не поддерживает native charts стабильно; лист содержит таблицы для построения графиков и логотип FINKO." : data.locale === "uz" ? "Workbook ko'rish dasturlari uchun grafikga tayyor jadvallar berilgan." : "Chart-ready tables are provided for workbook viewers."], data.locale);
  finalizeWorksheet(sheet, [26, 36, 24]);
}

export async function buildExcelReportBuffer(project: Record<string, unknown>, localeOverride?: unknown) {
  const data = prepareReportExport(project, localeOverride);
  return buildExcelReportFromData(data);
}

export async function buildExcelReportFromData(data: PreparedReportExport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FINKO SME Business Advisor";
  workbook.company = "FINKO";
  workbook.created = new Date();
  workbook.modified = new Date();

  const names = sheetNames(data.locale);
  const h = headers(data.locale);
  addOverviewSheet(workbook, data);
  addTableSheet(workbook, names.interview, h.interview, data.interviewRows.map((r) => [r.section, r.field, r.answer, r.unit, r.required]), [24, 30, 72, 12, 12], data.locale);
  addFinancialSheet(workbook, data);
  addFormulaSheet(workbook, data);
  addTableSheet(workbook, names.capex, h.breakdown, data.capexRows.map((r) => [r.item, r.amount, r.source, r.comment]), [34, 22, 22, 44], data.locale);
  addTableSheet(workbook, names.opex, h.breakdown, data.opexRows.map((r) => [r.item, r.amount, r.source, r.comment]), [34, 22, 22, 44], data.locale);
  addTableSheet(workbook, names.financing, h.breakdown, data.financingRows.map((r) => [r.item, r.amount, r.source, r.comment]), [34, 28, 22, 52], data.locale);
  addTableSheet(workbook, data.locale === "ru" ? "Залог" : data.locale === "uz" ? "Garov" : "Collateral", h.breakdown, data.collateralRows.map((r) => [r.item, r.amount, r.source, r.comment]), [34, 30, 22, 64], data.locale);
  addTableSheet(workbook, names.risks, h.risks, data.risks.map((r) => [r.risk, r.level, r.reason, r.recommendation]), [30, 14, 52, 52], data.locale);
  addReadinessSheet(workbook, data);
  addTableSheet(workbook, names.market, h.market, data.marketData.map((r) => [r.indicator, r.year, r.region, r.value, r.unit, r.currency, r.source, r.lastUpdated, r.matchQuality, r.explanation]), [28, 12, 22, 24, 12, 12, 26, 20, 22, 60], data.locale);
  addTableSheet(workbook, names.importExport, h.importExport, data.importExport.map((r) => [r.type, r.hsCode, r.productCategory, r.year, r.country, r.valueUsd, r.volume, r.unit, r.source]), [14, 12, 34, 12, 20, 16, 16, 12, 24], data.locale);
  addTableSheet(workbook, names.sources, h.sources, data.sources.map((r) => [r.sourceName, r.sourceType, r.url, r.year, r.lastUpdated, r.notes]), [24, 18, 36, 10, 18, 64], data.locale);
  addChartsSheet(workbook, data);
  addTableSheet(workbook, names.recommendations, h.recommendations, data.recommendations.map((r) => [r.area, r.recommendation, r.priority]), [22, 90, 14], data.locale);
  if (data.warnings.length) {
    addTableSheet(workbook, data.locale === "ru" ? "Предупреждения" : data.locale === "uz" ? "Ogohlantirishlar" : "Warnings", h.warnings, data.warnings.map((r) => [r.title, r.message, r.values, r.severity]), [28, 76, 60, 16], data.locale);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
