import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type {
  FeedbackCandidate,
  FeedbackKind,
  FeedbackRecord,
  FeedbackVerdict,
} from "./persistence";
import type { CorpusSearchResult, SearchFilters } from "../types";

export const APP_VERSION = "0.16.0-rc.3";
export const FEEDBACK_EXPORT_FORMAT = "shabad-sojhi-feedback";

export interface FeedbackExport {
  format: typeof FEEDBACK_EXPORT_FORMAT;
  version: 1;
  exportedAt: string;
  appVersion: string;
  records: FeedbackRecord[];
}

export function feedbackCandidate(
  result: CorpusSearchResult,
): FeedbackCandidate | null {
  if (!result.textUnitId) return null;
  return {
    textUnitId: result.textUnitId,
    lineId: result.lineId,
    title: result.title,
    gurmukhi: result.gurmukhi,
    transliteration: result.transliteration,
    score: result.searchScore ?? null,
  };
}

export function newFeedbackRecord(input: {
  kind: FeedbackKind;
  verdict: FeedbackVerdict;
  query?: string;
  correctedQuery?: string;
  voiceAlternatives?: string[];
  audioSource?: FeedbackRecord["audioSource"];
  filters?: SearchFilters;
  candidates?: FeedbackCandidate[];
  selectedResult?: FeedbackCandidate | null;
  comment?: string;
}): FeedbackRecord {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    platform: Capacitor.getPlatform(),
    kind: input.kind,
    verdict: input.verdict,
    query: input.query?.trim() ?? "",
    correctedQuery: input.correctedQuery?.trim() ?? "",
    voiceAlternatives: [
      ...new Set(input.voiceAlternatives?.map((value) => value.trim()).filter(Boolean)),
    ],
    ...(input.audioSource ? { audioSource: input.audioSource } : {}),
    ...(input.filters ? { filters: input.filters } : {}),
    candidateResults: (input.candidates ?? []).slice(0, 10),
    selectedResult: input.selectedResult ?? null,
    comment: input.comment?.trim() ?? "",
  };
}

export function makeFeedbackExport(
  records: FeedbackRecord[],
): FeedbackExport {
  return {
    format: FEEDBACK_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    records,
  };
}

export function parseFeedbackExport(raw: string): FeedbackExport {
  const value = JSON.parse(raw) as Partial<FeedbackExport>;
  if (
    value.format !== FEEDBACK_EXPORT_FORMAT ||
    value.version !== 1 ||
    !Array.isArray(value.records) ||
    value.records.some(
      (record) =>
        record?.schemaVersion !== 1 ||
        typeof record.id !== "string" ||
        typeof record.kind !== "string",
    )
  )
    throw new Error("Not a Shabad Sojhi feedback export");
  return value as FeedbackExport;
}

export async function exportFeedback(
  records: FeedbackRecord[],
): Promise<void> {
  const data = JSON.stringify(makeFeedbackExport(records), null, 2);
  const name = `Shabad-Sojhi-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: name,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "Shabad Sojhi feedback",
      text: `${records.length} feedback ${records.length === 1 ? "record" : "records"}; no raw audio, reflections or bookmarks`,
      url: file.uri,
      dialogTitle: "Save or share feedback",
    });
    return;
  }
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
