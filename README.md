# MS Cert Mock Exam

A 100% client-side practice exam runner modeled on the Microsoft certification exam UI.
Upload a question bank (`.json` or `.md`), pick a target exam (e.g. AZ-104, SC-200) and a
session size, and the timer is calculated proportionally to the real exam.

> Built from [mock-exam-app-prompt.md](mock-exam-app-prompt.md).

## Features

- All 8 Microsoft question types: single, multiple, yes/no series, drag-and-drop ordering,
  build-list, dropdown-in-sentence, hot area (labeled-option fallback), and case studies.
- Pluggable parsers — start with JSON and Markdown; PDF/DOCX modules surface friendly errors
  and can be slotted into [src/parsers](src/parsers).
- Per-question feedback flow: reveal correct answer + explanation, manual `Next` to proceed.
- Spaced reinforcement of wrong answers: re-queued later in the session, capped at 2 retakes.
- Timer auto-submits when time expires.
- Keyboard: `Enter` submits / advances, `1-9` selects options for single/multiple/hot-area.
- Results page with per-type breakdown, attempt history, "still missed" list, and export
  to JSON or print-to-PDF.
- Progress (queue + records + timer endpoint) persisted to `localStorage` — refresh-safe.
- Accessible: keyboard nav, ARIA labels, visible focus, sufficient contrast.

## Setup

Requires Node 18+.

```powershell
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
npm run preview  # preview the build locally
```

## Question file schema

The canonical format is JSON. The full schema lives in
[src/types/question.ts](src/types/question.ts); a complete demo bank with every supported
type is at [src/data/sampleQuestions.json](src/data/sampleQuestions.json).

Top-level shape:

```json
{
  "name": "My Bank",
  "certification": "AZ-104",
  "questions": [ ... ]
}
```

Every question has `id`, `type`, `prompt`, optional `explanation`, optional `tags`.
Type-specific fields:

| `type`              | required fields                                                  |
| ------------------- | ---------------------------------------------------------------- |
| `single`            | `options[]`, `answer` (index)                                    |
| `multiple`          | `options[]`, `answer[]` (indices), optional `selectCount`        |
| `yesno-series`      | `statements[{statement, answer}]`                                |
| `drag-order`        | `items[]` (correct order; shuffled at runtime)                   |
| `build-list`        | `pool[]`, `answer[]` (correct sequence)                          |
| `dropdown-sentence` | `template` with `{{0}}`, `{{1}}` …; `blanks[{options, answer}]`  |
| `hot-area`          | `options[{label, isCorrect}]`, optional `imageUrl`               |
| `case-study`        | `scenario`, `subQuestions[]` (any non–case-study type)           |

### Markdown shorthand

For `single` / `multiple` questions, you can use a friendlier Markdown format
(see [src/parsers/markdownParser.ts](src/parsers/markdownParser.ts)):

```markdown
# My Bank
> certification: AZ-104

## Q: Which Azure service provides a managed Kubernetes cluster?
- [ ] Azure Container Instances
- [x] Azure Kubernetes Service
- [ ] Azure Service Fabric
- [ ] Azure App Service
> Explanation: AKS is the managed Kubernetes offering.
> Tags: Compute, Containers
```

Multiple `[x]` boxes ⇒ multiple-answer. Other question types must use JSON.

## Adding a certification profile

Edit [src/data/examProfiles.ts](src/data/examProfiles.ts) and append a new entry:

```ts
{ code: "PL-300", name: "Power BI Data Analyst", questionCount: 50, durationMinutes: 100 }
```

Time per session is `selectedQuestions × (durationMinutes × 60 / questionCount)`.

## Architecture

```
src/
  App.tsx                     three-stage shell (setup → exam → results)
  state/examStore.ts          zustand + persist (localStorage)
  types/question.ts           schema for every question + user answer + verdict
  data/examProfiles.ts        lookup table of MS exam profiles
  data/sampleQuestions.json   demo bank covering every question type
  parsers/
    index.ts                  file-extension dispatch
    jsonParser.ts             JSON.parse + validate
    markdownParser.ts         friendly MD format (single/multiple only)
    validate.ts               per-type structural checks; collects errors
  utils/
    grading.ts                "correct" | "partial" | "incorrect" | "skipped"
    helpers.ts                shuffle, format
  components/
    Timer.tsx                 ARIA-live countdown
    FeedbackPanel.tsx         verdict + explanation banner
    questions/                one component per question type + dispatcher
    screens/                  SetupScreen, ExamScreen, ResultsScreen
```

State machine: `setup` → `exam` (loops over `queue` until empty; wrong answers are spliced
back in a few positions later with `attempt + 1`, capped at 3 total attempts) → `results`.

## What couldn't be fully replicated (and why)

The real Microsoft exam runs in a locked-down Pearson VUE / OnVUE shell. A browser-based
clone can match the **mechanics** but a few things are intentionally simplified:

- **Hot area with true image hotspots.** Building a per-image hotspot editor is more work
  than is justified here; instead, hot-area questions render the optional image alongside a
  labeled list of regions and the user picks one. Authors can still provide an `imageUrl`.
  See [src/components/questions/HotArea.tsx](src/components/questions/HotArea.tsx).
- **PDF / DOCX upload.** The parser module dispatches by extension and returns a clear
  "not yet implemented" error for PDF/DOCX. Add a real implementation in
  [src/parsers](src/parsers) (e.g. `pdfjs-dist` for PDF, `mammoth` for DOCX) — the rest of
  the pipeline is format-agnostic.
- **No "review before submit" navigator.** The real exam lets you jump around within a
  section. To keep the per-question feedback flow honest (you must commit before seeing the
  answer), this app reveals after each submit and forces forward motion — wrong answers are
  spaced-rep re-queued instead.
- **No locked-down kiosk environment.** This is a web app — nothing here prevents you from
  opening a new tab. It's a study aid, not a proctored exam.
- **Yes/No series mechanics.** The spec says you "can't go back" within the series. This is
  enforced at the **series** level (you commit the whole series at once), not per statement,
  to keep the UX consistent with the rest of the app.

## License

MIT.
