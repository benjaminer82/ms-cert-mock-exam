import type { CaseStudyQuestion, UserAnswer } from "../../types/question";
import type { QuestionViewProps } from "./QuestionView";
import { SingleChoice } from "./SingleChoice";
import { MultipleChoice } from "./MultipleChoice";
import { YesNoSeries } from "./YesNoSeries";
import { DragOrder } from "./DragOrder";
import { BuildList } from "./BuildList";
import { DropdownSentence } from "./DropdownSentence";
import { HotArea } from "./HotArea";

export function CaseStudy({
  question,
  value,
  onChange,
  revealed,
  verdict,
}: QuestionViewProps<CaseStudyQuestion>) {
  const subAnswers: (UserAnswer | null)[] =
    value && value.type === "case-study"
      ? value.subAnswers
      : question.subQuestions.map(() => null);

  function setSub(i: number, sub: UserAnswer) {
    const next = subAnswers.slice();
    next[i] = sub;
    onChange({ type: "case-study", subAnswers: next });
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-msblue-500 bg-msblue-50 p-3">
        <p className="text-xs uppercase font-semibold text-msblue-700 tracking-wide mb-1">
          Scenario
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-line">{question.scenario}</p>
      </div>

      <div className="space-y-6">
        {question.subQuestions.map((sq, i) => {
          const subProps = {
            value: subAnswers[i],
            onChange: (v: UserAnswer) => setSub(i, v),
            revealed,
            verdict,
          };
          return (
            <div key={sq.id} className="rounded border border-slate-200 p-4">
              <p className="font-medium mb-3">
                <span className="text-slate-500 mr-2">{i + 1}.</span>
                {sq.prompt}
              </p>
              {(() => {
                switch (sq.type) {
                  case "single":
                    return <SingleChoice question={sq} {...subProps} />;
                  case "multiple":
                    return <MultipleChoice question={sq} {...subProps} />;
                  case "yesno-series":
                    return <YesNoSeries question={sq} {...subProps} />;
                  case "drag-order":
                    return <DragOrder question={sq} {...subProps} />;
                  case "build-list":
                    return <BuildList question={sq} {...subProps} />;
                  case "dropdown-sentence":
                    return <DropdownSentence question={sq} {...subProps} />;
                  case "hot-area":
                    return <HotArea question={sq} {...subProps} />;
                }
              })()}
              {revealed && sq.explanation && (
                <p className="mt-2 text-sm text-slate-600">
                  <strong>Why:</strong> {sq.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
