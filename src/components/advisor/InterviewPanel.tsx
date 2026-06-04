"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Calculator, CheckCircle2, Clock3, FileText, Loader2, Send, Sparkles } from "lucide-react";
import { AnswerInput } from "@/components/advisor/AnswerInput";
import { FinancialModelPanel } from "@/components/advisor/FinancialModelPanel";
import { InterviewCompletePanel } from "@/components/advisor/InterviewCompletePanel";
import { MarketDataPanel } from "@/components/advisor/MarketDataPanel";
import { MetricCard } from "@/components/advisor/MetricCard";
import { NextActionsPanel } from "@/components/advisor/NextActionsPanel";
import { ProjectSummaryCard } from "@/components/advisor/ProjectSummaryCard";
import { QuestionCard } from "@/components/advisor/QuestionCard";
import { ReportPreview } from "@/components/advisor/ReportPreview";
import { ReportPrintButton } from "@/components/advisor/ReportPrintButton";
import { RiskDistributionChart } from "@/components/advisor/FinancialProjectionChart";
import { RiskMatrix } from "@/components/advisor/RiskMatrix";
import { ScoreCard } from "@/components/advisor/ScoreCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { useLocale } from "@/lib/i18n/client";
import { getFreeAnswerPlaceholder, translateBlock } from "@/lib/i18n/interviewLabels";
import { hasEnoughDataForCalculation } from "@/lib/services/interviewService";
import type { FinancialResult, InterviewQuestion, RiskItem, StructuredProjectData } from "@/lib/types/project";
import { formatCurrencyCompact } from "@/lib/utils/formatCurrency";
import { getProjectProfile } from "@/lib/utils/projectClient";

type ProjectRecord = Record<string, any>;
type QuestionResponse = {
  block: string;
  blockId: string;
  blockDescription?: string;
  step: number;
  totalSteps: number;
  mode: "fallback";
  questions: InterviewQuestion[];
  completionPct: number;
  missingFields: string[];
  requiredVisibleQuestions?: InterviewQuestion[];
  canAdvance?: boolean;
  nextBlockId?: string | null;
  isInterviewComplete?: boolean;
  isManualBlock?: boolean;
};

function valueByPath(profile: StructuredProjectData, key: string): unknown {
  if (!key.includes(".")) return (profile as Record<string, unknown>)[key];
  const [root, child] = key.split(".");
  const rootValue = (profile as Record<string, unknown>)[root];
  return rootValue && typeof rootValue === "object" ? (rootValue as Record<string, unknown>)[child] : undefined;
}

function showIfMatchesLocally(question: InterviewQuestion, profile: StructuredProjectData): boolean {
  if (!question.showIf) return true;
  return Object.entries(question.showIf).every(([key, expected]) => {
    const actual = valueByPath(profile, key);
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  });
}

function initialAnswersFromProfile(project: ProjectRecord, questions: InterviewQuestion[]) {
  const profile = getProjectProfile(project);
  const nextAnswers: Record<string, unknown> = {};
  for (const question of questions) {
    const value = valueByPath(profile, question.key);
    if (value !== undefined && value !== null && value !== "") nextAnswers[question.key] = value;
  }
  return nextAnswers;
}

function serializeAnswerValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "");
}

function isAnswerMissing(question: InterviewQuestion, value: unknown): boolean {
  if (question.optional) return false;
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "" || value === "__later__";
  if (Array.isArray(value)) return value.length === 0;
  if (question.type === "staffPlan") {
    const roles = value && typeof value === "object" && Array.isArray((value as { roles?: unknown[] }).roles)
      ? (value as { roles: Array<Record<string, unknown>> }).roles
      : [];
    return roles.length === 0 || roles.some((role) => !String(role.role ?? "").trim() || Number(role.count ?? 0) <= 0 || Number(role.monthlySalaryAmount ?? 0) <= 0);
  }
  return false;
}

export function InterviewPanel({ initialProject }: { initialProject: ProjectRecord }) {
  const { locale, messages } = useLocale();
  const [project, setProject] = useState<ProjectRecord>(initialProject);
  const projectRef = useRef<ProjectRecord>(initialProject);
  const [questionResponse, setQuestionResponse] = useState<QuestionResponse | null>(null);
  const questionResponseRef = useRef<QuestionResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const answersRef = useRef<Record<string, unknown>>({});
  const [freeText, setFreeText] = useState("");
  const freeTextRef = useRef("");
  const [isSaving, setSaving] = useState(false);
  const [isTransitioningBlock, setTransitioningBlock] = useState(false);
  const pendingNextBlockIdRef = useRef<string | null | undefined>(undefined);
  const [isCalculating, setCalculating] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasHydratedInitialBlock = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const profile = useMemo(() => getProjectProfile(project), [project]);
  const financial = project.financialResult as FinancialResult | null;
  const risks = (project.riskResult as RiskItem[] | null) ?? [];
  const report = project.reportData as any;
  const reportLocale = profile.userLanguage ?? locale;
  const tabs = messages.interview.tabs;
  const resultMessages = messages.interviewResult;
  const canCalculate = Boolean(questionResponse?.isInterviewComplete || (questionResponse && questionResponse.missingFields.length === 0) || hasEnoughDataForCalculation(profile));
  const activeBlockCopy = questionResponse ? translateBlock(locale, questionResponse.blockId, questionResponse.block, questionResponse.blockDescription) : null;
  const freeAnswerPlaceholder = getFreeAnswerPlaceholder(locale, questionResponse?.blockId) ?? messages.interview.freeAnswerPlaceholder;
  const isFinalInterviewBlock = Boolean(questionResponse && questionResponse.step === questionResponse.totalSteps);

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { questionResponseRef.current = questionResponse; }, [questionResponse]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { freeTextRef.current = freeText; }, [freeText]);

  const loadQuestions = useCallback(async (nextProject: ProjectRecord, blockId?: string, currentAnswers?: Record<string, unknown>) => {
    const response = await fetch("/api/interview/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: nextProject.id, blockId, currentAnswers })
    });
    if (!response.ok) return;
    const data = await response.json() as QuestionResponse;
    setQuestionResponse(data);
    const hydratedAnswers = { ...initialAnswersFromProfile(nextProject, data.questions), ...(currentAnswers ?? {}) };
    setAnswers(hydratedAnswers);
    const hydratedPayload = data.questions
      .filter((question) => {
        const value = hydratedAnswers[question.key];
        return value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
      })
      .map((question) => ({
        key: question.key,
        question: question.question,
        answer: hydratedAnswers[question.key],
        answerType: question.type
      }));
    lastSavedSignatureRef.current = JSON.stringify({ blockId: data.blockId, answers: hydratedPayload, freeText: "" });
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    if (hasHydratedInitialBlock.current) return;
    hasHydratedInitialBlock.current = true;
    void loadQuestions(projectRef.current, "business_idea");
  }, [loadQuestions]);

  const buildAnswerPayload = useCallback((sourceAnswers = answersRef.current, sourceResponse = questionResponseRef.current) => {
    if (!sourceResponse) return [];
    return sourceResponse.questions
      .filter((question) => {
        const value = sourceAnswers[question.key];
        return value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
      })
      .map((question) => ({
        key: question.key,
        question: question.question,
        answer: sourceAnswers[question.key] as string | number | boolean | string[],
        answerType: question.type
      }));
  }, []);

  const saveCurrentBlock = useCallback(async (options: { advance: boolean; showAdvisorMessage: boolean; includeFreeText: boolean }) => {
    const currentResponse = questionResponseRef.current;
    if (!currentResponse) return projectRef.current;

    const answerPayload = buildAnswerPayload();
    const currentFreeText = options.includeFreeText ? freeTextRef.current.trim() : "";
    const signature = JSON.stringify({ blockId: currentResponse.blockId, answers: answerPayload, freeText: currentFreeText });

    if (!options.advance && signature === lastSavedSignatureRef.current) return projectRef.current;
    if (!options.advance && answerPayload.length === 0 && !currentFreeText) return projectRef.current;

    if (options.advance) setSaving(true);
    setSaveError(null);

    const summarizedAnswers = answerPayload
      .map((answer) => `${answer.key}: ${serializeAnswerValue(answer.answer)}`)
      .join("; ");
    const payloadMessage = [summarizedAnswers, currentFreeText].filter(Boolean).join("\n");

    try {
      const response = await fetch("/api/interview/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectRef.current.id,
          blockId: currentResponse.blockId,
          message: payloadMessage || "section completed",
          answers: answerPayload,
          autoSave: !options.advance,
          advance: options.advance
        })
      });

      if (!response.ok) {
        const errorMessage = options.advance ? messages.interview.saveError : messages.interview.saveError;
        setSaveError(errorMessage);
        return projectRef.current;
      }

      const data = await response.json();
      if (data.project) {
        projectRef.current = data.project;
        setProject(data.project);
      }
      if (options.advance) pendingNextBlockIdRef.current = data.nextBlockId ?? null;
      lastSavedSignatureRef.current = signature;
      setHasUnsavedChanges(false);
      if (options.showAdvisorMessage && data.advisorMessage) setMessage(data.advisorMessage);
      if (options.includeFreeText) setFreeText("");
      return data.project ?? projectRef.current;
    } finally {
      if (options.advance) setSaving(false);
    }
  }, [buildAnswerPayload, messages.interview.saveError]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  async function submitAnswers() {
    if (isSaving || isTransitioningBlock) return;
    pendingNextBlockIdRef.current = undefined;
    setMessage(null);
    setTransitioningBlock(true);
    try {
      const savedProject = await saveCurrentBlock({ advance: true, showAdvisorMessage: true, includeFreeText: true });
      const nextBlockId = pendingNextBlockIdRef.current;
      if (nextBlockId) {
        await loadQuestions(savedProject, nextBlockId);
      } else if (nextBlockId === null) {
        setMessage(messages.interview.reportReady);
      }
    } finally {
      setTransitioningBlock(false);
    }
  }

  async function calculateProject() {
    if (isSaving || isTransitioningBlock) return;
    await saveCurrentBlock({ advance: false, showAdvisorMessage: false, includeFreeText: false });
    setCalculating(true);
    const response = await fetch(`/api/projects/${projectRef.current.id}/calculate`, { method: "POST" });
    if (response.ok) { const data = await response.json(); setProject(data.project); projectRef.current = data.project; setActiveTabIndex(0); setMessage(messages.interview.calculationDone); }
    else setMessage(messages.interview.calculationError);
    setCalculating(false);
  }

  async function generateReport() {
    if (isSaving || isTransitioningBlock || isCalculating || !canCalculate) return;
    setCalculating(true);
    setSaveError(null);
    setMessage(messages.interview.reportGenerating);
    try {
      if (hasUnsavedChanges) {
        pendingNextBlockIdRef.current = undefined;
        await saveCurrentBlock({ advance: true, showAdvisorMessage: false, includeFreeText: true });
      }
      const response = await fetch(`/api/projects/${projectRef.current.id}/calculate`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        projectRef.current = data.project;
        setActiveTabIndex(5);
        setMessage(messages.interview.reportReady);
      } else {
        setMessage(messages.interview.calculationError);
      }
    } finally {
      setCalculating(false);
    }
  }

  async function selectInterviewBlock(blockId: string) {
    if (isSaving || isTransitioningBlock) return;
    if (questionResponseRef.current?.blockId === blockId) return;
    setMessage(null);
    if (hasUnsavedChanges && typeof window !== "undefined" && !window.confirm(messages.interview.unsavedLeave)) return;
    const savedProject = hasUnsavedChanges
      ? await saveCurrentBlock({ advance: false, showAdvisorMessage: false, includeFreeText: false })
      : projectRef.current;
    setFreeText("");
    await loadQuestions(savedProject, blockId);
  }

  const liveProfile = useMemo(() => ({ ...profile, ...answers } as StructuredProjectData), [profile, answers]);
  const visibleQuestions = useMemo(
    () => questionResponse?.questions.filter((question) => showIfMatchesLocally(question, liveProfile)) ?? [],
    [questionResponse, liveProfile]
  );
  const requiredQuestions = useMemo(() => visibleQuestions.filter((question) => !question.optional), [visibleQuestions]);
  const isCurrentBlockValid = useMemo(
    () => requiredQuestions.every((question) => !isAnswerMissing(question, answers[question.key])),
    [requiredQuestions, answers]
  );
  const shouldShowGenerateReportButton = Boolean(
    isFinalInterviewBlock && !financial && !hasUnsavedChanges && isCurrentBlockValid && canCalculate
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold">{project.title}</h1>
              </div>
              {!visibleQuestions.length || financial ? (
                <Button onClick={calculateProject} disabled={isCalculating || isSaving || isTransitioningBlock || !canCalculate}>
                  {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                  {messages.interview.calculate}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {questionResponse && activeBlockCopy ? <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between text-sm font-semibold"><span>{questionResponse.isManualBlock ? messages.interview.edit : messages.interview.step} {questionResponse.step} {messages.interview.of} {questionResponse.totalSteps}</span><span>{questionResponse.completionPct}%</span></div><div className="mt-2 h-2 rounded-full bg-white"><div className="h-full rounded-full bg-finko-primary" style={{ width: `${questionResponse.completionPct}%` }} /></div><p className="mt-3 text-sm text-finko-muted">{messages.interview.block}: {activeBlockCopy.name}</p>{activeBlockCopy.description ? <p className="mt-1 text-xs text-finko-muted">{activeBlockCopy.description}</p> : null}</div> : null}
            {message ? <p className="mt-4 rounded-2xl bg-finko-primaryLight p-3 text-sm text-finko-primaryDark">{message}</p> : null}
            <div className="mt-4 rounded-2xl border border-finko-border bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${saveError ? "bg-red-50 text-red-600" : hasUnsavedChanges ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {isTransitioningBlock || isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveError ? <AlertCircle className="h-4 w-4" /> : hasUnsavedChanges ? <Clock3 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="font-semibold text-finko-text">
                      {isTransitioningBlock ? messages.interview.preparingNextSection : isSaving ? messages.interview.saving : hasUnsavedChanges ? messages.interview.unsaved : messages.interview.savedState}
                    </p>
                    <p className="text-xs text-finko-muted">
                      {activeBlockCopy ? `${messages.interview.block}: ${activeBlockCopy.name}` : messages.interview.saved}
                    </p>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-finko-primaryLight px-3 py-1 text-xs font-semibold text-finko-primaryDark">
                  <Sparkles className="h-3.5 w-3.5" />
                  {questionResponse?.completionPct ?? 0}%
                </span>
              </div>
              {saveError ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{saveError}</p> : null}
            </div>
          </CardContent>
        </Card>

        {isTransitioningBlock ? (
          <Card className="border-finko-primary/20 bg-gradient-to-br from-white to-finko-primaryLight/40 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-finko-primary text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-finko-text">{messages.interview.preparingNextSection}</p>
                  <div className="mt-4 grid gap-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                      <div className="h-full w-2/3 animate-pulse rounded-full bg-finko-primary" />
                    </div>
                    <p className="text-xs text-finko-muted">{locale === "uz" ? "AI javoblarni tahlil qiladi, bo‘limni saqlaydi va keyingi blokni maʼlumotlarni yo‘qotmasdan tayyorlaydi." : locale === "en" ? "AI analyzes the answers, saves this section and prepares the next block without losing entered data." : "AI анализирует ответы, сохраняет раздел и подбирает следующий блок без потери введенных данных."}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : visibleQuestions.length ? (
          <div className="grid gap-4">
            {visibleQuestions.map((question) => <QuestionCard key={question.key} question={question}><AnswerInput question={question} value={answers[question.key]} onChange={(value) => { setHasUnsavedChanges(true); setAnswers((current) => ({ ...current, [question.key]: value })); }} /></QuestionCard>)}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold">{messages.interview.freeAnswer}</h2>
                <p className="mt-1 text-sm text-finko-muted">{messages.interview.freeAnswerHelp}</p>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={freeText}
                  onChange={(event) => { setHasUnsavedChanges(true); setFreeText(event.target.value); }}
                  placeholder={freeAnswerPlaceholder}
                />
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {!shouldShowGenerateReportButton ? (
                    <Button onClick={submitAnswers} disabled={isSaving || isTransitioningBlock || !isCurrentBlockValid}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {questionResponse?.isManualBlock ? messages.interview.saveSection : messages.interview.save}
                    </Button>
                  ) : null}
                  {shouldShowGenerateReportButton ? (
                    <Button onClick={generateReport} disabled={isCalculating || isSaving || isTransitioningBlock || !canCalculate}>
                      {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      {messages.interview.generateReport}
                    </Button>
                  ) : null}
                </div>
                {!isCurrentBlockValid ? <p className="mt-2 text-xs font-semibold text-amber-700">{messages.interview.incomplete}</p> : null}
              </CardContent>
            </Card>
          </div>
        ) : (
          <InterviewCompletePanel
            canCalculate={canCalculate}
            isCalculating={isCalculating}
            completionPct={100}
            sections={project.templateData?.interviewBlocks?.map((block: { id: string; name: string; description?: string }) => ({ id: block.id, name: translateBlock(locale, block.id, block.name, block.description).name, status: "completed" as const })) ?? []}
            onCalculate={generateReport}
            onReview={() => void selectInterviewBlock("business_idea")}
          />
        )}

        {financial ? <div className="grid gap-5">
          <div className="no-print flex flex-wrap gap-2">{tabs.map((tab, index) => <Button key={tab} variant={activeTabIndex === index ? "primary" : "outline"} onClick={() => setActiveTabIndex(index)}>{tab}</Button>)}</div>
          {activeTabIndex === 0 ? <div className="grid gap-5"><div className="grid gap-4 md:grid-cols-2"><ScoreCard title={messages.feasibilityScore} score={project.feasibilityScore ?? 0} caption={resultMessages.feasibilityCaption} /><ScoreCard title={messages.bankReadinessScore} score={project.bankReadinessScore ?? 0} caption={profile.creditNeeded === "no" ? resultMessages.bankReadinessNoCredit : resultMessages.bankReadinessDisclaimer} /></div><div className="grid gap-4 md:grid-cols-3"><MetricCard title={resultMessages.investment} value={formatCurrencyCompact(financial.capex.totalCapEx + financial.workingCapital.requiredWorkingCapital, "UZS", locale)} /><MetricCard title={resultMessages.creditLeasing} value={formatCurrencyCompact(financial.financing.loanRequired + financial.financing.leasingRequired, "UZS", locale)} /><MetricCard title="EBITDA" value={formatCurrencyCompact(financial.profitability.monthlyEBITDA, "UZS", locale)} /></div></div> : null}
          {activeTabIndex === 1 ? <FinancialModelPanel financial={financial} /> : null}
          {activeTabIndex === 2 ? <div className="grid gap-5"><Card><CardHeader><h2 className="text-xl font-bold">{resultMessages.riskDistribution}</h2></CardHeader><CardContent><RiskDistributionChart risks={risks} /></CardContent></Card><RiskMatrix risks={risks} conclusion={report?.riskConclusion} /></div> : null}
          {activeTabIndex === 3 ? <div className="grid gap-5"><ScoreCard title={messages.externalFinancingReadiness} score={project.bankReadinessScore ?? 0} caption={resultMessages.financingCaption} />{report?.nextActions ? <NextActionsPanel actions={report.nextActions} /> : null}</div> : null}
          {activeTabIndex === 4 ? <MarketDataPanel data={report?.marketData ?? project.marketDataResult ?? null} /> : null}
          {activeTabIndex === 5 ? (
            <div className="grid gap-4">
              <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link href={`/advisor/projects/${project.id}/report`}>
                  <Button>
                    <FileText className="h-4 w-4" />
                    {messages.interview.openReport}
                  </Button>
                </Link>
                <ReportPrintButton projectId={project.id} locale={reportLocale} disabled={!report} />
              </div>
              {report ? <ReportPreview report={report} locale={reportLocale} /> : null}
            </div>
          ) : null}
          {activeTabIndex === 6 ? (
            <Card>
              <CardHeader><h2 className="text-xl font-bold">{locale === "en" ? "Export" : locale === "uz" ? "Eksport" : "Экспорт"}</h2></CardHeader>
              <CardContent><ReportPrintButton projectId={project.id} locale={reportLocale} disabled={!report} /></CardContent>
            </Card>
          ) : null}
        </div> : null}
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{messages.interviewComplete.disclaimer}</p>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start"><ProjectSummaryCard profile={liveProfile} mode={project.aiMode} activeBlockId={questionResponse?.blockId} navigationDisabled={isSaving || isTransitioningBlock} onBlockSelect={selectInterviewBlock} /></aside>
    </div>
  );
}
