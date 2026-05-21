import type {
  Question,
  UserAnswer,
  Verdict,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  YesNoSeriesQuestion,
  DragOrderQuestion,
  BuildListQuestion,
  DropdownSentenceQuestion,
  HotAreaQuestion,
  CaseStudyQuestion,
} from "../../types/question";
import { SingleChoice } from "./SingleChoice";
import { MultipleChoice } from "./MultipleChoice";
import { YesNoSeries } from "./YesNoSeries";
import { DragOrder } from "./DragOrder";
import { BuildList } from "./BuildList";
import { DropdownSentence } from "./DropdownSentence";
import { HotArea } from "./HotArea";
import { CaseStudy } from "./CaseStudy";

export interface QuestionViewProps<Q extends Question = Question, A = UserAnswer> {
  question: Q;
  value: A | null;
  onChange: (v: A) => void;
  /** True after submit — disables interaction and reveals correct answers. */
  revealed: boolean;
  verdict: Verdict | null;
}

export function QuestionView(props: QuestionViewProps) {
  const { question } = props;
  switch (question.type) {
    case "single":
      return <SingleChoice {...(props as QuestionViewProps<SingleChoiceQuestion>)} />;
    case "multiple":
      return <MultipleChoice {...(props as QuestionViewProps<MultipleChoiceQuestion>)} />;
    case "yesno-series":
      return <YesNoSeries {...(props as QuestionViewProps<YesNoSeriesQuestion>)} />;
    case "drag-order":
      return <DragOrder {...(props as QuestionViewProps<DragOrderQuestion>)} />;
    case "build-list":
      return <BuildList {...(props as QuestionViewProps<BuildListQuestion>)} />;
    case "dropdown-sentence":
      return <DropdownSentence {...(props as QuestionViewProps<DropdownSentenceQuestion>)} />;
    case "hot-area":
      return <HotArea {...(props as QuestionViewProps<HotAreaQuestion>)} />;
    case "case-study":
      return <CaseStudy {...(props as QuestionViewProps<CaseStudyQuestion>)} />;
  }
}
