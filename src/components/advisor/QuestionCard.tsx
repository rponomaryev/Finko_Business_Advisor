import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { useLocale } from "@/lib/i18n/client";
import { translateQuestion } from "@/lib/i18n/interviewLabels";
import type { InterviewQuestion } from "@/lib/types/project";

export function QuestionCard({ question, children }: { question: InterviewQuestion; children: ReactNode }) {
  const { locale, messages } = useLocale();
  const localizedQuestion = translateQuestion(locale, question);
  const optionalLabel = messages.question.optional;
  return (
    <Card className="shadow-sm">
      <CardContent>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-finko-primaryDark">
            {localizedQuestion.label}{localizedQuestion.optional ? ` • ${optionalLabel}` : ""}
          </p>
          <h3 className="mt-1 font-semibold text-finko-text">{localizedQuestion.question}</h3>
          {localizedQuestion.helpText ? <p className="mt-1 text-sm text-finko-muted">{localizedQuestion.helpText}</p> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
