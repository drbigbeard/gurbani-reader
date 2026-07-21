import type { BrowseFilterState, SearchFilters } from "../types";

export interface RememberedFilter<T> {
  current: T;
  defaultValue: T;
}

export const defaultSearchFilters: SearchFilters = {
  sourceWorkIds: [],
  raags: [],
  contributorIds: [],
  resultTypes: [],
  tggspCoverages: [],
  sourceWorkId: "all",
  raag: "",
  contributorId: "",
  tggspOnly: false,
  tggspCoverage: "",
  providerContentTypes: [],
};

export const defaultBrowseFilters: BrowseFilterState = {
  baniCollections: [],
  baniAvailability: [],
  baniPersonal: [],
  baniSort: "name",
  contributorTypes: [],
  contributorSort: "name",
  raagGroups: [],
  raagSort: "scripture",
  wordLetters: [],
  wordSort: "count",
};

export function normalizeSearchFilters(
  input?: Partial<SearchFilters> | null,
): SearchFilters {
  const legacySource = input?.sourceWorkId;
  const legacyCoverage = input?.tggspCoverage;
  return {
    ...defaultSearchFilters,
    ...input,
    sourceWorkIds:
      input?.sourceWorkIds?.filter(Boolean) ??
      (legacySource && legacySource !== "all" ? [legacySource] : []),
    raags:
      input?.raags?.filter(Boolean) ?? (input?.raag ? [input.raag] : []),
    contributorIds:
      input?.contributorIds?.filter(Boolean) ??
      (input?.contributorId ? [input.contributorId] : []),
    resultTypes: input?.resultTypes?.filter(Boolean) ?? [],
    tggspCoverages:
      input?.tggspCoverages?.filter(Boolean) ??
      (legacyCoverage ? [legacyCoverage] : input?.tggspOnly ? ["any"] : []),
    providerContentTypes: input?.providerContentTypes?.filter(Boolean) ?? [],
  };
}

export function normalizeBrowseFilters(
  input?: Partial<BrowseFilterState> | null,
): BrowseFilterState {
  const legacyGroups = (input as Partial<BrowseFilterState> & { baniGroups?: string[] })
    ?.baniGroups ?? [];
  return {
    ...defaultBrowseFilters,
    ...input,
    baniCollections:
      input?.baniCollections?.filter(Boolean) ??
      legacyGroups.filter((value): value is "nitnem" | "vaaran" | "life" =>
        ["nitnem", "vaaran", "life"].includes(value),
      ),
    baniAvailability:
      input?.baniAvailability?.filter(Boolean) ??
      (legacyGroups.includes("tggsp") ? ["tggsp"] : []),
    baniPersonal:
      input?.baniPersonal?.filter(Boolean) ??
      (legacyGroups.includes("saved") || legacyGroups.includes("mine")
        ? ["saved"]
        : []),
    contributorTypes: input?.contributorTypes?.filter(Boolean) ?? [],
    raagGroups: input?.raagGroups?.filter(Boolean) ?? [],
    wordLetters: input?.wordLetters?.filter(Boolean) ?? [],
  };
}

export function selectedCount(value: object): number {
  return Object.values(value).reduce(
    (total, item) => total + (Array.isArray(item) ? item.length : 0),
    0,
  );
}
