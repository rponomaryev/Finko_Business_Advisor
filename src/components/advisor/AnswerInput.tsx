"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { useLocale } from "@/lib/i18n/client";
import { translateQuestion } from "@/lib/i18n/interviewLabels";
import type { ExchangeRateSnapshot, InterviewQuestion, StaffPlan } from "@/lib/types/project";
import { labelValue, localizeUnitLabel } from "@/lib/utils/labels";

const laterValue = "__later__";
const otherPrefix = "other:";

function otherText(value: unknown): string {
  const text = String(value ?? "");
  return text.startsWith(otherPrefix) ? text.slice(otherPrefix.length) : "";
}

function normalizeStaffPlan(value: unknown): StaffPlan {
  if (value && typeof value === "object" && Array.isArray((value as StaffPlan).roles)) {
    return value as StaffPlan;
  }
  return { roles: [] };
}

function emptyStaffRole() {
  return {
    id: crypto.randomUUID(),
    role: "",
    count: 1,
    monthlySalaryAmount: 0,
    monthlySalaryCurrency: "UZS" as const
  };
}

export function AnswerInput({ question, value, onChange }: { question: InterviewQuestion; value: unknown; onChange: (value: unknown) => void }) {
  const { locale, messages } = useLocale();
  const displayQuestion = translateQuestion(locale, question);
  const [rate, setRate] = useState<ExchangeRateSnapshot | null>(null);
  const isOther = String(value ?? "") === "other" || String(value ?? "").startsWith(otherPrefix);
  const answerMessages = messages.answerInput;
  const chooseLabel = answerMessages.select;
  const laterLabel = answerMessages.later;
  const otherLabel = answerMessages.other;
  const staffPlan = useMemo(() => normalizeStaffPlan(value), [value]);

  useEffect(() => {
    if (question.type !== "staffPlan") return;
    let cancelled = false;
    fetch("/api/exchange-rate")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && typeof data.rate === "number") {
          const source = data.source === "cbu.uz" || data.source === "database-fallback" ? data.source : "hardcoded-fallback";
          setRate({
            currency: "USD",
            rate: data.rate,
            date: data.date,
            source,
            fetchedAt: new Date().toISOString()
          });
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [question.type]);

  function updateStaffPlan(next: StaffPlan) {
    onChange({
      ...next,
      exchangeRateSnapshot: rate ?? next.exchangeRateSnapshot
    });
  }

  if (question.type === "staffPlan") {
    const roleLabel = answerMessages.role;
    const countLabel = answerMessages.count;
    const salaryLabel = answerMessages.salary;
    const currencyLabel = answerMessages.currency;
    const addLabel = answerMessages.addRole;
    const rateLabel = rate
      ? `USD/UZS: ${rate.rate.toLocaleString(locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US")} (${rate.date})`
      : answerMessages.loadingRate;
    const usdHint = (amount: number) => {
      if (!rate) return null;
      const converted = Math.round(amount * rate.rate).toLocaleString(locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US");
      return answerMessages.usdHint.replace("{amount}", converted).replace("{date}", rate.date);
    };
    const roles = staffPlan.roles.length ? staffPlan.roles : [emptyStaffRole()];

    return (
      <div className="grid gap-3">
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-finko-muted">{rateLabel}</div>
        {roles.map((role, index) => (
          <div key={role.id ?? index} className="grid gap-2 rounded-2xl border border-finko-border bg-white p-3 sm:grid-cols-[minmax(0,1.2fr)_90px_minmax(0,1fr)_92px_40px]">
            <label className="grid gap-1 text-xs font-semibold text-finko-muted">
              {roleLabel}
              <Input
                value={role.role}
                onChange={(event) => {
                  const nextRoles = [...roles];
                  nextRoles[index] = { ...role, role: event.target.value };
                  updateStaffPlan({ ...staffPlan, roles: nextRoles });
                }}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-finko-muted">
              {countLabel}
              <Input
                type="number"
                min={1}
                value={String(role.count ?? 1)}
                onChange={(event) => {
                  const nextRoles = [...roles];
                  nextRoles[index] = { ...role, count: Number(event.target.value) };
                  updateStaffPlan({ ...staffPlan, roles: nextRoles });
                }}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-finko-muted">
              {salaryLabel}
              <Input
                type="number"
                min={0}
                value={String(role.monthlySalaryAmount ?? 0)}
                onChange={(event) => {
                  const nextRoles = [...roles];
                  nextRoles[index] = { ...role, monthlySalaryAmount: Number(event.target.value) };
                  updateStaffPlan({ ...staffPlan, roles: nextRoles });
                }}
              />
              {role.monthlySalaryCurrency === "USD" ? <span className="text-[11px] font-medium text-finko-muted">{usdHint(Number(role.monthlySalaryAmount ?? 0))}</span> : null}
            </label>
            <label className="grid gap-1 text-xs font-semibold text-finko-muted">
              {currencyLabel}
              <Select
                value={role.monthlySalaryCurrency ?? "UZS"}
                onChange={(event) => {
                  const nextRoles = [...roles];
                  nextRoles[index] = { ...role, monthlySalaryCurrency: event.target.value as "UZS" | "USD" };
                  updateStaffPlan({ ...staffPlan, roles: nextRoles });
                }}
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </Select>
            </label>
            <Button
              type="button"
              variant="ghost"
              className="self-end"
              onClick={() => updateStaffPlan({ ...staffPlan, roles: roles.filter((_, roleIndex) => roleIndex !== index) })}
              disabled={roles.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => updateStaffPlan({ ...staffPlan, roles: [...roles, emptyStaffRole()] })}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    );
  }

  if (question.type === "textarea") {
    return <Textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={displayQuestion.placeholder} />;
  }

  if (question.type === "number") {
    return (
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <Input type="number" min={0} value={String(value === laterValue ? "" : value ?? "")} onChange={(event) => onChange(event.target.value)} />
        {displayQuestion.unit ? <span className="text-sm text-finko-muted">{localizeUnitLabel(displayQuestion.unit, locale)}</span> : null}
        {question.optional ? <button type="button" className="text-left text-xs font-semibold text-finko-primary" onClick={() => onChange(laterValue)}>{laterLabel}</button> : null}
      </div>
    );
  }

  if (question.type === "select") {
    const selectValue = isOther ? "other" : String(value ?? "");
    return (
      <div className="grid gap-3">
        <Select value={selectValue} onChange={(event) => onChange(event.target.value)}>
          <option value="">{chooseLabel}</option>
          {(question.options ?? []).map((option) => <option key={option} value={option}>{labelValue(option, locale)}</option>)}
        </Select>
        {isOther ? <Textarea value={otherText(value)} onChange={(event) => onChange(`${otherPrefix}${event.target.value}`)} placeholder={otherLabel} /> : null}
        {question.optional ? <button type="button" className="text-left text-xs font-semibold text-finko-primary" onClick={() => onChange(laterValue)}>{laterLabel}</button> : null}
      </div>
    );
  }

  if (question.type === "multiselect") {
    const values = Array.isArray(value) ? value.map(String) : [];
    const selected = new Set(values.map((item) => item.startsWith(otherPrefix) ? "other" : item));
    const existingOtherText = values.find((item) => item.startsWith(otherPrefix))?.slice(otherPrefix.length) ?? "";
    return (
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {(question.options ?? []).map((option) => (
            <label key={option} className="flex items-center gap-2 rounded-xl border border-finko-border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(option)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option);
                  else next.delete(option);
                  const normalized = [...next].filter((item) => item !== "other");
                  if (next.has("other")) normalized.push(`${otherPrefix}${existingOtherText}`);
                  onChange(normalized);
                }}
              />
              {labelValue(option, locale)}
            </label>
          ))}
        </div>
        {selected.has("other") ? <Textarea value={existingOtherText} placeholder={otherLabel} onChange={(event) => onChange([...selected].filter((item) => item !== "other").concat(`${otherPrefix}${event.target.value}`))} /> : null}
      </div>
    );
  }

  if (question.type === "boolean") {
    return (
      <Select value={value === undefined ? "" : String(value)} onChange={(event) => onChange(event.target.value === laterValue ? laterValue : event.target.value === "true")}>
        <option value="">{chooseLabel}</option>
        <option value="true">{labelValue(true, locale)}</option>
        <option value="false">{labelValue(false, locale)}</option>
        {question.optional ? <option value={laterValue}>{laterLabel}</option> : null}
      </Select>
    );
  }

  return <Input value={String(value === laterValue ? "" : value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={displayQuestion.placeholder} />;
}
