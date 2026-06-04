import { prisma } from "../db/prisma.ts";
import type { ExchangeRateSnapshot } from "../types/project.ts";

const CBU_USD_URL = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/";
const FALLBACK_RATE = 12_500;
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedRate: { value: ExchangeRateSnapshot; expiresAt: number } | null = null;

type CbuCurrency = {
  Ccy?: string;
  Rate?: string;
  Date?: string;
};

function parseCbuRate(payload: unknown): ExchangeRateSnapshot | null {
  if (!Array.isArray(payload)) return null;
  const usd = payload.find((item: CbuCurrency) => item?.Ccy === "USD") as CbuCurrency | undefined;
  if (!usd?.Rate) return null;
  const rate = Number(String(usd.Rate).replace(",", "."));
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return {
    currency: "USD",
    rate,
    date: usd.Date ?? new Date().toISOString().slice(0, 10),
    source: "cbu.uz",
    fetchedAt: new Date().toISOString()
  };
}

async function saveRate(snapshot: ExchangeRateSnapshot) {
  const db = prisma as any;
  if (!db.exchangeRate) return;
  await db.exchangeRate.create({
    data: {
      currency: "USD",
      base: "UZS",
      rate: snapshot.rate,
      date: snapshot.date,
      source: snapshot.source
    }
  }).catch(() => undefined);
}

async function getLastStoredRate(): Promise<ExchangeRateSnapshot | null> {
  const db = prisma as any;
  if (!db.exchangeRate) return null;
  const latest = await db.exchangeRate.findFirst({
    where: { currency: "USD", base: "UZS" },
    orderBy: { fetchedAt: "desc" }
  }).catch(() => null);
  if (!latest) return null;
  return {
    currency: "USD",
    rate: latest.rate,
    date: latest.date,
    source: "database-fallback",
    fetchedAt: latest.fetchedAt?.toISOString?.() ?? new Date().toISOString()
  };
}

export async function getUsdUzsExchangeRate(): Promise<ExchangeRateSnapshot> {
  if (cachedRate && cachedRate.expiresAt > Date.now()) return cachedRate.value;

  try {
    const response = await fetch(CBU_USD_URL, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`CBU responded with ${response.status}`);
    const parsed = parseCbuRate(await response.json());
    if (!parsed) throw new Error("CBU USD rate was not found.");
    cachedRate = { value: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
    await saveRate(parsed);
    return parsed;
  } catch {
    const stored = await getLastStoredRate();
    if (stored) {
      cachedRate = { value: stored, expiresAt: Date.now() + CACHE_TTL_MS };
      return stored;
    }
    const fallback: ExchangeRateSnapshot = {
      currency: "USD",
      rate: FALLBACK_RATE,
      date: new Date().toISOString().slice(0, 10),
      source: "hardcoded-fallback",
      fetchedAt: new Date().toISOString()
    };
    console.warn("[exchange-rate] CBU unavailable and no stored rate found; using fallback 12500 UZS/USD.");
    cachedRate = { value: fallback, expiresAt: Date.now() + CACHE_TTL_MS };
    return fallback;
  }
}
