import { buildGenericBusinessTemplate } from "../data/sectorTemplates/genericBusinessTemplate.ts";
import type { DynamicBusinessTemplate } from "../types/sector.ts";

export async function generateBusinessTemplate(input: {
  businessType: string;
  businessIdea?: string;
}): Promise<DynamicBusinessTemplate> {
  // The deterministic template is the production-safe fallback. It never reverts
  // unrelated businesses to the old toy-production template.
  return buildGenericBusinessTemplate(input.businessType || input.businessIdea || "Универсальный бизнес");
}
