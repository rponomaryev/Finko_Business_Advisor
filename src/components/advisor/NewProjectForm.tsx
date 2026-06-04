"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { getRegions } from "@/lib/data/regions";
import { useLocale } from "@/lib/i18n/client";

const FORM_DRAFT_KEY = "finko:new-project-draft:v1";

const demoByLocale = {
  ru: {
    businessType: "Кофейня",
    businessIdea: "Хочу открыть небольшую кофейню возле университета",
    region: "Ташкент город",
    district: "Юнусабад",
    plannedStartPeriod: "через 2 месяца"
  },
  uz: {
    businessType: "Qahvaxona",
    businessIdea: "Universitet yonida kichik qahvaxona ochmoqchiman",
    region: "Toshkent shahri",
    district: "Yunusobod",
    plannedStartPeriod: "2 oydan keyin"
  },
  en: {
    businessType: "Coffee shop",
    businessIdea: "I want to open a small coffee shop near a university",
    region: "Tashkent City",
    district: "Yunusabad",
    plannedStartPeriod: "in 2 months"
  }
};

export function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, messages } = useLocale();
  const isDemo = searchParams.get("demo") === "true";
  const demo = demoByLocale[locale];
  const [businessType, setBusinessType] = useState(isDemo ? demo.businessType : "");
  const [businessIdea, setBusinessIdea] = useState(isDemo ? demo.businessIdea : "");
  const [region, setRegion] = useState(isDemo ? demo.region : "");
  const [district, setDistrict] = useState(isDemo ? demo.district : "");
  const [plannedStartPeriod, setPlannedStartPeriod] = useState(isDemo ? demo.plannedStartPeriod : "");
  const [consentGiven, setConsentGiven] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const regions = useMemo(() => getRegions(locale), [locale]);
  const isReady = businessType.trim().length >= 2 && businessIdea.trim().length >= 5 && region.trim().length >= 2 && consentGiven;

  useEffect(() => {
    if (isDemo || typeof window === "undefined") {
      setDraftLoaded(true);
      return;
    }
    const raw = window.sessionStorage.getItem(FORM_DRAFT_KEY);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as Partial<Record<"businessType" | "businessIdea" | "region" | "district" | "plannedStartPeriod", string>> & { consentGiven?: boolean; locale?: string };
        if (!draft.locale || draft.locale === locale) {
          setBusinessType(draft.businessType ?? "");
          setBusinessIdea(draft.businessIdea ?? "");
          setRegion(draft.region ?? "");
          setDistrict(draft.district ?? "");
          setPlannedStartPeriod(draft.plannedStartPeriod ?? "");
          setConsentGiven(Boolean(draft.consentGiven));
        }
      } catch {
        window.sessionStorage.removeItem(FORM_DRAFT_KEY);
      }
    }
    setDraftLoaded(true);
  }, [isDemo, locale]);

  useEffect(() => {
    if (!draftLoaded || isDemo || typeof window === "undefined") return;
    window.sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({
      businessType,
      businessIdea,
      region,
      district,
      plannedStartPeriod,
      consentGiven,
      locale
    }));
  }, [businessType, businessIdea, region, district, plannedStartPeriod, consentGiven, locale, draftLoaded, isDemo]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isReady) return;
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessType,
        businessIdea,
        region,
        district,
        plannedStartPeriod,
        userLanguage: locale,
        consentGiven,
        consentLocale: locale,
        consentVersion: "1.0"
      })
    });

    if (!response.ok) {
      setSubmitting(false);
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (response.status === 401) {
        setError(locale === "ru" ? "Сессия истекла. Войдите заново через demo-login." : locale === "uz" ? "Sessiya muddati tugadi. demo-login orqali qayta kiring." : "Session expired. Please sign in again via demo-login.");
        router.push("/demo-login?next=/advisor/new");
        return;
      }
      setError(payload?.error ? `${messages.newProject.error}: ${payload.error}` : messages.newProject.error);
      return;
    }

    const data = await response.json();
    if (typeof window !== "undefined") window.sessionStorage.removeItem(FORM_DRAFT_KEY);
    router.push(`/advisor/projects/${data.projectId}`);
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <p className="text-sm font-semibold uppercase tracking-wide text-finko-primaryDark">{messages.newProject.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold">{messages.newProject.title}</h1>
        <p className="mt-2 text-sm text-finko-muted">{messages.newProject.description}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">{messages.newProject.businessType}</span>
            <Input
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value)}
              placeholder={messages.newProject.businessTypePlaceholder}
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">{messages.newProject.businessIdea}</span>
            <Textarea
              value={businessIdea}
              onChange={(event) => setBusinessIdea(event.target.value)}
              placeholder={messages.newProject.businessIdeaPlaceholder}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">{messages.newProject.region}</span>
              <Select value={region} onChange={(event) => setRegion(event.target.value)} required>
                <option value="">{messages.newProject.regionPlaceholder}</option>
                {regions.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}
              </Select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">{messages.newProject.district}</span>
              <Input
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                placeholder={messages.newProject.districtPlaceholder}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">{messages.newProject.plannedStart}</span>
              <Input
                value={plannedStartPeriod}
                onChange={(event) => setPlannedStartPeriod(event.target.value)}
                placeholder={messages.newProject.plannedStartPlaceholder}
              />
            </label>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-finko-border bg-slate-50 p-4 text-sm leading-6">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(event) => setConsentGiven(event.target.checked)}
              className="mt-1 h-4 w-4 accent-finko-primary"
              required
            />
            <span>
              {messages.newProject.consentText}{" "}
              <Link href="/privacy?from=/advisor/new" className="font-semibold text-finko-primary hover:text-finko-primaryDark">
                {messages.newProject.privacyLink}
              </Link>
            </span>
          </label>
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <Button type="submit" disabled={isSubmitting || !isReady}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {messages.newProject.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
