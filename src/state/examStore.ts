import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AnsweredRecord,
  Question,
  QuestionBank,
  UserAnswer,
  Verdict,
} from "../types/question";
import { gradeQuestion } from "../utils/grading";
import { shuffle } from "../utils/helpers";
import { shuffleQuestion } from "../utils/transformQuestion";

const NUMBER_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

/**
 * Scan a question's explanation for explicit "Option X is true / correct"
 * verdicts and return the option indices declared true. Used to expand the
 * answer set when the author wrote a tighter "choose two" cap than the
 * explanation actually supports (e.g. three options are true but only two
 * were marked correct).
 *
 * Conservative: only ADDS options to the correct set, never removes.
 * Recognised patterns (case-insensitive):
 *   "A: True"               "Option A: True"
 *   "Option A is true / correct / also correct / a correct statement"
 *   "A would also be correct" / "A is also true"
 */
function findExplicitlyTrueOptions(
  explanation: string,
  optionCount: number,
): number[] {
  const out = new Set<number>();
  const add = (letter: string) => {
    const i = letter.toUpperCase().charCodeAt(0) - 65;
    if (i >= 0 && i < optionCount) out.add(i);
  };
  const patterns: RegExp[] = [
    // "A: True", "Option A: True"
    /(?:\bOption\s+)?\b([A-H])\s*[:.\-]\s*True\b/gi,
    // "Option A …true|correct" within ~200 chars on the same sentence
    /\bOption\s+([A-H])\b[^.;\n]{0,200}?\b(?:true|correct|a\s+correct\s+statement|also\s+correct|also\s+true)\b/gi,
    // "A would also be true/correct", "A is also correct/true"
    /\b([A-H])\s+(?:would|will|is|are)\s+(?:also\s+)?(?:be\s+)?(?:true|correct|a\s+correct\s+statement)\b/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(explanation)) !== null) {
      add(m[1]);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Reconcile each multiple-choice question's stated answer count with the
 * actual number of correct options. Two-step process:
 *   1. Expand `answer` if the explanation explicitly calls additional options
 *      true/correct (so an author's arbitrary "choose two" cap is overridden
 *      by the actual logic of their rationale).
 *   2. Rewrite the prompt so any "Select N / Choose N / N correct answers"
 *      wording matches the resulting answer count, and set `selectCount`.
 */
function normalizeBank(bank: QuestionBank): QuestionBank {
  const fixed = bank.questions.map((q) => {
    if (q.type !== "multiple") return q;

    // Step 1: expand correct-answer set from explanation cues.
    let answer = q.answer;
    if (q.explanation) {
      const extra = findExplicitlyTrueOptions(q.explanation, q.options.length);
      if (extra.length) {
        const merged = new Set<number>([...answer, ...extra]);
        if (merged.size !== answer.length) {
          answer = [...merged].sort((a, b) => a - b);
        }
      }
    }

    const actual = answer.length;
    if (actual === 0) return { ...q, answer };
    const word = NUMBER_WORDS[actual] ?? String(actual);
    let prompt = q.prompt;
    let replaced = false;

    // Step 2: patterns where a count word/digit appears in the prompt.
    const patterns: RegExp[] = [
      // "Select two", "Choose 3", "Pick any three", "Identify the four"
      /\b(select|choose|pick|identify|name|list)\s+(?:any\s+|all\s+|the\s+)?(one|two|three|four|five|six|\d+)\b/gi,
      // "Which two of the following", "Which 3 of"
      /\b(which)\s+(one|two|three|four|five|six|\d+)\b/gi,
      // "(Multiple Select, 2 correct answers)", "with 3 correct answers"
      /(\d+|one|two|three|four|five|six)(\s+correct\s+answers?)/gi,
    ];

    for (const re of patterns) {
      if (re.test(prompt)) {
        re.lastIndex = 0;
        prompt = prompt.replace(re, (_m, a, b) => {
          // Pattern 3 has the count first; patterns 1 & 2 have the verb first.
          if (typeof a === "string" && /\d|one|two|three|four|five|six/i.test(a)) {
            return `${word}${b}`;
          }
          return `${a} ${word}`;
        });
        replaced = true;
      }
    }

    if (!replaced && (q.selectCount ?? actual) !== actual) {
      prompt = `${prompt.trimEnd().replace(/[.?!]$/, "")}. (Select ${actual}.)`;
    }
    return { ...q, prompt, selectCount: actual, answer };
  });
  return { ...bank, questions: fixed };
}

export type ExamStage = "setup" | "exam" | "results";
export type ExamMode = "exam" | "learning";

interface QueueItem {
  question: Question;
  attempt: number; // 1 = first attempt, 2/3 = retake
  repeat?: boolean; // true when this is a previously-seen question being re-tested
}

export interface PickedItem {
  question: Question;
  repeat?: boolean;
}

interface ExamState {
  // setup
  bank: QuestionBank | null;
  bankErrors: string[];
  bankFileName: string | null;
  certCode: string;
  selectedCount: number;
  sessionSeconds: number;
  mode: ExamMode;

  // exam runtime
  stage: ExamStage;
  queue: QueueItem[]; // upcoming questions (front = current)
  currentIndex: number; // index inside `queue` (always 0 conceptually; kept for progress)
  totalPlanned: number; // initial queue length (excluding retakes)
  pendingAnswer: UserAnswer | null;
  submittedVerdict: Verdict | null;
  records: AnsweredRecord[]; // chronological
  retakeCounts: Record<string, number>; // questionId -> retakes scheduled
  startedAt: number; // epoch ms
  endsAt: number; // epoch ms (auto-submit time)
  reviewOffset: number; // 0 = live question; N = N-th record back from latest
  seenQuestionIds: string[]; // questions the user has answered across sessions

  // actions
  setBank: (bank: QuestionBank | null, errors: string[], fileName?: string | null) => void;
  setCertCode: (c: string) => void;
  setSelectedCount: (n: number) => void;
  setSessionSeconds: (s: number) => void;
  setMode: (m: ExamMode) => void;

  startExam: (questions: PickedItem[], sessionSeconds: number, mode: ExamMode) => void;
  setPendingAnswer: (a: UserAnswer | null) => void;
  submitCurrent: () => void; // grade & reveal feedback
  advanceAfterFeedback: () => void; // pop / requeue / finish
  finishExam: (timedOut: boolean) => void;
  resetToSetup: () => void;
  replaceCurrentQuestion: (q: Question) => void;
  clearSeenHistory: () => void;
  goBack: () => void; // navigate to a previously answered question (read-only review)
  goForward: () => void; // step back toward the live question
}

const STORAGE_KEY = "ms-cert-mock-exam.state.v1";

export const useExamStore = create<ExamState>()(
  persist(
    (set, get) => ({
      bank: null,
      bankErrors: [],
      bankFileName: null,
      certCode: "DP-600",
      selectedCount: 5,
      sessionSeconds: 0,
      mode: "exam",

      stage: "setup",
      queue: [],
      currentIndex: 0,
      totalPlanned: 0,
      pendingAnswer: null,
      submittedVerdict: null,
      records: [],
      retakeCounts: {},
      startedAt: 0,
      endsAt: 0,
      reviewOffset: 0,
      seenQuestionIds: [],

      setBank: (bank, errors, fileName) =>
        set({
          bank: bank ? normalizeBank(bank) : null,
          bankErrors: errors,
          bankFileName: fileName === undefined ? get().bankFileName : fileName,
        }),
      setCertCode: (c) => set({ certCode: c }),
      setSelectedCount: (n) => set({ selectedCount: n }),
      setSessionSeconds: (s) => set({ sessionSeconds: s }),
      setMode: (m) => set({ mode: m }),

      startExam: (questions, sessionSeconds, mode) => {
        const queue: QueueItem[] = questions.map((p) => ({
          question: p.question,
          attempt: 1,
          repeat: !!p.repeat,
        }));
        const now = Date.now();
        set({
          stage: "exam",
          queue,
          currentIndex: 0,
          totalPlanned: queue.length,
          pendingAnswer: null,
          submittedVerdict: null,
          records: [],
          retakeCounts: {},
          startedAt: now,
          endsAt: mode === "learning" ? 0 : now + sessionSeconds * 1000,
          sessionSeconds,
          mode,
          reviewOffset: 0,
        });
      },

      setPendingAnswer: (a) => set({ pendingAnswer: a }),

      submitCurrent: () => {
        const s = get();
        if (s.submittedVerdict !== null) return;
        const head = s.queue[0];
        if (!head) return;
        const verdict = gradeQuestion(head.question, s.pendingAnswer);
        const record: AnsweredRecord = {
          questionId: head.question.id,
          question: head.question,
          attempts: head.attempt,
          verdict,
          userAnswer: s.pendingAnswer,
        };
        const seen =
          verdict === "correct" && !s.seenQuestionIds.includes(head.question.id)
            ? [...s.seenQuestionIds, head.question.id]
            : s.seenQuestionIds;
        set({
          submittedVerdict: verdict,
          records: [...s.records, record],
          seenQuestionIds: seen,
        });
      },

      advanceAfterFeedback: () => {
        const s = get();
        if (s.submittedVerdict === null) return;
        const head = s.queue[0];
        if (!head) return;
        const rest = s.queue.slice(1);

        // No in-session retakes: missed questions stay out of seenQuestionIds
        // so they’ll be prioritized as unseen in the next session.
        set({
          queue: rest,
          pendingAnswer: null,
          submittedVerdict: null,
          currentIndex: s.currentIndex + 1,
          reviewOffset: 0,
        });

        if (rest.length === 0) {
          set({ stage: "results" });
        }
      },

      finishExam: (_timedOut) => {
        set({ stage: "results", queue: [], submittedVerdict: null, pendingAnswer: null });
      },

      resetToSetup: () =>
        set({
          stage: "setup",
          queue: [],
          currentIndex: 0,
          totalPlanned: 0,
          pendingAnswer: null,
          submittedVerdict: null,
          records: [],
          retakeCounts: {},
          startedAt: 0,
          endsAt: 0,
          reviewOffset: 0,
        }),

      goBack: () => {
        const s = get();
        const maxOffset = s.records.length;
        if (s.reviewOffset < maxOffset) set({ reviewOffset: s.reviewOffset + 1 });
      },
      goForward: () => {
        const s = get();
        if (s.reviewOffset > 0) set({ reviewOffset: s.reviewOffset - 1 });
      },

      replaceCurrentQuestion: (q) => {
        const s = get();
        if (s.queue.length === 0) return;
        const [head, ...rest] = s.queue;
        set({ queue: [{ ...head, question: q }, ...rest] });
      },

      clearSeenHistory: () => set({ seenQuestionIds: [] }),
    }),
    {
      name: STORAGE_KEY,
      // Persist everything except the parsed bank (it comes from a file the user re-uploads)
      partialize: (s) => ({
        bank: s.bank,
        bankFileName: s.bankFileName,
        certCode: s.certCode,
        selectedCount: s.selectedCount,
        sessionSeconds: s.sessionSeconds,
        mode: s.mode,
        stage: s.stage,
        queue: s.queue,
        currentIndex: s.currentIndex,
        totalPlanned: s.totalPlanned,
        pendingAnswer: s.pendingAnswer,
        submittedVerdict: s.submittedVerdict,
        records: s.records,
        retakeCounts: s.retakeCounts,
        startedAt: s.startedAt,
        endsAt: s.endsAt,
        reviewOffset: s.reviewOffset,
        seenQuestionIds: s.seenQuestionIds,
      }),
      onRehydrateStorage: () => (state) => {
        // Re-normalize the persisted bank so prompt/answer-count fixes apply
        // even to banks that were saved before the normalizer was added.
        if (state?.bank) {
          state.bank = normalizeBank(state.bank);
        }
      },
    }
  )
);

/**
 * Pick `count` questions. Unseen questions are prioritized; if there are not
 * enough unseen ones, the remainder is filled with previously-seen questions
 * (each marked `repeat: true` and pre-shuffled so the option order differs).
 */
export function pickQuestions(
  bank: QuestionBank,
  count: number,
  seenIds: string[] = [],
): PickedItem[] {
  const seen = new Set(seenIds);
  const unseen = shuffle(bank.questions.filter((q) => !seen.has(q.id)));
  const repeats = shuffle(bank.questions.filter((q) => seen.has(q.id)));
  const take = Math.min(count, bank.questions.length);
  const picked: PickedItem[] = [];
  for (const q of unseen) {
    if (picked.length >= take) break;
    picked.push({ question: q, repeat: false });
  }
  for (const q of repeats) {
    if (picked.length >= take) break;
    picked.push({ question: shuffleQuestion(q), repeat: true });
  }
  return picked;
}
