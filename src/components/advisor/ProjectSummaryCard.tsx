"use client";

import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { resolveTemplateForData } from "@/lib/services/templateService";
import type { InterviewBlock, InterviewQuestion, StructuredProjectData } from "@/lib/types/project";
import { cn } from "@/lib/utils/cn";
import { formatCurrencyWithOriginal } from "@/lib/utils/formatCurrency";
import { labelValue } from "@/lib/utils/labels";
import { useLocale } from "@/lib/i18n/client";
import { translateBlock } from "@/lib/i18n/interviewLabels";

function valueByPath(profile: StructuredProjectData, key: string): unknown {
  if (!key.includes(".")) return (profile as Record<string, unknown>)[key];
  const [root, child] = key.split(".");
  const rootValue = (profile as Record<string, unknown>)[root];
  return rootValue && typeof rootValue === "object" ? (rootValue as Record<string, unknown>)[child] : undefined;
}

function showIfMatches(question: InterviewQuestion, profile: StructuredProjectData): boolean {
  if (!question.showIf) return true;
  return Object.entries(question.showIf).every(([key, expected]) => {
    const actual = valueByPath(profile, key);
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  });
}

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "" || value === "__later__";
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object" && "roles" in value) {
    const roles = (value as { roles?: Array<Record<string, unknown>> }).roles;
    return !Array.isArray(roles) || roles.length === 0 || roles.some((role) => !String(role.role ?? "").trim() || Number(role.count ?? 0) <= 0 || Number(role.monthlySalaryAmount ?? 0) <= 0);
  }
  return false;
}

function blockStatus(block: InterviewBlock, profile: StructuredProjectData, requiredInputs: string[]) {
  const requiredKeys = new Set(requiredInputs);
  const requiredQuestions = block.questions.filter((question) => requiredKeys.has(question.key) && showIfMatches(question, profile));
  const missing = requiredQuestions.filter((question) => isMissing(valueByPath(profile, question.key)));
  const answered = requiredQuestions.length - missing.length;
  const pct = requiredQuestions.length === 0 ? 0 : Math.round((answered / requiredQuestions.length) * 100);
  const optionalOnly = requiredQuestions.length === 0;
  return { required: requiredQuestions.length, missing: missing.length, pct, optionalOnly };
}

const displayFields: Array<keyof StructuredProjectData | string> = [
  "businessType",
  "businessIdea",
  "region",
  "district",
  "plannedStartPeriod",
  "productOrService",
  "premisesStatus",
  "equipmentCondition",
  "monthlyCapacity",
  "averagePrice",
  "targetCustomers",
  "creditNeeded",
  "collateralAvailable",
  "experienceLevel"
];

export function ProjectSummaryCard({
  profile,
  completionPct,
  activeBlockId,
  navigationDisabled = false,
  onBlockSelect
}: {
  profile: StructuredProjectData;
  mode?: string | null;
  completionPct?: number;
  activeBlockId?: string;
  navigationDisabled?: boolean;
  onBlockSelect?: (blockId: string) => void;
}) {
  const { messages, locale } = useLocale();
  const summaryMessages = messages.projectSummaryCard;
  const template = resolveTemplateForData(profile);
  const blockStatuses = template.interviewBlocks.map((block) => blockStatus(block, profile, template.requiredInputs));
  const requiredKeys = new Set(template.requiredInputs);
  const visibleRequiredQuestions = template.interviewBlocks.flatMap((block) =>
    block.questions.filter((question) => requiredKeys.has(question.key) && showIfMatches(question, profile))
  );
  const missing = visibleRequiredQuestions.filter((question) => isMissing(valueByPath(profile, question.key)));
  const pct = completionPct ?? (visibleRequiredQuestions.length
    ? Math.round(((visibleRequiredQuestions.length - missing.length) / visibleRequiredQuestions.length) * 100)
    : 100);
  const firstIncompleteIndex = blockStatuses.findIndex((status) => status.missing > 0);
  const maxAccessibleIndex = firstIncompleteIndex === -1 ? template.interviewBlocks.length - 1 : firstIncompleteIndex;
  const lockedTooltip = summaryMessages.lockedTooltip;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{messages.projectSummary}</h2>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs font-semibold text-finko-muted"><span>{summaryMessages.filled}</span><span>{pct}%</span></div>
          <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-finko-primary" style={{ width: `${pct}%` }} /></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 rounded-2xl border border-finko-border bg-slate-50 p-3">
          <h3 className="text-sm font-bold">{summaryMessages.sections}</h3>
          <div className="grid gap-2">
            {template.interviewBlocks.map((block, index) => {
              const status = blockStatuses[index];
              const blockCopy = translateBlock(locale, block.id, block.name, block.description);
              const isActive = activeBlockId === block.id;
              const locked = index > maxAccessibleIndex;
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => { if (!locked && !navigationDisabled) onBlockSelect?.(block.id); }}
                  disabled={locked || navigationDisabled}
                  title={locked ? lockedTooltip : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                    isActive ? "border-finko-primary bg-finko-primaryLight text-finko-primaryDark" : "border-finko-border bg-white hover:border-finko-primary/50 hover:text-finko-primary",
                    (locked || navigationDisabled) && "cursor-not-allowed opacity-55 hover:border-finko-border hover:text-finko-text"
                  )}
                >
                  <span className="min-w-0 font-semibold">{blockCopy.name}</span>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", !locked && status.missing === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>
                    {locked ? <Lock className="h-3 w-3" /> : null}
                    {locked ? "0%" : status.optionalOnly ? "—" : status.missing === 0 ? "OK" : `${status.pct}%`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {displayFields.map((key) => {
            const value = valueByPath(profile, String(key));
            if (isMissing(value)) return null;
            const label = summaryMessages.fields[String(key)] ?? String(key);
            return (
              <div key={String(key)} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 text-sm last:border-0">
                <span className="text-finko-muted">{label}</span>
                <span className="max-w-[58%] overflow-safe text-right font-semibold tabular-nums">
                  {key === "ownContributionAmount"
                    ? formatCurrencyWithOriginal(profile.ownContributionUZS, profile.ownContributionAmount, profile.ownContributionCurrency, locale)
                    : labelValue(value, locale)}
                </span>
              </div>
            );
          })}
        </div>
        {profile.ownContributionAmount || profile.ownContributionUZS ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm">
            <p className="text-finko-muted">{summaryMessages.ownContribution}</p>
            <p className="mt-1 font-semibold tabular-nums">{formatCurrencyWithOriginal(profile.ownContributionUZS, profile.ownContributionAmount, profile.ownContributionCurrency, locale)}</p>
          </div>
        ) : null}
        {missing.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{messages.interview.incomplete}</div>
        ) : (
          <div className="mt-4 rounded-2xl bg-finko-primaryLight p-3 text-sm text-finko-primaryDark">{messages.interview.completedDescription}</div>
        )}
      </CardContent>
    </Card>
  );
}
