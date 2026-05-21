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

export type ExamStage = "setup" | "exam" | "results";

interface QueueItem {
  question: Question;
  attempt: number; // 1 = first attempt, 2/3 = retake
}

interface ExamState {
  // setup
  bank: QuestionBank | null;
  bankErrors: string[];
  certCode: string;
  selectedCount: number;
  sessionSeconds: number;

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

  // actions
  setBank: (bank: QuestionBank | null, errors: string[]) => void;
  setCertCode: (c: string) => void;
  setSelectedCount: (n: number) => void;
  setSessionSeconds: (s: number) => void;

  startExam: (questions: Question[], sessionSeconds: number) => void;
  setPendingAnswer: (a: UserAnswer | null) => void;
  submitCurrent: () => void; // grade & reveal feedback
  advanceAfterFeedback: () => void; // pop / requeue / finish
  finishExam: (timedOut: boolean) => void;
  resetToSetup: () => void;
}

const STORAGE_KEY = "ms-cert-mock-exam.state.v1";
const MAX_ATTEMPTS = 3; // 1 initial + up to 2 retakes

export const useExamStore = create<ExamState>()(
  persist(
    (set, get) => ({
      bank: null,
      bankErrors: [],
      certCode: "AZ-104",
      selectedCount: 5,
      sessionSeconds: 0,

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

      setBank: (bank, errors) => set({ bank, bankErrors: errors }),
      setCertCode: (c) => set({ certCode: c }),
      setSelectedCount: (n) => set({ selectedCount: n }),
      setSessionSeconds: (s) => set({ sessionSeconds: s }),

      startExam: (questions, sessionSeconds) => {
        const queue: QueueItem[] = questions.map((q) => ({ question: q, attempt: 1 }));
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
          endsAt: now + sessionSeconds * 1000,
          sessionSeconds,
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
          attempts: head.attempt,
          verdict,
          userAnswer: s.pendingAnswer,
        };
        set({
          submittedVerdict: verdict,
          records: [...s.records, record],
        });
      },

      advanceAfterFeedback: () => {
        const s = get();
        if (s.submittedVerdict === null) return;
        const head = s.queue[0];
        if (!head) return;
        const verdict = s.submittedVerdict;
        const rest = s.queue.slice(1);
        const nextRetakes = { ...s.retakeCounts };

        // Re-queue if incorrect/partial AND we still have attempts left
        if (verdict !== "correct" && verdict !== "skipped") {
          const used = nextRetakes[head.question.id] ?? 0;
          if (head.attempt < MAX_ATTEMPTS) {
            const insertPos = Math.min(3, rest.length); // a few questions later
            rest.splice(insertPos, 0, {
              question: head.question,
              attempt: head.attempt + 1,
            });
            nextRetakes[head.question.id] = used + 1;
          }
        }

        // If finished correctly previously-missed question, remove from retake set
        if (verdict === "correct" && (nextRetakes[head.question.id] ?? 0) > 0) {
          // mastered — keep count for the report, no action needed
        }

        set({
          queue: rest,
          pendingAnswer: null,
          submittedVerdict: null,
          retakeCounts: nextRetakes,
          currentIndex: s.currentIndex + 1,
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
        }),
    }),
    {
      name: STORAGE_KEY,
      // Persist everything except the parsed bank (it comes from a file the user re-uploads)
      partialize: (s) => ({
        certCode: s.certCode,
        selectedCount: s.selectedCount,
        sessionSeconds: s.sessionSeconds,
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
      }),
    }
  )
);

/** Pick `count` random questions from the bank (Fisher-Yates). */
export function pickQuestions(bank: QuestionBank, count: number): Question[] {
  const shuffled = shuffle(bank.questions);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
