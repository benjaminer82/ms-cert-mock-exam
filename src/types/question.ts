// Question schema for the Mock Exam app.
// All question objects share the BaseQuestion fields and discriminate on `type`.

export type QuestionType =
  | "single"
  | "multiple"
  | "yesno-series"
  | "drag-order"
  | "build-list"
  | "dropdown-sentence"
  | "hot-area"
  | "case-study";

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation?: string;
  tags?: string[]; // e.g. ["Identity", "Networking"]
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: "single";
  options: string[];
  /** index of the correct option */
  answer: number;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple";
  options: string[];
  /** indices of correct options. `selectCount` hints to the UI how many to pick. */
  answer: number[];
  selectCount?: number;
}

export interface YesNoStatement {
  statement: string;
  answer: "yes" | "no";
  explanation?: string;
}
export interface YesNoSeriesQuestion extends BaseQuestion {
  type: "yesno-series";
  statements: YesNoStatement[];
}

export interface DragOrderQuestion extends BaseQuestion {
  type: "drag-order";
  /** Items will be shuffled at runtime. Correct order = this array's order. */
  items: string[];
}

export interface BuildListQuestion extends BaseQuestion {
  type: "build-list";
  /** Source pool (some may be distractors). */
  pool: string[];
  /** Correct ordered sequence to assemble. */
  answer: string[];
}

export interface DropdownSentenceQuestion extends BaseQuestion {
  type: "dropdown-sentence";
  /** Sentence with `{{0}}`, `{{1}}` placeholders. */
  template: string;
  /** For each placeholder: list of options and the index of the correct one. */
  blanks: { options: string[]; answer: number }[];
}

export interface HotAreaOption {
  label: string;
  isCorrect: boolean;
}
export interface HotAreaQuestion extends BaseQuestion {
  type: "hot-area";
  /** Optional image URL; if absent, the labeled-option fallback is used. */
  imageUrl?: string;
  /** Labeled regions. User picks one. */
  options: HotAreaOption[];
}

export interface CaseStudyQuestion extends BaseQuestion {
  type: "case-study";
  /** Shared scenario shown across all sub-questions. */
  scenario: string;
  /** Sub-questions reusing supported types (no nested case-study). */
  subQuestions: Exclude<Question, CaseStudyQuestion>[];
}

export type Question =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | YesNoSeriesQuestion
  | DragOrderQuestion
  | BuildListQuestion
  | DropdownSentenceQuestion
  | HotAreaQuestion
  | CaseStudyQuestion;

export interface QuestionBank {
  /** Optional friendly name shown in the UI. */
  name?: string;
  /** Optional cert profile hint (e.g. "AZ-104"). */
  certification?: string;
  questions: Question[];
}

// ------- Runtime state -------

export type UserAnswer =
  | { type: "single"; choice: number | null }
  | { type: "multiple"; choices: number[] }
  | { type: "yesno-series"; values: ("yes" | "no" | null)[] }
  | { type: "drag-order"; order: string[] }
  | { type: "build-list"; order: string[] }
  | { type: "dropdown-sentence"; choices: (number | null)[] }
  | { type: "hot-area"; choice: number | null }
  | { type: "case-study"; subAnswers: (UserAnswer | null)[] };

export type Verdict = "correct" | "partial" | "incorrect" | "skipped";

export interface AnsweredRecord {
  questionId: string;
  /** Snapshot of the exact question variant shown to the user (post-shuffle/rephrase). */
  question?: Question;
  attempts: number; // 1 = first try; 2/3 = retakes
  verdict: Verdict;
  userAnswer: UserAnswer | null;
}
