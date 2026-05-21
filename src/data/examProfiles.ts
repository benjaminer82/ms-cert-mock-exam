// Lookup table of common Microsoft certification exams.
// Time per session is computed as: selectedCount * (durationMinutes / questionCount).
// Easy to extend — add a new entry here.

export interface CertProfile {
  code: string; // e.g. "AZ-104"
  name: string;
  questionCount: number; // official typical count
  durationMinutes: number; // official duration
}

export const CERT_PROFILES: CertProfile[] = [
  { code: "AZ-104", name: "Microsoft Azure Administrator", questionCount: 55, durationMinutes: 120 },
  { code: "AZ-305", name: "Azure Solutions Architect Expert", questionCount: 55, durationMinutes: 120 },
  { code: "AZ-204", name: "Developing Solutions for Microsoft Azure", questionCount: 55, durationMinutes: 120 },
  { code: "AZ-500", name: "Azure Security Engineer Associate", questionCount: 55, durationMinutes: 120 },
  { code: "AZ-900", name: "Microsoft Azure Fundamentals", questionCount: 45, durationMinutes: 65 },
  { code: "SC-200", name: "Security Operations Analyst", questionCount: 50, durationMinutes: 100 },
  { code: "SC-300", name: "Identity and Access Administrator", questionCount: 50, durationMinutes: 100 },
  { code: "SC-900", name: "Security, Compliance, and Identity Fundamentals", questionCount: 45, durationMinutes: 65 },
  { code: "MS-700", name: "Managing Microsoft Teams", questionCount: 50, durationMinutes: 120 },
  { code: "MS-900", name: "Microsoft 365 Fundamentals", questionCount: 45, durationMinutes: 65 },
  { code: "DP-100", name: "Designing and Implementing a Data Science Solution on Azure", questionCount: 55, durationMinutes: 120 },
  { code: "DP-203", name: "Data Engineering on Microsoft Azure", questionCount: 55, durationMinutes: 120 },
  { code: "DP-900", name: "Microsoft Azure Data Fundamentals", questionCount: 45, durationMinutes: 65 },
  { code: "AI-102", name: "Designing and Implementing an Azure AI Solution", questionCount: 55, durationMinutes: 120 },
  { code: "AI-900", name: "Microsoft Azure AI Fundamentals", questionCount: 45, durationMinutes: 65 },
];

export function getProfile(code: string): CertProfile | undefined {
  return CERT_PROFILES.find((p) => p.code === code);
}

export function computeSessionSeconds(profile: CertProfile, selectedQuestions: number): number {
  const perQuestionSec = (profile.durationMinutes * 60) / profile.questionCount;
  return Math.round(selectedQuestions * perQuestionSec);
}
