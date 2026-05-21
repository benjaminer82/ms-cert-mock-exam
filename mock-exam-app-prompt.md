# Build a Mock Exam Web App for Microsoft Certification Practice

## Goal
Build a single-page web application that turns a document of sample questions into an interactive mock exam, modeled on the look, feel, and mechanics of the official Microsoft certification exam interface.

## Core Functional Requirements

### 1. Question Library Input
- Accept a document (PDF, DOCX, Markdown, or JSON) containing a question bank as input via file upload.
- Parse the document to extract: question text, question type, answer options, correct answer(s), and any provided explanation.
- Validate parsed output and surface parsing errors to the user before starting an exam.

### 2. Supported Question Types
Replicate the question types used in Microsoft certification exams:
- **Single-answer multiple choice** (radio buttons)
- **Multiple-answer multiple choice** (checkboxes, e.g. "Select two")
- **Drag-and-drop ordering / matching**
- **Drop-down list selections inside a sentence or code block**
- **Yes/No series** (each statement evaluated independently, no going back within the series)
- **Case study / scenario-based** questions with shared context across several sub-questions
- **Build list / sequence ordering** (arrange steps in correct order)
- **Hot area** (click a region of an image — fall back to labeled-option selection if image hotspots aren't feasible)

### 3. Exam Configuration
Before starting, let the user pick:
- Number of questions per session (e.g. 5, 10, 25, 50, or custom)
- The target Microsoft certification (e.g. AZ-104, AZ-305, SC-200, MS-700) — used to determine the time budget
- Time per session calculated proportionally: `selected_questions × (official_exam_duration / official_question_count)`. Store a lookup table of common MS exams (question count + duration) and allow it to be extended.

### 4. Exam Interaction
- Display a running countdown timer matching the calculated time budget. Auto-submit when time expires.
- Allow input via both **mouse click and keyboard shortcuts** (e.g. `1–9` to select options, `Space` to toggle multi-select, `Enter` to submit, `→` for next, `←` for previous where applicable, `Tab` for focus traversal).
- For type-in answers, accept free text with trimmed/case-insensitive matching where appropriate.
- Show progress (e.g. "Question 7 of 25") and remaining time at all times.

### 5. Per-Question Feedback Flow
After submitting each question:
- Reveal the correct answer(s) inline on the same page.
- Show a detailed explanation (use the one from the source document; if missing, mark as "No explanation provided").
- Indicate whether the user's answer was correct, partially correct, or incorrect.
- Require the user to click **Next** (or press `Enter`) to proceed — never auto-advance.

### 6. Spaced Reinforcement of Wrong Answers
- Any question answered incorrectly is **re-queued** later in the same session for retake.
- Cap retakes at **2 additional attempts per question** to avoid loops.
- Once a previously-wrong question is answered correctly, remove it from the retake queue.
- Track and surface this in the final report (e.g. "Mastered after 2 attempts").

### 7. Results Summary
At the end of the session, display:
- Overall score (raw and percentage)
- Time taken vs. time allowed
- Breakdown by question type and topic (if tags are present in source data)
- List of questions still missed after retakes, with their correct answers and explanations
- Option to export results as a PDF or JSON file

## Technical Guidance
- Frontend: React + TypeScript with Tailwind CSS (or equivalent — keep it dependency-light).
- State management: lightweight (React Context or Zustand). No backend required — run fully client-side.
- Persist exam progress and incorrect-question queue in `localStorage` so a refresh doesn't lose state.
- Parser modules should be pluggable per file format. Start with JSON and Markdown; add PDF/DOCX parsing as separate modules.
- Provide a sample `questions.json` schema and 5–10 example questions to demo each question type.

## Quality Bar
- Accessible: full keyboard navigation, ARIA labels, visible focus states, sufficient color contrast.
- Responsive: usable on laptop and tablet widths.
- Clean UI that mirrors the spare, focused layout of the real Microsoft exam interface.

## Deliverables
1. The full app source code with a README explaining setup, the question-file schema, and how to add new certification exam profiles.
2. A sample question bank demonstrating every supported question type.
3. A short note on any Microsoft exam mechanics you couldn't fully replicate and the chosen workaround.
