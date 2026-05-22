import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AzureOpenAISettings {
  endpoint: string; // e.g. https://my-aoai.openai.azure.com
  apiKey: string;
  deployment: string; // model deployment name
  apiVersion: string; // e.g. 2024-08-01-preview
  enabled: boolean;
}

interface SettingsState {
  aoai: AzureOpenAISettings;
  setAoai: (s: Partial<AzureOpenAISettings>) => void;
}

const DEFAULT_AOAI: AzureOpenAISettings = {
  endpoint: "",
  apiKey: "",
  deployment: "",
  apiVersion: "2024-08-01-preview",
  enabled: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      aoai: DEFAULT_AOAI,
      setAoai: (patch) => set({ aoai: { ...get().aoai, ...patch } }),
    }),
    { name: "ms-cert-mock-exam.settings.v1" },
  ),
);

export function isAoaiConfigured(s: AzureOpenAISettings): boolean {
  return (
    s.enabled &&
    s.endpoint.trim().length > 0 &&
    s.apiKey.trim().length > 0 &&
    s.deployment.trim().length > 0
  );
}
