import { useExamStore } from "./state/examStore";
import { SetupScreen } from "./components/screens/SetupScreen";
import { ExamScreen } from "./components/screens/ExamScreen";
import { ResultsScreen } from "./components/screens/ResultsScreen";

export default function App() {
  const stage = useExamStore((s) => s.stage);

  return (
    <div className="min-h-screen">
      {stage === "setup" && <SetupScreen />}
      {stage === "exam" && <ExamScreen />}
      {stage === "results" && <ResultsScreen />}
      <footer className="text-center text-xs text-slate-400 py-4 print:hidden">
        MS Cert Mock Exam · 100% client-side · progress saved in your browser.
      </footer>
    </div>
  );
}
