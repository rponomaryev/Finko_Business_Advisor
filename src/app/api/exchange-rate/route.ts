import { NextResponse } from "next/server";
import { getUsdUzsExchangeRate } from "@/lib/services/exchangeRateService";
import { enforceRateLimit } from "@/lib/server/security";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "exchangeRate");
  if (limited) return limited;

  const snapshot = await getUsdUzsExchangeRate();
  return NextResponse.json({
    rate: snapshot.rate,
    date: snapshot.date,
    source: snapshot.source
  });
}
