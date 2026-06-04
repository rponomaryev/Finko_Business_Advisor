import fontkit from "@pdf-lib/fontkit";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type PDFFont } from "pdf-lib";
import { prepareReportExport, type PreparedReportExport } from "./reportExportTypes.ts";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const BRAND = rgb(0.88, 0.08, 0.27);
const TEXT = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.41, 0.45, 0.5);
const LIGHT = rgb(0.94, 0.95, 0.97);

const logoPaths = [
  { d: "M7 8h38l-8 8H7V8Z", color: BRAND },
  { d: "M7 24h22l-8 8H7v-8Z", color: BRAND },
  { d: "M29 8h20L29 32H9l20-24Z", color: BRAND },
  { d: "M15 16h30l-7.9 8H15v-8Z", color: BRAND },
  { d: "M58 28V12h10.5v3.2h-6.8v3.6h6v3.2h-6V28H58Z", color: TEXT },
  { d: "M72 28V12h3.8v16H72Z", color: TEXT },
  { d: "M80 28V12h3.6l7.5 9.7V12h3.7v16h-3.5l-7.6-9.8V28H80Z", color: TEXT },
  { d: "M99.1 28V12h3.8v6.7l6.1-6.7h4.7l-6.6 7.1 7 8.9h-4.8l-4.8-6.2-1.6 1.7V28h-3.8Z", color: TEXT },
  { d: "M122.5 28.3c-4.7 0-8.1-3.5-8.1-8.2 0-4.8 3.4-8.3 8.1-8.3 4.8 0 8.2 3.5 8.2 8.3 0 4.7-3.4 8.2-8.2 8.2Zm0-3.5c2.5 0 4.2-2 4.2-4.7 0-2.8-1.7-4.8-4.2-4.8s-4.1 2-4.1 4.8c0 2.7 1.6 4.7 4.1 4.7Z", color: TEXT }
];

type PdfContext = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  logoImage?: PDFImage;
  y: number;
  pageIndex: number;
};

async function firstReadablePath(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

async function embedLogoImage(doc: PDFDocument) {
  const logoCandidates = [
    path.join(process.cwd(), "public", "finko-logo.png"),
    path.join(process.cwd(), "public", "logo.png")
  ];
  const logoPath = await firstReadablePath(logoCandidates);
  if (!logoPath) return undefined;
  try {
    return await doc.embedPng(await readFile(logoPath));
  } catch {
    return undefined;
  }
}

async function embedUnicodeFonts(doc: PDFDocument) {
  const projectFontDir = path.join(process.cwd(), "public", "fonts");
  const linuxRegular = [
    path.join(projectFontDir, "NotoSans-Regular.ttf"),
    path.join(projectFontDir, "DejaVuSans.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
  ];
  const linuxBold = [
    path.join(projectFontDir, "NotoSans-Bold.ttf"),
    path.join(projectFontDir, "DejaVuSans-Bold.ttf"),
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
  ];
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  if (systemRoot) {
    linuxRegular.push(path.join(systemRoot, "Fonts", "arial.ttf"));
    linuxBold.push(path.join(systemRoot, "Fonts", "arialbd.ttf"));
  }

  const regularPath = await firstReadablePath(linuxRegular);
  const boldPath = await firstReadablePath(linuxBold);

  if (regularPath && boldPath) {
    const font = await doc.embedFont(await readFile(regularPath), { subset: true });
    const boldFont = await doc.embedFont(await readFile(boldPath), { subset: true });
    return { font, boldFont };
  }

  return {
    font: await doc.embedFont(StandardFonts.Helvetica),
    boldFont: await doc.embedFont(StandardFonts.HelveticaBold)
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = text.replace(/\r/g, "");
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
    }
    if (current) lines.push(current);
  }

  return lines;
}

function addPage(context: PdfContext) {
  context.page = context.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  context.y = PAGE_HEIGHT - MARGIN;
  context.pageIndex += 1;
}

function ensureSpace(context: PdfContext, height: number) {
  if (context.y - height < MARGIN) {
    addPage(context);
  }
}

function drawTextBlock(context: PdfContext, text: string, options?: { size?: number; color?: ReturnType<typeof rgb>; x?: number; lineGap?: number }) {
  const size = options?.size ?? 10;
  const x = options?.x ?? MARGIN;
  const lineGap = options?.lineGap ?? 4;
  const lines = wrapText(text, context.font, size, PAGE_WIDTH - x - MARGIN);
  const lineHeight = size + lineGap;
  ensureSpace(context, lines.length * lineHeight);

  for (const line of lines) {
    context.page.drawText(line, {
      x,
      y: context.y - size,
      size,
      font: context.font,
      color: options?.color ?? TEXT
    });
    context.y -= lineHeight;
  }
}

function drawBulletList(context: PdfContext, items: string[]) {
  for (const item of items) {
    drawTextBlock(context, `• ${item}`, { size: 10 });
  }
}

function drawSectionTitle(context: PdfContext, title: string) {
  ensureSpace(context, 28);
  context.page.drawText(title, {
    x: MARGIN,
    y: context.y - 18,
    size: 15,
    font: context.boldFont,
    color: TEXT
  });
  context.y -= 26;
  context.page.drawLine({
    start: { x: MARGIN, y: context.y },
    end: { x: PAGE_WIDTH - MARGIN, y: context.y },
    thickness: 1,
    color: LIGHT
  });
  context.y -= 14;
}

function drawKeyValueRows(context: PdfContext, rows: Array<{ label: string; value: string }>) {
  for (const row of rows) {
    const labelWidth = 150;
    const valueWidth = PAGE_WIDTH - MARGIN * 2 - labelWidth - 12;
    const valueLines = wrapText(row.value, context.font, 10, valueWidth);
    const height = Math.max(24, valueLines.length * 14 + 10);
    ensureSpace(context, height + 6);

    context.page.drawRectangle({
      x: MARGIN,
      y: context.y - height,
      width: PAGE_WIDTH - MARGIN * 2,
      height,
      color: rgb(1, 1, 1),
      borderColor: LIGHT,
      borderWidth: 1
    });
    context.page.drawRectangle({
      x: MARGIN,
      y: context.y - height,
      width: labelWidth,
      height,
      color: LIGHT
    });
    context.page.drawText(row.label, {
      x: MARGIN + 8,
      y: context.y - 16,
      size: 10,
      font: context.boldFont,
      color: TEXT
    });
    let lineY = context.y - 16;
    for (const line of valueLines) {
      context.page.drawText(line, {
        x: MARGIN + labelWidth + 10,
        y: lineY,
        size: 10,
        font: context.font,
        color: TEXT
      });
      lineY -= 14;
    }
    context.y -= height + 6;
  }
}

function drawSimpleTable(context: PdfContext, headers: string[], rows: string[][], columnWidths: number[]) {
  const startX = MARGIN;
  const rowHeight = 18;
  ensureSpace(context, rowHeight + 6);

  let x = startX;
  for (let i = 0; i < headers.length; i += 1) {
    context.page.drawRectangle({
      x,
      y: context.y - rowHeight,
      width: columnWidths[i],
      height: rowHeight,
      color: BRAND
    });
    context.page.drawText(headers[i], {
      x: x + 4,
      y: context.y - 12,
      size: 8,
      font: context.boldFont,
      color: rgb(1, 1, 1)
    });
    x += columnWidths[i];
  }
  context.y -= rowHeight;

  for (const row of rows) {
    const wrapped = row.map((cell, index) => wrapText(cell, context.font, 8, columnWidths[index] - 8));
    const height = Math.max(...wrapped.map((lines) => Math.max(lines.length, 1))) * 11 + 8;
    ensureSpace(context, height + 2);
    x = startX;
    for (let i = 0; i < row.length; i += 1) {
      context.page.drawRectangle({
        x,
        y: context.y - height,
        width: columnWidths[i],
        height,
        color: rgb(1, 1, 1),
        borderColor: LIGHT,
        borderWidth: 1
      });
      let lineY = context.y - 11;
      for (const line of wrapped[i]) {
        context.page.drawText(line, {
          x: x + 4,
          y: lineY,
          size: 8,
          font: context.font,
          color: TEXT
        });
        lineY -= 11;
      }
      x += columnWidths[i];
    }
    context.y -= height;
  }
  context.y -= 8;
}


function numberFromCurrency(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function drawBarChart(context: PdfContext, title: string, rows: Array<{ item: string; amount: string }>) {
  const items = rows.filter((row) => numberFromCurrency(row.amount) > 0).slice(0, 7);
  if (!items.length) return;
  ensureSpace(context, 48 + items.length * 18);
  context.page.drawText(title, { x: MARGIN, y: context.y - 12, size: 10, font: context.boldFont, color: TEXT });
  context.y -= 22;
  const max = Math.max(...items.map((row) => numberFromCurrency(row.amount)), 1);
  for (const row of items) {
    const value = numberFromCurrency(row.amount);
    const label = wrapText(row.item, context.font, 7, 120)[0] ?? row.item;
    context.page.drawText(label, { x: MARGIN, y: context.y - 10, size: 7, font: context.font, color: TEXT });
    context.page.drawRectangle({ x: MARGIN + 130, y: context.y - 12, width: 210, height: 8, color: LIGHT });
    context.page.drawRectangle({ x: MARGIN + 130, y: context.y - 12, width: Math.max(2, 210 * value / max), height: 8, color: BRAND });
    context.page.drawText(row.amount, { x: MARGIN + 350, y: context.y - 10, size: 7, font: context.font, color: MUTED });
    context.y -= 17;
  }
  context.y -= 10;
}

function drawLogo(context: PdfContext) {
  if (context.logoImage) {
    const height = 28;
    const width = height * (context.logoImage.width / context.logoImage.height);
    context.page.drawImage(context.logoImage, {
      x: MARGIN,
      y: context.y - height,
      width,
      height
    });
    return;
  }
  for (const path of logoPaths) {
    context.page.drawSvgPath(path.d, {
      x: MARGIN,
      y: context.y - 34,
      scale: 1,
      color: path.color
    });
  }
}

function drawFooter(page: PDFPage, font: PDFFont, pageNumber: number) {
  const footerText = `FINKO SME Business Advisor  •  ${pageNumber}`;
  page.drawText(footerText, {
    x: MARGIN,
    y: 18,
    size: 9,
    font,
    color: MUTED
  });
}

function drawCover(context: PdfContext, data: PreparedReportExport) {
  drawLogo(context);
  context.y -= 64;
  context.page.drawText(data.title, {
    x: MARGIN,
    y: context.y - 24,
    size: 22,
    font: context.boldFont,
    color: TEXT
  });
  context.y -= 44;
  drawKeyValueRows(context, data.cover);
  drawSectionTitle(context, data.locale === "ru" ? "Краткое резюме" : data.locale === "uz" ? "Qisqacha xulosa" : "Executive summary");
  drawBulletList(context, data.executiveSummary);
}

function drawBody(context: PdfContext, data: PreparedReportExport) {
  const t = data.locale;
  drawSectionTitle(context, t === "ru" ? "Данные проекта" : t === "uz" ? "Loyiha ma'lumotlari" : "Project data");
  drawKeyValueRows(context, data.summary);

  drawSectionTitle(context, t === "ru" ? "Интервью" : t === "uz" ? "Intervyu" : "Interview data");
  drawSimpleTable(
    context,
    [t === "ru" ? "Раздел" : t === "uz" ? "Bo'lim" : "Section", t === "ru" ? "Поле" : t === "uz" ? "Maydon" : "Field", t === "ru" ? "Ответ" : t === "uz" ? "Javob" : "Answer"],
    data.interviewRows.map((row) => [row.section, row.field, row.answer]),
    [120, 150, 245]
  );

  drawSectionTitle(context, t === "ru" ? "Финансовая модель" : t === "uz" ? "Moliyaviy model" : "Financial model");
  drawSimpleTable(
    context,
    [t === "ru" ? "Показатель" : t === "uz" ? "Ko'rsatkich" : "Indicator", t === "ru" ? "Значение" : t === "uz" ? "Qiymat" : "Value", t === "ru" ? "Комментарий" : t === "uz" ? "Izoh" : "Comment"],
    data.financialRows.map((row) => [row.indicator, row.value, row.comment]),
    [160, 130, 225]
  );
  if (data.financingRecommendation) {
    drawTextBlock(context, data.financingRecommendation, { size: 10 });
  }

  drawSectionTitle(context, t === "ru" ? "Формулы" : t === "uz" ? "Formulalar" : "Formulas");
  drawSimpleTable(
    context,
    [t === "ru" ? "Показатель" : t === "uz" ? "Ko'rsatkich" : "Indicator", t === "ru" ? "Формула" : t === "uz" ? "Formula" : "Formula", t === "ru" ? "Подстановка" : t === "uz" ? "Qiymatlar" : "Substitution", t === "ru" ? "Результат" : t === "uz" ? "Natija" : "Result"],
    data.formulaRows.map((row) => [row.indicator, row.formula, row.substitution, row.result]),
    [95, 145, 185, 90]
  );

  drawSectionTitle(context, "CapEx");
  drawBarChart(context, t === "ru" ? "Структура инвестиций" : t === "uz" ? "Investitsiya tuzilmasi" : "Investment structure", data.capexRows);
  drawSimpleTable(context, [t === "ru" ? "Статья" : t === "uz" ? "Modda" : "Item", t === "ru" ? "Сумма" : t === "uz" ? "Summa" : "Amount", t === "ru" ? "Источник" : t === "uz" ? "Manba" : "Source"], data.capexRows.map((row) => [row.item, row.amount, row.source]), [210, 135, 170]);

  drawSectionTitle(context, "OpEx");
  drawBarChart(context, t === "ru" ? "Структура расходов" : t === "uz" ? "Xarajatlar tuzilmasi" : "Expense structure", data.opexRows);
  drawSimpleTable(context, [t === "ru" ? "Статья" : t === "uz" ? "Modda" : "Item", t === "ru" ? "Сумма" : t === "uz" ? "Summa" : "Amount", t === "ru" ? "Источник" : t === "uz" ? "Manba" : "Source"], data.opexRows.map((row) => [row.item, row.amount, row.source]), [210, 135, 170]);

  drawSectionTitle(context, t === "ru" ? "Оборотный капитал" : t === "uz" ? "Aylanma kapital" : "Working capital");
  drawSimpleTable(context, [t === "ru" ? "Элемент" : t === "uz" ? "Element" : "Element", t === "ru" ? "Сумма" : t === "uz" ? "Summa" : "Amount", t === "ru" ? "Комментарий" : t === "uz" ? "Izoh" : "Comment"], data.workingCapitalRows.map((row) => [row.item, row.amount, row.comment]), [185, 130, 200]);

  drawSectionTitle(context, t === "ru" ? "Финансирование" : t === "uz" ? "Moliyalashtirish" : "Financing");
  drawBarChart(context, t === "ru" ? "Структура финансирования" : t === "uz" ? "Moliyalashtirish tuzilmasi" : "Financing structure", data.financingRows);
  drawSimpleTable(context, [t === "ru" ? "Элемент" : t === "uz" ? "Element" : "Element", t === "ru" ? "Сумма" : t === "uz" ? "Summa" : "Amount", t === "ru" ? "Комментарий" : t === "uz" ? "Izoh" : "Comment"], data.financingRows.map((row) => [row.item, row.amount, row.comment]), [185, 130, 200]);

  drawSectionTitle(context, t === "ru" ? "Залог" : t === "uz" ? "Garov" : "Collateral");
  drawSimpleTable(context, [t === "ru" ? "Элемент" : t === "uz" ? "Element" : "Element", t === "ru" ? "Значение" : t === "uz" ? "Qiymat" : "Value", t === "ru" ? "Комментарий" : t === "uz" ? "Izoh" : "Comment"], data.collateralRows.map((row) => [row.item, row.amount, row.comment]), [185, 130, 200]);

  if (data.warnings.length) {
    drawSectionTitle(context, t === "ru" ? "Предупреждения" : t === "uz" ? "Ogohlantirishlar" : "Warnings");
    drawSimpleTable(context, [t === "ru" ? "Тип предупреждения" : t === "uz" ? "Ogohlantirish turi" : "Warning type", t === "ru" ? "Предупреждение" : t === "uz" ? "Ogohlantirish" : "Warning", t === "ru" ? "Значения" : t === "uz" ? "Qiymatlar" : "Values"], data.warnings.map((row) => [row.title, row.message, row.values]), [120, 260, 135]);
  }

  drawSectionTitle(context, t === "ru" ? "Риски" : t === "uz" ? "Risklar" : "Risks");
  drawSimpleTable(
    context,
    [t === "ru" ? "Риск" : t === "uz" ? "Risk" : "Risk", t === "ru" ? "Уровень" : t === "uz" ? "Daraja" : "Level", t === "ru" ? "Причина" : t === "uz" ? "Sabab" : "Reason"],
    data.risks.map((row) => [row.risk, row.level, row.reason]),
    [160, 70, 285]
  );

  drawSectionTitle(context, t === "ru" ? "Рыночные данные" : t === "uz" ? "Bozor ma'lumotlari" : "Market data");
  drawBulletList(context, data.marketData.map((row) => `${row.indicator}: ${row.value}. ${t === "ru" ? "Качество совпадения" : t === "uz" ? "Moslik sifati" : "Match quality"}: ${row.matchQuality}. ${row.explanation}`));

  drawSectionTitle(context, t === "ru" ? "Импорт и экспорт" : t === "uz" ? "Import va eksport" : "Import and export");
  drawBulletList(context, data.importExport.map((row) => row.productCategory));

  drawSectionTitle(context, t === "ru" ? "Рекомендации" : t === "uz" ? "Tavsiyalar" : "Recommendations");
  drawBulletList(context, data.recommendations.map((row) => row.recommendation));

  if (data.detailedConclusion.length) {
    drawSectionTitle(context, t === "ru" ? "Подробное заключение" : t === "uz" ? "Batafsil xulosa" : "Detailed conclusion");
    drawBulletList(context, data.detailedConclusion);
  }

  drawSectionTitle(context, t === "ru" ? "Источники" : t === "uz" ? "Manbalar" : "Sources");
  drawBulletList(context, data.sources.map((row) => row.notes || row.sourceName));

  ensureSpace(context, 90);
  drawSectionTitle(context, t === "ru" ? "Ограничение ответственности" : t === "uz" ? "Ogohlantirish" : "Disclaimer");
  drawTextBlock(context, data.disclaimer, { size: 10, color: MUTED });
}

export async function buildPdfReportBuffer(project: Record<string, unknown>, localeOverride?: unknown) {
  const data = prepareReportExport(project, localeOverride);
  return buildPdfReportFromData(data);
}

export async function buildPdfReportFromData(data: PreparedReportExport) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(data.title);
  doc.setAuthor("FINKO SME Business Advisor");
  doc.setSubject(`Project report: ${data.title}`);
  doc.setKeywords(["FINKO", data.title, "financial model", "risks", "sources"]);
  doc.setProducer("Codex");
  doc.setLanguage(data.locale);

  const { font, boldFont } = await embedUnicodeFonts(doc);
  const logoImage = await embedLogoImage(doc);

  const context: PdfContext = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font,
    boldFont,
    logoImage,
    y: PAGE_HEIGHT - MARGIN,
    pageIndex: 1
  };

  drawCover(context, data);
  addPage(context);
  drawBody(context, data);

  doc.getPages().forEach((page, index) => drawFooter(page, font, index + 1));
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
