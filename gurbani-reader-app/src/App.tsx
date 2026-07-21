import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Chrome } from "./components/Chrome";
import { DataFooter, EmptyMetric, PageHeading } from "./components/Common";
import { GurmukhiKeyboard } from "./components/GurmukhiKeyboard";
import { FilterButton, FilterSheet } from "./components/FilterSheet";
import { Icon } from "./components/Icon";
import { ProviderLayers } from "./components/ProviderLayers";
import { SearchBar } from "./components/SearchBar";
import { TextControls } from "./components/TextControls";
import { exportBackup, parseBackup } from "./lib/backup";
import {
  defaultBrowseFilters,
  defaultSearchFilters,
  normalizeBrowseFilters,
  normalizeSearchFilters,
} from "./lib/filters";
import { corpusGateway } from "./lib/gateway";
import { useNavigation } from "./lib/navigation";
import {
  defaultPersonalData,
  defaultPreferences,
  toggleValue,
  usePersistentState,
} from "./lib/persistence";
import type {
  HomeModule,
  PersonalData,
  ReaderPreferences,
  SavedSearch,
  SearchHistoryEntry,
} from "./lib/persistence";
import { scoreSearchCandidate } from "./lib/search-core";
import { listenForSearch, voiceSearchAvailable } from "./lib/voice-search";
import type {
  BaniSection,
  BaniSummary,
  BaniView,
  BrowseFilterState,
  CanonicalLine,
  ConcordancePage,
  ContributorSummary,
  CorpusInfo,
  CorpusSearchResponse,
  GlossaryResult,
  GroupedFrequency,
  ProviderCoverage,
  RaagContributorSummary,
  RaagSummary,
  RankedForm,
  RelatedForm,
  SearchFilters,
  SearchMode,
  ShabadView,
  SourceWorkOption,
  TextUnitSummary,
  TggspCollectionSummary,
  WordStats,
} from "./types";

const emptySearch: CorpusSearchResponse = {
  query: "",
  mode: "latin",
  results: [],
  candidateForms: [],
};
const emptyConcordance: ConcordancePage = {
  total: 0,
  offset: 0,
  limit: 50,
  matches: [],
};
type BrowseTab = "banis" | "contributors" | "raags" | "words";

export default function App() {
  const { screen, navigate, back, exitHint } = useNavigation();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("auto");
  const [search, setSearch] = useState<CorpusSearchResponse>(emptySearch);
  const [sources, setSources] = useState<SourceWorkOption[]>([]);
  const [sourceWorkId, setSourceWorkId] = useState("source:G");
  const [info, setInfo] = useState<CorpusInfo | null>(null);
  const [ang, setAng] = useState(1);
  const [angLines, setAngLines] = useState<CanonicalLine[]>([]);
  const [sabad, setSabad] = useState<ShabadView | null>(null);
  const [rankings, setRankings] = useState<RankedForm[]>([]);
  const [rankingTotal, setRankingTotal] = useState(0);
  const [contributors, setContributors] = useState<ContributorSummary[]>([]);
  const [searchContributors, setSearchContributors] = useState<
    ContributorSummary[]
  >([]);
  const [searchRaags, setSearchRaags] = useState<RaagSummary[]>([]);
  const [selectedContributor, setSelectedContributor] =
    useState<ContributorSummary | null>(null);
  const [contributorUnits, setContributorUnits] = useState<TextUnitSummary[]>(
    [],
  );
  const [raags, setRaags] = useState<RaagSummary[]>([]);
  const [selectedRaag, setSelectedRaag] = useState<RaagSummary | null>(null);
  const [raagContributors, setRaagContributors] = useState<
    RaagContributorSummary[]
  >([]);
  const [raagContributor, setRaagContributor] = useState<string[]>([]);
  const [raagUnits, setRaagUnits] = useState<TextUnitSummary[]>([]);
  const [banis, setBanis] = useState<BaniSummary[]>([]);
  const [bani, setBani] = useState<BaniView | null>(null);
  const [tggspCollections, setTggspCollections] = useState<
    TggspCollectionSummary[]
  >([]);
  const [searchBanis, setSearchBanis] = useState<BaniSummary[]>([]);
  const [browseTab, setBrowseTab] = useState<BrowseTab>("banis");
  const [browseFilter, setBrowseFilter] = useState("");
  const [selectedWord, setSelectedWord] = useState("ਹਰਿ");
  const [wordStats, setWordStats] = useState<WordStats | null>(null);
  const [wordFilters, setWordFilters] = useState<SearchFilters>({
    ...defaultSearchFilters,
    sourceWorkIds: ["source:G"],
    sourceWorkId: "source:G",
  });
  const [concordance, setConcordance] =
    useState<ConcordancePage>(emptyConcordance);
  const [relatedForms, setRelatedForms] = useState<RelatedForm[]>([]);
  const [grouped, setGrouped] = useState<GroupedFrequency | null>(null);
  const [glossary, setGlossary] = useState<GlossaryResult[]>([]);
  const [coverage, setCoverage] = useState<ProviderCoverage | null>(null);
  const [activeLine, setActiveLine] = useState<CanonicalLine | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedLines, setSavedLines] = useState<CanonicalLine[]>([]);
  const [historyUnits, setHistoryUnits] = useState<TextUnitSummary[]>([]);
  const [matchedLineId, setMatchedLineId] = useState<string | null>(null);
  const [preferences, setPreferences] = usePersistentState(
    "gurbani:preferences:v3",
    defaultPreferences,
  );
  const [personal, setPersonal] = usePersistentState(
    "gurbani:personal:v1",
    defaultPersonalData,
  );
  const activeFilterViews = preferences.filterViews ?? defaultPreferences.filterViews;
  const searchFilterMemory = activeFilterViews.search ?? defaultPreferences.filterViews.search;
  const searchFilters = normalizeSearchFilters(searchFilterMemory.current);
  const browseFilterMemory = activeFilterViews.browse ?? defaultPreferences.filterViews.browse;
  const browseViewFilters = normalizeBrowseFilters(browseFilterMemory.current);
  const setSearchFilters = (next: SearchFilters) =>
    setPreferences((current) => ({
      ...current,
      filterViews: {
        ...(current.filterViews ?? defaultPreferences.filterViews),
        search: {
          ...((current.filterViews ?? defaultPreferences.filterViews).search ?? defaultPreferences.filterViews.search),
          current: normalizeSearchFilters(next),
        },
      },
    }));
  const setBrowseViewFilters = (next: BrowseFilterState) =>
    setPreferences((current) => ({
      ...current,
      filterViews: {
        ...(current.filterViews ?? defaultPreferences.filterViews),
        browse: {
          ...((current.filterViews ?? defaultPreferences.filterViews).browse ?? defaultPreferences.filterViews.browse),
          current: normalizeBrowseFilters(next),
        },
      },
    }));
  const currentSource = sources.find((source) => source.id === sourceWorkId);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.accent = preferences.accent;
    document.documentElement.style.setProperty(
      "--bg",
      preferences.backgroundColor,
    );
  }, [preferences.accent, preferences.backgroundColor, preferences.theme]);
  useEffect(() => {
    void loadSource("source:G", true);
  }, []);
  useEffect(() => {
    const close = () => setActiveLine(null);
    window.addEventListener("gurbani:close-overlay", close);
    return () => window.removeEventListener("gurbani:close-overlay", close);
  }, []);
  useEffect(() => {
    if (screen !== "saved") return;
    const lineIds = [
      ...new Set([
        ...personal.bookmarks,
        ...Object.keys(personal.notes),
        ...personal.collections.flatMap((collection) => collection.lineIds),
      ]),
    ];
    const unitIds = [
      ...new Set(personal.history.map((item) => item.textUnitId)),
    ];
    void Promise.all([
      corpusGateway.linesByIds(lineIds),
      corpusGateway.textUnitsByIds(unitIds),
    ]).then(([lines, units]) => {
      setSavedLines(lines);
      setHistoryUnits(units);
    });
  }, [personal, screen]);

  async function loadSource(source: string, first = false) {
    setBusy(true);
    setError(null);
    try {
      const resumeAng = personal.lastAngBySource?.[source] ?? 1;
      const [
        sourceInfo,
        sourceRows,
        lines,
        formPage,
        people,
        raagRows,
        baniRows,
        providerCoverage,
        allPeople,
        allRaagRows,
        allBaniRows,
        tggspRows,
      ] = await Promise.all([
        corpusGateway.corpusInfo(),
        corpusGateway.sources(),
        corpusGateway.getLines(resumeAng, source),
        corpusGateway.rankedFormsPage(
          source,
          browseViewFilters.wordLetters,
          100,
          0,
          browseViewFilters.wordSort,
        ),
        corpusGateway.contributorSummaries(1000, source),
        corpusGateway.raagSummaries(source),
        corpusGateway.namedBanis(source),
        corpusGateway.providerCoverage(),
        corpusGateway.contributorSummaries(1000, "all"),
        corpusGateway.raagSummaries("all"),
        corpusGateway.namedBanis("all"),
        corpusGateway.tggspCollections(),
      ]);
      setInfo(sourceInfo);
      setSources(sourceRows);
      setSourceWorkId(source);
      setAng(resumeAng);
      setAngLines(lines);
      setRankings(formPage.forms);
      setRankingTotal(formPage.total);
      setContributors(people);
      setRaags(raagRows);
      setBanis(baniRows);
      setTggspCollections(tggspRows);
      setCoverage(providerCoverage);
      setSearchContributors(allPeople);
      setSearchRaags(allRaagRows);
      setSearchBanis(allBaniRows);
      setSearch(emptySearch);
      if (!first) navigate("home");
    } catch {
      setError(
        "The installed reading data could not be opened. Remove the previous app build, then reinstall this one.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadAng(value: number) {
    const next = Math.max(1, Math.min(currentSource?.maxAng ?? 1430, value));
    setBusy(true);
    try {
      setAng(next);
      setAngLines(await corpusGateway.getLines(next, sourceWorkId));
      setPersonal((p) => ({
        ...p,
        lastAngBySource: { ...p.lastAngBySource, [sourceWorkId]: next },
      }));
      navigate("read");
    } catch {
      setError("That Ang could not be opened.");
    } finally {
      setBusy(false);
    }
  }
  async function openSabad(id: string, lineId: string | null = null) {
    setBusy(true);
    try {
      const value = await corpusGateway.getTextUnit(id);
      setSabad(value);
      setMatchedLineId(lineId);
      setPersonal((p) => ({
        ...p,
        readingPosition: value.id,
        history: [
          { textUnitId: value.id, lineId, visitedAt: new Date().toISOString() },
          ...p.history.filter((item) => item.textUnitId !== value.id),
        ].slice(0, 100),
      }));
      navigate("sabad");
    } catch {
      setError("The complete Shabad could not be opened.");
    } finally {
      setBusy(false);
    }
  }
  async function openBani(row: BaniSummary) {
    setBusy(true);
    try {
      const value = await corpusGateway.getBani(row.id);
      setBani(value);
      setPersonal((p) => ({ ...p, readingPosition: `bani|${row.id}` }));
      navigate("bani");
    } catch {
      setError("This Bani could not be opened.");
    } finally {
      setBusy(false);
    }
  }
  async function openTggspCollection(row: TggspCollectionSummary) {
    setBusy(true);
    try {
      const value = await corpusGateway.getTggspCollection(row.code);
      setBani(value);
      setPersonal((p) => ({ ...p, readingPosition: `tggsp|${row.code}` }));
      navigate("bani");
    } catch {
      setError("This TGGSP reading could not be opened.");
    } finally {
      setBusy(false);
    }
  }
  async function openContributor(row: ContributorSummary) {
    const source = contributorSource(row.id, sourceWorkId);
    setBusy(true);
    setSelectedContributor(row);
    try {
      setContributorUnits(
        await corpusGateway.contributorUnits(row.id, source, 50, 0),
      );
      navigate("contributor");
    } catch {
      setError("This contributor’s Shabads could not be opened.");
    } finally {
      setBusy(false);
    }
  }
  async function moreContributor() {
    if (!selectedContributor) return;
    const source = contributorSource(selectedContributor.id, sourceWorkId);
    const rows = await corpusGateway.contributorUnits(
      selectedContributor.id,
      source,
      50,
      contributorUnits.length,
    );
    setContributorUnits((v) => [...v, ...rows]);
  }
  async function openRaag(row: RaagSummary) {
    setBusy(true);
    setSelectedRaag(row);
    const rememberedContributors = storedStringList(`shabad-sojhi:raag-filter-current:${row.id}`);
    setRaagContributor(rememberedContributors);
    try {
      const [people, units] = await Promise.all([
        corpusGateway.raagContributorSummaries(row.name, sourceWorkId),
        corpusGateway.raagUnits(row.name, sourceWorkId, 50, 0, rememberedContributors),
      ]);
      setRaagContributors(people);
      setRaagUnits(units);
      navigate("raag");
    } catch {
      setError("This Raag could not be opened.");
    } finally {
      setBusy(false);
    }
  }
  async function filterRaag(contributorIds: string[]) {
    if (!selectedRaag) return;
    setRaagContributor(contributorIds);
    setRaagUnits(
      await corpusGateway.raagUnits(
        selectedRaag.name,
        sourceWorkId,
        50,
        0,
        contributorIds,
      ),
    );
  }
  async function moreRaag() {
    if (!selectedRaag) return;
    const rows = await corpusGateway.raagUnits(
      selectedRaag.name,
      sourceWorkId,
      50,
      raagUnits.length,
      raagContributor,
    );
    setRaagUnits((v) => [...v, ...rows]);
  }
  async function runSearch() {
    const term = query.trim();
    setBusy(true);
    try {
      setSearch(
        await corpusGateway.searchCorpus(term, searchFilters, 100, searchMode),
      );
      if (term)
        setPersonal((p) => ({
          ...p,
          searchHistory: [
            {
              id: crypto.randomUUID(),
              query: term,
              filters: searchFilters,
              mode: searchMode,
              searchedAt: new Date().toISOString(),
            },
            ...p.searchHistory.filter((row) => fold(row.query) !== fold(term)),
          ].slice(0, 100),
        }));
      navigate("search");
    } catch {
      setSearch(emptySearch);
      setError("Search could not query the installed data.");
      navigate("search");
    } finally {
      setBusy(false);
    }
  }
  async function runVoiceSearch(terms: string[]) {
    const alternatives = [
      ...new Set(terms.map((value) => value.trim()).filter(Boolean)),
    ];
    if (!alternatives.length) return;
    const primary = alternatives[0];
    setQuery(primary);
    setBusy(true);
    try {
      const responses = [];
      for (const term of alternatives)
        responses.push(
          await corpusGateway.searchCorpus(
            term,
            searchFilters,
            100,
            searchMode,
          ),
        );
      const seen = new Set<string>();
      const results = responses
        .flatMap((response) => response.results)
        .sort(
          (left, right) => (right.searchScore ?? 0) - (left.searchScore ?? 0),
        )
        .filter((row) => {
          const key = `${row.resultType}|${row.textUnitId}|${row.lineId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 100);
      setSearch({
        query: primary,
        mode: responses[0]?.mode ?? "latin",
        results,
        candidateForms: responses
          .flatMap((response) => response.candidateForms)
          .slice(0, 12),
      });
      setPersonal((p) => ({
        ...p,
        searchHistory: [
          {
            id: crypto.randomUUID(),
            query: primary,
            filters: searchFilters,
            mode: searchMode,
            searchedAt: new Date().toISOString(),
          },
          ...p.searchHistory.filter((row) => fold(row.query) !== fold(primary)),
        ].slice(0, 100),
      }));
      navigate("search");
    } catch {
      setSearch(emptySearch);
      setError("The recognised alternatives could not be searched.");
      navigate("search");
    } finally {
      setBusy(false);
    }
  }
  async function restoreSearch(row: SavedSearch) {
    const filters = normalizeSearchFilters(row.filters);
    const mode = row.mode === "theme" ? "theme" : "auto";
    setQuery(row.query);
    setSearchFilters(filters);
    setSearchMode(mode);
    setBusy(true);
    try {
      setSearch(
        await corpusGateway.searchCorpus(row.query, filters, 100, mode),
      );
      navigate("search");
    } finally {
      setBusy(false);
    }
  }
  async function restoreHistory(row: SearchHistoryEntry) {
    await restoreSearch({
      id: row.id,
      title: row.query,
      query: row.query,
      filters: row.filters,
      mode: row.mode,
    });
  }
  async function openWord(raw: string, filters?: SearchFilters) {
    const word = cleanWord(raw);
    if (!word) return;
    const scope = normalizeSearchFilters(
      filters ?? {
        ...defaultSearchFilters,
        sourceWorkIds: [sourceWorkId],
        sourceWorkId,
      },
    );
    setBusy(true);
    setSelectedWord(word);
    setWordFilters(scope);
    try {
      const [stats, page, related] = await Promise.all([
        corpusGateway.exactWordStats(word, scope),
        corpusGateway.concordance(word, scope, 50, 0),
        corpusGateway.relatedForms(
          word,
          scope.sourceWorkIds.length === 1 ? scope.sourceWorkIds[0] : sourceWorkId,
          30,
        ),
      ]);
      setWordStats(stats);
      setConcordance(page);
      setRelatedForms(related);
      setGrouped(null);
      navigate("word");
    } catch {
      setError("No exact count has been inferred or substituted.");
    } finally {
      setBusy(false);
    }
  }
  async function moreConcordance() {
    const page = await corpusGateway.concordance(
      selectedWord,
      wordFilters,
      50,
      concordance.matches.length,
    );
    setConcordance((v) => ({
      ...page,
      offset: 0,
      matches: [...v.matches, ...page.matches],
    }));
  }
  async function openGlossary(word: string) {
    const term = word.trim().normalize("NFC");
    setSelectedWord(term);
    setGlossary(term ? await corpusGateway.glossary(term, 60) : []);
    navigate("glossary");
  }
  function showBrowse(tab: BrowseTab) {
    setBrowseTab(tab);
    setBrowseFilter("");
    navigate("browse");
  }
  function continueReading() {
    const position = personal.readingPosition;
    if (position?.startsWith("bani|")) {
      const id = position.slice(5);
      const row = searchBanis.find((item) => item.id === id);
      if (row) void openBani(row);
      else
        void corpusGateway.getBani(id).then((value) => {
          setBani(value);
          navigate("bani");
        });
      return;
    }
    if (position?.startsWith("tggsp|")) {
      const code = position.slice(6);
      const row = tggspCollections.find((item) => item.code === code);
      if (row) void openTggspCollection(row);
      return;
    }
    if (position) void openSabad(position);
    else void loadAng(ang);
  }
  async function loadRankings(
    letters: string[],
    sort: "count" | "name",
    reset = true,
  ) {
    const offset = reset ? 0 : rankings.length;
    const page = await corpusGateway.rankedFormsPage(
      sourceWorkId,
      letters,
      100,
      offset,
      sort,
    );
    setRankingTotal(page.total);
    setRankings((current) =>
      reset ? page.forms : [...current, ...page.forms],
    );
  }
  async function importFile(file: File) {
    try {
      const backup = parseBackup(await file.text());
      setPersonal({ ...defaultPersonalData, ...backup.personal });
      setPreferences({
        ...defaultPreferences,
        ...backup.preferences,
        providerLayerVisibility: {
          ...defaultPreferences.providerLayerVisibility,
          ...backup.preferences.providerLayerVisibility,
        },
      });
      setMessage("Backup imported.");
    } catch {
      setError("That file is not a valid Shabad Sojhi backup.");
    }
  }

  const common = {
    preferences,
    setPreferences,
    personal,
    setPersonal,
    openSabad,
    openWord,
    setActiveLine,
    matchedLineId,
  };
  const readerColours = accessibleReaderColours(preferences);
  const toggleSavedBani = (id: string) => {
    const saving = !personal.myBaniIds.includes(id);
    setPersonal((current) => ({
      ...current,
      myBaniIds: toggleValue(current.myBaniIds, id),
    }));
    setMessage(saving ? "Saved to Library." : "Removed from Saved Banis.");
  };
  return (
    <Chrome active={screen} onNavigate={navigate} onBack={back}>
      <div
        className="screen"
        style={
          {
            "--gurmukhi-color": readerColours.gurmukhi,
            "--latin-color": readerColours.latin,
          } as CSSProperties
        }
      >
        {!preferences.onboardingComplete && (
          <Onboarding
            complete={() =>
              setPreferences((p) => ({ ...p, onboardingComplete: true }))
            }
            openSources={() => navigate("sources")}
            start={(goal) => {
              setPreferences((p) => ({
                ...p,
                onboardingComplete: true,
                readerMode: goal === "study" ? "study" : p.readerMode,
              }));
              if (goal === "search") navigate("search");
              else showBrowse("banis");
            }}
          />
        )}
        {busy && <div className="busy">Opening…</div>}
        {exitHint && <div className="exit-hint">You’re already at Home</div>}
        {message && (
          <div className="success" role="status">
            {message}
            <button onClick={() => setMessage(null)}>Dismiss</button>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        {screen === "home" && (
          <Home
            info={info}
            query={query}
            setQuery={setQuery}
            runSearch={runSearch}
            runVoice={runVoiceSearch}
            notify={setMessage}
            fail={setError}
            loadAng={loadAng}
            showBrowse={showBrowse}
            continueReading={continueReading}
            resumeTitle={resumeTitle(
              personal.readingPosition,
              sabad,
              searchBanis,
              tggspCollections,
              ang,
            )}
            openDictionary={() => void openGlossary("")}
            openBani={openBani}
            openSabad={openSabad}
            openSources={() => navigate("sources")}
            preferences={preferences}
            setPreferences={setPreferences}
            currentAng={ang}
            maxAng={currentSource?.maxAng ?? 1430}
            banis={searchBanis}
          />
        )}
        {screen === "read" && (
          <AngReader
            ang={ang}
            maxAng={currentSource?.maxAng ?? 1430}
            lines={angLines}
            loadAng={loadAng}
            {...common}
          />
        )}
        {screen === "sabad" && sabad && (
          <SabadReader sabad={sabad} {...common} />
        )}
        {screen === "bani" && bani && <BaniReader bani={bani} {...common} />}
        {screen === "browse" && (
          <>
            <SourcePicker
              sources={sources}
              value={sourceWorkId}
              onChange={(value) => void loadSource(value)}
            />
            <Browse
              tab={browseTab}
              setTab={setBrowseTab}
              filter={browseFilter}
              setFilter={setBrowseFilter}
              banis={searchBanis}
              tggspCollections={tggspCollections}
              contributors={contributors}
              raags={raags}
              rankings={rankings}
              rankingTotal={rankingTotal}
              filters={browseViewFilters}
              filterDefault={normalizeBrowseFilters(browseFilterMemory.defaultValue)}
              setFilters={setBrowseViewFilters}
              setFilterDefault={(next) =>
                setPreferences((current) => ({
                  ...current,
                  filterViews: {
                    ...(current.filterViews ?? defaultPreferences.filterViews),
                    browse: {
                      current: (current.filterViews ?? defaultPreferences.filterViews).browse.current,
                      defaultValue: next,
                    },
                  },
                }))
              }
              loadRankings={loadRankings}
              openBani={openBani}
              openTggspCollection={openTggspCollection}
              openContributor={openContributor}
              openRaag={openRaag}
              openWord={openWord}
              currentAng={ang}
              maxAng={currentSource?.maxAng ?? 1430}
              loadAng={loadAng}
              myBaniIds={personal.myBaniIds}
              toggleMyBani={toggleSavedBani}
            />
          </>
        )}
        {screen === "contributor" && selectedContributor && (
          <Units
            heading={selectedContributor.name}
            summary={`${selectedContributor.unitCount.toLocaleString()} Shabad units`}
            units={contributorUnits}
            openSabad={openSabad}
            more={moreContributor}
            hasMore={contributorUnits.length < selectedContributor.unitCount}
          />
        )}
        {screen === "raag" && selectedRaag && (
          <RaagView
            raag={selectedRaag}
            people={raagContributors}
            selected={raagContributor}
            filter={filterRaag}
            units={raagUnits}
            openSabad={openSabad}
            more={moreRaag}
          />
        )}
        {screen === "search" && (
          <SearchView
            query={query}
            setQuery={setQuery}
            mode={searchMode}
            setMode={setSearchMode}
            filters={searchFilters}
            setFilters={setSearchFilters}
            filterDefault={normalizeSearchFilters(searchFilterMemory.defaultValue)}
            setFilterDefault={(next) =>
              setPreferences((current) => ({
                ...current,
                filterViews: {
                  ...(current.filterViews ?? defaultPreferences.filterViews),
                  search: {
                    current: (current.filterViews ?? defaultPreferences.filterViews).search.current,
                    defaultValue: next,
                  },
                },
              }))
            }
            sources={sources}
            run={runSearch}
            runVoice={runVoiceSearch}
            response={search}
            banis={searchBanis}
            contributors={searchContributors}
            raags={searchRaags}
            history={personal.searchHistory}
            restoreHistory={restoreHistory}
            openBani={openBani}
            openContributor={openContributor}
            openRaag={openRaag}
            openSabad={openSabad}
            openWord={openWord}
            openDictionary={openGlossary}
            notify={setMessage}
            fail={setError}
            saveSearch={() =>
              setPersonal((p) => ({
                ...p,
                savedSearches: [
                  {
                    id: crypto.randomUUID(),
                    title: query || "TGGSP availability",
                    query,
                    filters: searchFilters,
                    mode: searchMode,
                  },
                  ...p.savedSearches,
                ].slice(0, 30),
              }))
            }
            showExperimental={preferences.showExperimentalFeatures}
            personal={personal}
            setPersonal={setPersonal}
          />
        )}
        {screen === "word" && (
          <WordView
            word={selectedWord}
            filters={wordFilters}
            sources={sources}
            contributors={searchContributors}
            stats={wordStats}
            concordance={concordance}
            related={relatedForms}
            grouped={grouped}
            saved={personal.savedTerms.includes(selectedWord)}
            toggleSaved={() =>
              setPersonal((p) => ({
                ...p,
                savedTerms: toggleValue(p.savedTerms, selectedWord),
              }))
            }
            group={(forms) =>
              void corpusGateway
                .groupedFrequency(forms, wordFilters)
                .then(setGrouped)
            }
            more={moreConcordance}
            openSabad={openSabad}
            openGlossary={openGlossary}
          />
        )}
        {screen === "glossary" && (
          <GlossaryView
            word={selectedWord}
            results={glossary}
            search={openGlossary}
            openWord={openWord}
          />
        )}
        {screen === "saved" && (
          <Saved
            personal={personal}
            setPersonal={setPersonal}
            savedLines={savedLines}
            historyUnits={historyUnits}
            banis={searchBanis}
            openBani={openBani}
            openSabad={openSabad}
            restoreHistory={restoreHistory}
          />
        )}
        {screen === "settings" && (
          <Settings
            personal={personal}
            preferences={preferences}
            setPreferences={setPreferences}
            openWord={openWord}
            restoreSearch={restoreSearch}
            openSources={() => navigate("sources")}
            openHelp={() => navigate("help")}
            exportData={() =>
              exportBackup(personal, preferences)
                .then(() => setMessage("Backup ready to save or share."))
                .catch(() => setError("The backup could not be exported."))
            }
            importData={importFile}
          />
        )}
        {screen === "sources" && <SourcesGuide close={() => back()} />}
        {screen === "help" && (
          <HelpGuide
            openSources={() => navigate("sources")}
            replay={() =>
              setPreferences((current) => ({
                ...current,
                onboardingComplete: false,
              }))
            }
          />
        )}
        {screen === "tggsp" && (
          <section>
            <PageHeading
              eyebrow="Data details"
              title="The Guru Granth Sahib Project"
            >
              Only reviewed mappings are attached to a Shabad. Unresolved
              material remains separate.
            </PageHeading>
            <div className="metrics">
              <EmptyMetric
                label="Analysis sections"
                value={coverage?.totalLayers ?? null}
              />
              <EmptyMetric
                label="Mapped sections"
                value={coverage?.mappedLayers ?? null}
              />
              <EmptyMetric
                label="Mapped Shabads"
                value={coverage?.mappedTextUnits ?? null}
              />
            </div>
          </section>
        )}
        {activeLine && (
          <LineSheet
            line={activeLine}
            personal={personal}
            setPersonal={setPersonal}
            close={() => setActiveLine(null)}
            openSabad={openSabad}
            openWord={openWord}
            notify={setMessage}
          />
        )}
      </div>
    </Chrome>
  );
}

type CommonReader = {
  preferences: ReaderPreferences;
  setPreferences: (
    next: ReaderPreferences | ((p: ReaderPreferences) => ReaderPreferences),
  ) => void;
  personal: PersonalData;
  setPersonal: (
    next: PersonalData | ((p: PersonalData) => PersonalData),
  ) => void;
  openSabad: (id: string, lineId?: string | null) => Promise<void>;
  openWord: (word: string, filters?: SearchFilters) => Promise<void>;
  setActiveLine: (line: CanonicalLine | null) => void;
  matchedLineId: string | null;
};

function Home({
  info,
  query,
  setQuery,
  runSearch,
  runVoice,
  notify,
  fail,
  loadAng,
  showBrowse,
  continueReading,
  resumeTitle,
  openDictionary,
  openBani,
  openSabad,
  openSources,
  preferences,
  setPreferences,
  currentAng,
  maxAng,
  banis,
}: {
  info: CorpusInfo | null;
  query: string;
  setQuery: (v: string) => void;
  runSearch: () => Promise<void>;
  runVoice: (terms: string[]) => Promise<void>;
  notify: (v: string) => void;
  fail: (v: string) => void;
  loadAng: (n: number) => Promise<void>;
  showBrowse: (tab: BrowseTab) => void;
  continueReading: () => void;
  resumeTitle: string;
  openDictionary: () => void;
  openBani: (v: BaniSummary) => Promise<void>;
  openSabad: (id: string, lineId?: string | null) => Promise<void>;
  openSources: () => void;
  preferences: ReaderPreferences;
  setPreferences: CommonReader["setPreferences"];
  currentAng: number;
  maxAng: number;
  banis: BaniSummary[];
}) {
  const [ang, setAng] = useState(String(currentAng));
  const [preview, setPreview] = useState<CorpusSearchResponse>(emptySearch);
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setPreview(emptySearch);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void corpusGateway
        .searchCorpus(term, defaultSearchFilters, 6, "auto")
        .then((value) => {
          if (active) setPreview(value);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);
  const order = (
    preferences.homeOrder?.length
      ? preferences.homeOrder
      : defaultPreferences.homeOrder
  ).filter((item) => !preferences.hiddenHomeModules?.includes(item));
  const q = fold(query);
  const baniSuggestions = q
    ? banis
        .filter(
          (row) =>
            fold(baniSearchText(row)).includes(q) ||
            scoreSearchCandidate(query, row.gurmukhi, baniSearchText(row))
              .score >= 700,
        )
        .slice(0, 3)
    : [];
  const modules: Record<HomeModule, ReactNode> = {
    search: (
      <section className="home-module" key="search">
        <h2>Search Gurbani</h2>
        <SearchBar
          value={query}
          onChange={setQuery}
          onSubmit={runSearch}
          onVoice={runVoice}
          notify={notify}
          fail={fail}
        />
        {(baniSuggestions.length > 0 || preview.results.length > 0) && (
          <div className="live-preview" role="listbox">
            <small>Suggestions</small>
            {baniSuggestions.map((row) => (
              <button key={row.id} onClick={() => void openBani(row)}>
                <span className="suggestion-type">Bani</span>
                <b>{baniDisplayName(row)}</b>
              </button>
            ))}
            {preview.results.slice(0, 4).map((row) => (
              <button
                key={row.id}
                onClick={() =>
                  row.textUnitId && void openSabad(row.textUnitId, row.lineId)
                }
              >
                <span className="gurmukhi">{row.gurmukhi}</span>
                <span>{row.subtitle}</span>
              </button>
            ))}
            <button onClick={() => void runSearch()}>See all matches →</button>
          </div>
        )}
      </section>
    ),
    banis: (
      <button
        className="home-feature"
        key="banis"
        onClick={() => showBrowse("banis")}
      >
        <b>All Banis</b>
        <span>Nitnem, Saved Banis, Vaars and life-event readings</span>
      </button>
    ),
    ang: (
      <form
        className="ang-jump home-module"
        key="ang"
        onSubmit={(e) => {
          e.preventDefault();
          void loadAng(Number(ang));
        }}
      >
        <label>
          Go directly to Ang{" "}
          <span className="number-with-limit">
            <input
              inputMode="numeric"
              aria-label={`Ang number out of ${maxAng}`}
              value={ang}
              onChange={(e) => setAng(e.target.value)}
            />
            <small>/{maxAng}</small>
          </span>
        </label>
        <button>Open</button>
      </form>
    ),
    dictionary: (
      <button
        className="home-feature"
        key="dictionary"
        onClick={openDictionary}
      >
        <b>Dictionary</b>
        <span>Gurmukhi, Roman and experimental English concepts</span>
      </button>
    ),
    recent: (
      <button className="recent-card" key="recent" onClick={continueReading}>
        <span>Continue reading</span>
        <b>{resumeTitle} →</b>
      </button>
    ),
    explore: (
      <div className="quick-grid" key="explore">
        <button onClick={() => showBrowse("contributors")}>
          <b>Contributors</b>
          <span>All contributors and their Shabads</span>
        </button>
        <button onClick={() => showBrowse("raags")}>
          <b>Raags</b>
          <span>Counts and contributor filters</span>
        </button>
        <button onClick={() => showBrowse("words")}>
          <b>Word frequency</b>
          <span>Complete ranked index</span>
        </button>
      </div>
    ),
  };
  const move = (item: HomeModule, delta: number) =>
    setPreferences((p) => {
      const next = [...p.homeOrder];
      const at = next.indexOf(item),
        to = Math.max(0, Math.min(next.length - 1, at + delta));
      next.splice(at, 1);
      next.splice(to, 0, item);
      return { ...p, homeOrder: next };
    });
  const firstReaderIndex = Math.min(
    ...["ang", "recent"]
      .map((item) => order.indexOf(item as HomeModule))
      .filter((index) => index >= 0),
  );
  return (
    <section>
      <PageHeading
        eyebrow="Personal reading & understanding"
        title="Shabad Sojhi"
      >
        Read continuously, find exact forms, and explore by Bani, contributor or
        Raag.
      </PageHeading>
      <CoachTip
        id="home-search"
        preferences={preferences}
        setPreferences={setPreferences}
        title="Find Gurbani from the words you remember"
      >
        Tap <Icon name="mic" /> to speak, or <span className="gurmukhi">ਕ</span> for the built-in Gurmukhi keyboard. Roman spelling is supported too.
      </CoachTip>
      {order.map((item, index) =>
        item === "ang" || item === "recent" ? (
          index === firstReaderIndex ? (
            <div className="home-reader-row" key="reading-shortcuts">
              {order.includes("ang") && modules.ang}
              {order.includes("recent") && modules.recent}
            </div>
          ) : null
        ) : (
          modules[item]
        ),
      )}
      <details className="home-customise">
        <summary>Customise Home</summary>
        {preferences.homeOrder.map((item) => (
          <div key={item}>
            <label>
              <input
                type="checkbox"
                checked={!preferences.hiddenHomeModules.includes(item)}
                onChange={() =>
                  setPreferences((p) => ({
                    ...p,
                    hiddenHomeModules: p.hiddenHomeModules.includes(item)
                      ? p.hiddenHomeModules.filter((x) => x !== item)
                      : [...p.hiddenHomeModules, item],
                  }))
                }
              />
              {homeModuleLabel(item)}
            </label>
            <button
              aria-label={`Move ${item} up`}
              onClick={() => move(item, -1)}
            >
              ↑
            </button>
            <button
              aria-label={`Move ${item} down`}
              onClick={() => move(item, 1)}
            >
              ↓
            </button>
          </div>
        ))}
      </details>
      <button className="source-guide-link" onClick={openSources}>
        How the texts and translations work
      </button>
      <DataFooter info={info} />
    </section>
  );
}

function SourcePicker({
  sources,
  value,
  onChange,
}: {
  sources: SourceWorkOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="source-picker">
      <span>Text</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {sources.map((s) => (
          <option value={s.id} key={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function AngReader({
  ang,
  maxAng,
  lines,
  loadAng,
  ...props
}: {
  ang: number;
  maxAng: number;
  lines: CanonicalLine[];
  loadAng: (n: number) => Promise<void>;
} & CommonReader) {
  const [jump, setJump] = useState(String(ang));
  useEffect(() => setJump(String(ang)), [ang]);
  return (
    <section>
      <div className="reader-heading">
        <PageHeading eyebrow="Continuous reading" title={`Ang ${ang}`}>
          Read without interruptions; tap a line only when you want actions.
        </PageHeading>
        <form
          className="compact-ang"
          onSubmit={(e) => {
            e.preventDefault();
            void loadAng(Number(jump));
          }}
        >
          <span className="number-with-limit">
            <input
              aria-label={`Ang number out of ${maxAng}`}
              inputMode="numeric"
              value={jump}
              onChange={(e) => setJump(e.target.value)}
            />
            <small>/{maxAng}</small>
          </span>
          <button>Go</button>
        </form>
      </div>
      <CoachTip id="reader-controls" preferences={props.preferences} setPreferences={props.setPreferences} title="Read or open deeper study tools">
        Read keeps actions out of the way. Choose Study, then tap a line to bookmark, reflect, collect or explore a word. Aa controls appearance; Layers controls translations and analysis.
      </CoachTip>
      <TextControls
        preferences={props.preferences}
        setPreferences={props.setPreferences}
      />
      <div className="pager">
        <button disabled={ang <= 1} onClick={() => void loadAng(ang - 1)}>
          ← Previous
        </button>
        <button disabled={ang >= maxAng} onClick={() => void loadAng(ang + 1)}>
          Next →
        </button>
      </div>
      {lines.length ? (
        <ReaderLines lines={lines} {...props} />
      ) : (
        <p className="empty">
          No selected reading is indexed on this Ang. Open Read for the
          available SGPC readings.
        </p>
      )}
    </section>
  );
}

function SabadReader({
  sabad,
  ...props
}: { sabad: ShabadView } & CommonReader) {
  const analysisId = `analysis-${sabad.id.replaceAll(":", "-")}`;
  const [copied, setCopied] = useState(false);
  const endLayers = sabad.providerLayers.filter((layer) =>
    [
      "interpretive_transcreation_en",
      "interpretive_transcreation_pa",
      "poetical_dimension_en",
      "poetical_dimension_pa",
      "commentary_en",
      "commentary_pa",
    ].includes(layer.contentType),
  );
  const copyReference = async () => {
    await copyText(
      `${sabad.preview}\n${sabad.contributorName} · ${sabad.raag} · Ang ${range(sabad.firstAng, sabad.lastAng)}\nShabad Sojhi reference: ${sabad.sourceWorkId} / ${sabad.id}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const youtube = () => {
    const matched =
      sabad.lines.find((line) => line.id === props.matchedLineId) ??
      sabad.lines[0];
    window.open(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${matched?.gurmukhi ?? sabad.preview} ${matched?.transliteration ?? ""} ${sabad.contributorName}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <section>
      <PageHeading
        eyebrow={`${sabad.contributorName} · ${sabad.raag}`}
        title="Complete Shabad"
      >
        Ang {range(sabad.firstAng, sabad.lastAng)}
      </PageHeading>
      <div className="shabad-actions">
        <button
          className="secondary reference-button"
          onClick={() => void copyReference()}
        >
          {copied ? "Reference copied" : "Copy reference"}
        </button>
        <button className="secondary" onClick={youtube}>
          Find this line on YouTube ↗
        </button>
      </div>
      <CoachTip id="reader-controls" preferences={props.preferences} setPreferences={props.setPreferences} title="Read or open deeper study tools">
        Read keeps actions out of the way. Choose Study, then tap a line to bookmark, reflect, collect or explore a word. Aa controls appearance; Layers controls translations and analysis.
      </CoachTip>
      <TextControls
        preferences={props.preferences}
        setPreferences={props.setPreferences}
      />
      <ReaderLines lines={sabad.lines} {...props} />
      {props.preferences.showProviderLayers && endLayers.length > 0 && (
        <div id={analysisId}>
          <ProviderLayers
            layers={endLayers}
            visibility={props.preferences.providerLayerVisibility}
            setVisibility={(type, visible) =>
              props.setPreferences((p) => ({
                ...p,
                providerLayerVisibility: {
                  ...p.providerLayerVisibility,
                  [type]: visible,
                },
              }))
            }
            scale={props.preferences.interpretationScale}
          />
        </div>
      )}
    </section>
  );
}

function ReaderLines({
  lines,
  preferences,
  personal,
  setPersonal,
  openWord,
  setActiveLine,
  matchedLineId,
  sections,
}: Pick<
  CommonReader,
  | "preferences"
  | "personal"
  | "setPersonal"
  | "openWord"
  | "setActiveLine"
  | "matchedLineId"
> & { lines: CanonicalLine[]; sections?: Map<number, BaniSection> }) {
  const study = preferences.readerMode === "study";
  useEffect(() => {
    if (!matchedLineId) return;
    window.setTimeout(
      () =>
        document
          .getElementById(`line-${safeId(matchedLineId)}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      80,
    );
  }, [matchedLineId, lines]);
  return (
    <article className={`reader-flow ${study ? "study" : "reading"}`}>
      {preferences.translationSource !== "off" && (
        <div className="provider-legend" aria-label="Translation source key">
          <span className="legend-sikhri">Solid rail · TGGSP</span>
          <span className="legend-banidb">Dashed rail · BaniDB fallback</span>
        </div>
      )}
      {lines.map((line, index) => {
        const transliteration =
          preferences.transliterationSource === "tggsp" &&
          line.tggspTransliteration
            ? line.tggspTransliteration
            : line.transliteration;
        const hasTggspTranslation = Boolean(
          line.tggspTranslation || line.tggspTranslationPa,
        );
        const useTggsp =
          preferences.translationSource === "tggsp" && hasTggspTranslation;
        const showPassageTranslation =
          line.tggspTranslationScope !== "passage" ||
          line.id === line.tggspPassageAnchorId;
        const showBaniDb =
          preferences.translationSource === "banidb" ||
          (preferences.translationSource === "tggsp" && !hasTggspTranslation);
        return (
          <div
            className={`reading-line-group ${useTggsp && line.tggspTranslationScope === "passage" ? "passage-member" : ""}`}
            key={`${line.id}:${index}`}
          >
            {sections?.has(index) && (
              <header className="reading-section">
                <b>{sections.get(index)!.title}</b>
                <small>{sections.get(index)!.author}</small>
              </header>
            )}
            <div
              id={`line-${safeId(line.id)}`}
              className={`reader-line ${line.id === matchedLineId ? "matched-line" : ""}`}
              onClick={() => !study && setActiveLine(line)}
              style={{ lineHeight: preferences.lineSpacing }}
            >
              <p
                className="gurmukhi"
                style={{
                  fontSize: `${preferences.textScale}em`,
                  fontWeight: preferences.gurmukhiWeight === "bold" ? 700 : 400,
                }}
              >
                {study && preferences.wordMode
                  ? words(line.gurmukhi, openWord)
                  : line.gurmukhi}
              </p>
              {preferences.showTransliteration && transliteration && (
                <p
                  className="transliteration"
                  style={{ fontSize: `${preferences.transliterationScale}em` }}
                >
                  {transliteration}
                </p>
              )}
              {useTggsp && showPassageTranslation && (
                <div className="translation-block tggsp-translation">
                  {line.tggspTranslationScope === "passage" && (
                    <small>
                      Translation of the preceding{" "}
                      {line.tggspPassageMemberCount} Gurbani lines
                    </small>
                  )}
                  {preferences.tggspLanguage !== "panjabi" &&
                    line.tggspTranslation && (
                      <p
                        className="translation"
                        style={{
                          fontSize: `${preferences.transliterationScale}em`,
                        }}
                      >
                        {line.tggspTranslation}
                      </p>
                    )}
                  {preferences.tggspLanguage !== "english" &&
                    line.tggspTranslationPa && (
                      <p
                        className="translation panjabi"
                        style={{
                          fontSize: `${preferences.transliterationScale}em`,
                        }}
                      >
                        {line.tggspTranslationPa}
                      </p>
                    )}
                </div>
              )}
              {showBaniDb && line.bdbTranslation && (
                <div className="translation-block banidb-translation">
                  <p
                    className="translation"
                    style={{
                      fontSize: `${preferences.transliterationScale}em`,
                    }}
                  >
                    {line.bdbTranslation}
                  </p>
                </div>
              )}
              {preferences.showWordAnalysis &&
                Boolean(line.tggspTerms?.length) && (
                  <details
                    className="line-etymology"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <summary>
                      TGGSP word details · {line.tggspTerms!.length}{" "}
                      {line.tggspTerms!.length === 1 ? "term" : "terms"}
                    </summary>
                    {line.tggspTerms!.map((term) => (
                      <div key={term.id}>
                        <b className="gurmukhi">{term.headword}</b>
                        {term.transliteration && (
                          <small>{term.transliteration}</small>
                        )}
                        {preferences.tggspLanguage !== "panjabi" && (
                          <>
                            {term.meaningEn && (
                              <p>
                                <b>Meaning:</b> {term.meaningEn}
                              </p>
                            )}
                            {term.grammarEn && (
                              <p>
                                <b>Grammar:</b> {term.grammarEn}
                              </p>
                            )}
                            {term.etymologyEn && (
                              <p>
                                <b>Etymology:</b> {term.etymologyEn}
                              </p>
                            )}
                          </>
                        )}
                        {preferences.tggspLanguage !== "english" && (
                          <>
                            {term.meaningPa && (
                              <p>
                                <b>ਅਰਥ:</b> {term.meaningPa}
                              </p>
                            )}
                            {term.grammarPa && (
                              <p>
                                <b>ਵਿਆਕਰਣ:</b> {term.grammarPa}
                              </p>
                            )}
                            {term.etymologyPa && (
                              <p>
                                <b>ਸ਼ਬਦ-ਮੂਲ:</b> {term.etymologyPa}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </details>
                )}
              {study && (
                <div className="line-tools">
                  <small>
                    {line.ang ? `Ang ${line.ang} · ` : ""}
                    {line.contributorName}
                  </small>
                  <button
                    onClick={() =>
                      setPersonal((p) => ({
                        ...p,
                        bookmarks: toggleValue(p.bookmarks, line.id),
                      }))
                    }
                  >
                    {personal.bookmarks.includes(line.id)
                      ? "Bookmarked"
                      : "Bookmark"}
                  </button>
                  <button onClick={() => setActiveLine(line)}>More</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </article>
  );
}

function BaniReader({ bani, ...props }: { bani: BaniView } & CommonReader) {
  const sections = new Map(
    (bani.sections ?? []).map((section) => [section.firstLineOrder, section]),
  );
  return (
    <section>
      <PageHeading
        eyebrow={
          bani.collectionType === "ceremonial"
            ? "Ceremonial reading"
            : bani.collectionType === "composition"
              ? "TGGSP composition"
              : "Named Bani"
        }
        title={<span className="gurmukhi">{bani.gurmukhi}</span>}
      >
        {bani.transliteration}
      </PageHeading>
      {bani.introduction && (
        <details className="collection-introduction">
          <summary>Introduction</summary>
          <p>{bani.introduction}</p>
        </details>
      )}
      <CoachTip
        id="reader-controls"
        preferences={props.preferences}
        setPreferences={props.setPreferences}
        title="Read or open deeper study tools"
      >
        Read keeps actions out of the way. Choose Study, then tap a line to bookmark, reflect, collect or explore a word. Aa controls appearance; Layers controls translations and analysis.
      </CoachTip>
      <TextControls
        preferences={props.preferences}
        setPreferences={props.setPreferences}
      />
      <ReaderLines lines={bani.lines} sections={sections} {...props} />
    </section>
  );
}

function Browse(p: {
  tab: BrowseTab;
  setTab: (v: BrowseTab) => void;
  filter: string;
  setFilter: (v: string) => void;
  banis: BaniSummary[];
  tggspCollections: TggspCollectionSummary[];
  contributors: ContributorSummary[];
  raags: RaagSummary[];
  rankings: RankedForm[];
  rankingTotal: number;
  filters: BrowseFilterState;
  filterDefault: BrowseFilterState;
  setFilters: (value: BrowseFilterState) => void;
  setFilterDefault: (value: BrowseFilterState) => void;
  loadRankings: (
    letters: string[],
    sort: "count" | "name",
    reset?: boolean,
  ) => Promise<void>;
  openBani: (v: BaniSummary) => Promise<void>;
  openTggspCollection: (v: TggspCollectionSummary) => Promise<void>;
  openContributor: (v: ContributorSummary) => Promise<void>;
  openRaag: (v: RaagSummary) => Promise<void>;
  openWord: (v: string) => Promise<void>;
  currentAng: number;
  maxAng: number;
  loadAng: (v: number) => Promise<void>;
  myBaniIds: string[];
  toggleMyBani: (id: string) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [jump, setJump] = useState(String(p.currentAng));
  const f = normalizeBrowseFilters(p.filters);
  const q = fold(p.filter);
  const dailyOrder = [
    "japji",
    "jaap",
    "tav-prasad-savaiye",
    "benti-chaupai",
    "anand",
    "rehras",
    "kirtan-sohila",
  ];
  const baniRows = p.banis
    .filter((x) => fold(baniSearchText(x)).includes(q))
    .filter(
      (x) =>
        (!f.baniCollections.length ||
          f.baniCollections.some(
            (group) =>
              (group === "nitnem" && dailyOrder.includes(x.token)) ||
              (group === "vaaran" && baniGroup(x) === "vaaran"),
          )) &&
        (!f.baniAvailability.length || Boolean(x.tggspAvailable)) &&
        (!f.baniPersonal.length || p.myBaniIds.includes(x.id)),
    )
    .sort((a, b) =>
      f.baniSort === "count"
        ? b.verseCount - a.verseCount
        : baniDisplayName(a).localeCompare(baniDisplayName(b), "en", {
            sensitivity: "base",
          }),
    );
  const tggspRows = p.tggspCollections
    .filter((x) => fold(`${x.titleEn} ${x.titlePa} ${x.code}`).includes(q))
    .filter((x) => tggspLifeEventOrder(x.code) < 99)
    .filter(() => f.baniCollections.includes("life"))
    .filter(() => !f.baniPersonal.length)
    .sort((a, b) => tggspLifeEventOrder(a.code) - tggspLifeEventOrder(b.code));
  const contributorRows = p.contributors
    .filter((x) => fold(x.name).includes(q))
    .filter(
      (x) =>
        !f.contributorTypes.length ||
        f.contributorTypes.includes(contributorGroup(x.type)),
    )
    .sort((a, b) =>
      f.contributorSort === "count"
        ? b.unitCount - a.unitCount
        : a.name.localeCompare(b.name),
    );
  const mainRaags = p.raags
    .filter((row) => isMainRaag(row.name))
    .filter(() => !f.raagGroups.length || f.raagGroups.includes("principal"))
    .sort((a, b) =>
      f.raagSort === "count"
        ? b.unitCount - a.unitCount
        : f.raagSort === "name"
          ? a.name.localeCompare(b.name)
          : raagOrder(a.name) - raagOrder(b.name),
    );
  const otherHeadings = p.raags
    .filter((row) => !isMainRaag(row.name))
    .filter(() => !f.raagGroups.length || f.raagGroups.includes("other"))
    .sort((a, b) =>
      f.raagSort === "count"
        ? b.unitCount - a.unitCount
        : a.name.localeCompare(b.name),
    );
  return (
    <section>
      <PageHeading eyebrow="Read" title="Choose what to read">
        Open a Bani, go to an Ang, or explore the installed Gurbani by Raag,
        contributor, or words and meanings.
      </PageHeading>
      <div className="tabs browse-tabs">
        {(["banis", "raags", "contributors", "words"] as BrowseTab[]).map(
          (tab) => (
            <button
              className={p.tab === tab ? "active" : ""}
              onClick={() => p.setTab(tab)}
              key={tab}
            >
              {tab === "banis"
                ? "All Banis"
                : tab === "words"
                  ? "Words & meanings"
                  : title(tab)}
            </button>
          ),
        )}
      </div>
      <div className="browse-primary">
        {p.tab === "banis" && (
          <>
            <form
              className="compact-ang"
              onSubmit={(event) => {
                event.preventDefault();
                void p.loadAng(Number(jump));
              }}
            >
              <span>Go to Ang</span>
              <span className="number-with-limit">
                <input
                  inputMode="numeric"
                  value={jump}
                  onChange={(event) => setJump(event.target.value)}
                  aria-label={`Ang number out of ${p.maxAng}`}
                />
                <small>/{p.maxAng}</small>
              </span>
              <button>Go</button>
            </form>
          </>
        )}
        <FilterButton
          count={browseFilterCount(f, p.tab)}
          onClick={() => setFilterOpen(true)}
        />
      </div>
      {p.tab !== "words" ? (
        <input
          aria-label={`Search ${p.tab}`}
          className="filter browse-filter"
          value={p.filter}
          onChange={(e) => p.setFilter(e.target.value)}
          placeholder={`Search ${p.tab === "banis" ? "Banis" : p.tab}`}
        />
      ) : (
        <p className="result-count">
          Browse by initial letter below; use Search to find a full exact form.
        </p>
      )}
      {p.tab === "raags" && (
        <aside className="raag-intro">
          <strong>31 Raags</strong>
          <p>
            The principal Raags appear below in scripture order. Musical and
            structural headings are kept in a separate expandable section.
          </p>
        </aside>
      )}
      {p.tab === "words" && (
        <p className="result-count">
          Showing {p.rankings.length.toLocaleString()} of{" "}
          {p.rankingTotal.toLocaleString()} exact written forms
          {f.wordLetters.length > 0 && (
            <> beginning with <span className="gurmukhi">{f.wordLetters.join(" · ")}</span></>
          )}.
        </p>
      )}
      <div
        className={`browse-list ${p.tab === "words" ? "compact-words" : ""}`}
      >
        {p.tab === "banis" &&
          baniRows.map((x) => (
            <div className="bani-row" key={x.id}>
              <button onClick={() => void p.openBani(x)}>
                <span className="result-badges">
                  <span className="gurmukhi">{x.gurmukhi}</span>
                  {x.tggspAvailable && (
                    <span className="tggsp-badge">TGGSP</span>
                  )}
                </span>
                <strong>{baniDisplayName(x)}</strong>
              </button>
              <button
                className="bani-star"
                aria-label={`${p.myBaniIds.includes(x.id) ? "Remove from" : "Add to"} Saved Banis`}
                onClick={() => p.toggleMyBani(x.id)}
              >
                <Icon
                  name={p.myBaniIds.includes(x.id) ? "star" : "star_outline"}
                />
              </button>
            </div>
          ))}
        {p.tab === "banis" &&
          tggspRows.map((x) => (
            <button key={x.code} onClick={() => void p.openTggspCollection(x)}>
              <span className="result-badges">
                <span className="gurmukhi">{x.titlePa}</span>
                <span className="tggsp-badge">TGGSP</span>
                <span className="life-event-badge">
                  {lifeEventContext(x.code)}
                </span>
              </span>
              <strong>{x.titleEn}</strong>
            </button>
          ))}
        {p.tab === "contributors" &&
          contributorRows.map((x) => (
            <button
              className="compact-index-row"
              key={x.id}
              onClick={() => void p.openContributor(x)}
            >
              <strong>{x.name}</strong>
              <small>{x.unitCount.toLocaleString()} Shabads</small>
            </button>
          ))}
        {p.tab === "raags" &&
          mainRaags
            .filter((x) => fold(x.name).includes(q))
            .map((x) => (
              <button
                className="compact-index-row"
                key={x.id + x.name}
                onClick={() => void p.openRaag(x)}
              >
                <strong>{x.name}</strong>
                <small>{x.unitCount.toLocaleString()} Shabads</small>
              </button>
            ))}
        {p.tab === "words" &&
          p.rankings.map((x, i) => (
            <button key={x.form} onClick={() => void p.openWord(x.form)}>
              <b>{i + 1}</b>
              <span className="gurmukhi">{x.form}</span>
              <span>
                <strong>{x.frequency.toLocaleString()}</strong> occurrences
              </span>
            </button>
          ))}
      </div>
      {p.tab === "raags" &&
        otherHeadings.some((x) => fold(x.name).includes(q)) && (
          <details className="other-headings">
            <summary>Other musical and structural headings</summary>
            <div className="browse-list">
              {otherHeadings
                .filter((x) => fold(x.name).includes(q))
                .map((x) => (
                  <button
                    key={x.id + x.name}
                    onClick={() => void p.openRaag(x)}
                  >
                    <strong>{x.name}</strong>
                    <small>{x.unitCount.toLocaleString()} Shabads</small>
                  </button>
                ))}
            </div>
          </details>
        )}
      {p.tab === "words" && p.rankings.length < p.rankingTotal && (
        <button
          className="load-more"
          onClick={() => void p.loadRankings(f.wordLetters, f.wordSort, false)}
        >
          Load 100 more
        </button>
      )}
      <FilterSheet
        open={filterOpen}
        title={p.tab === "banis" ? "All Banis" : title(p.tab)}
        groups={browseFilterGroups(p.tab)}
        selected={browseFilterSelection(f, p.tab) as Record<string, string[]>}
        sortOptions={browseSortOptions(p.tab)}
        sort={browseSortValue(f, p.tab)}
        onClose={() => setFilterOpen(false)}
        onApply={(selected, sort) => {
          const next = applyBrowseSelection(f, p.tab, selected, sort);
          p.setFilters(next);
          setFilterOpen(false);
          if (p.tab === "words") void p.loadRankings(next.wordLetters, next.wordSort);
        }}
        onSetDefault={(selected, sort) => {
          const next = applyBrowseSelection(f, p.tab, selected, sort);
          p.setFilterDefault(mergeBrowseTab(p.filterDefault, next, p.tab));
          p.setFilters(next);
          setFilterOpen(false);
          if (p.tab === "words") void p.loadRankings(next.wordLetters, next.wordSort);
        }}
        onResetDefault={() => {
          p.setFilters(p.filterDefault);
          setFilterOpen(false);
          if (p.tab === "words") void p.loadRankings(p.filterDefault.wordLetters, p.filterDefault.wordSort);
        }}
      />
    </section>
  );
}

function browseFilterGroups(tab: BrowseTab) {
  if (tab === "banis")
    return [
      {
        id: "baniCollections",
        label: "Reading group",
        options: [
          { value: "nitnem", label: "Nitnem" },
          { value: "vaaran", label: "Vaars" },
          { value: "life", label: "Ceremonies and life events" },
        ],
      },
      {
        id: "baniAvailability",
        label: "Analysis available",
        options: [{ value: "tggsp", label: "TGGSP available" }],
      },
      {
        id: "baniPersonal",
        label: "Saved",
        options: [{ value: "saved", label: "Saved Banis" }],
      },
    ];
  if (tab === "contributors")
    return [
      {
        id: "contributorTypes",
        label: "Contributor type",
        options: [
          { value: "guru", label: "Gurus" },
          { value: "bhagat", label: "Bhagats" },
          { value: "bhatt", label: "Bhatts" },
          { value: "other", label: "Other contributors" },
        ],
      },
    ];
  if (tab === "raags")
    return [
      {
        id: "raagGroups",
        label: "Index section",
        options: [
          { value: "principal", label: "31 principal Raags" },
          { value: "other", label: "Other musical and structural headings" },
        ],
      },
    ];
  return [
    {
      id: "wordLetters",
      label: "Initial letters",
      options: gurmukhiLetters.map((letter) => ({ value: letter, label: letter })),
    },
  ];
}

function browseFilterSelection(filters: BrowseFilterState, tab: BrowseTab) {
  if (tab === "banis")
    return {
      baniCollections: filters.baniCollections,
      baniAvailability: filters.baniAvailability,
      baniPersonal: filters.baniPersonal,
    };
  if (tab === "contributors") return { contributorTypes: filters.contributorTypes };
  if (tab === "raags") return { raagGroups: filters.raagGroups };
  return { wordLetters: filters.wordLetters };
}

function browseSortOptions(tab: BrowseTab) {
  if (tab === "raags")
    return [
      { value: "scripture", label: "Scripture order" },
      { value: "name", label: "A–Z" },
      { value: "count", label: "Most Shabads" },
    ];
  return [
    { value: tab === "words" ? "count" : "name", label: tab === "words" ? "Most occurrences" : "A–Z" },
    { value: tab === "words" ? "name" : "count", label: tab === "words" ? "Gurmukhi order" : "Most Shabads" },
  ];
}

function browseSortValue(filters: BrowseFilterState, tab: BrowseTab) {
  if (tab === "banis") return filters.baniSort;
  if (tab === "contributors") return filters.contributorSort;
  if (tab === "raags") return filters.raagSort;
  return filters.wordSort;
}

function applyBrowseSelection(
  current: BrowseFilterState,
  tab: BrowseTab,
  selected: Record<string, string[]>,
  sort?: string,
): BrowseFilterState {
  if (tab === "banis")
    return normalizeBrowseFilters({
      ...current,
      baniCollections: selected.baniCollections as BrowseFilterState["baniCollections"],
      baniAvailability: selected.baniAvailability as BrowseFilterState["baniAvailability"],
      baniPersonal: selected.baniPersonal as BrowseFilterState["baniPersonal"],
      baniSort: (sort ?? current.baniSort) as BrowseFilterState["baniSort"],
    });
  if (tab === "contributors")
    return normalizeBrowseFilters({
      ...current,
      contributorTypes: selected.contributorTypes as BrowseFilterState["contributorTypes"],
      contributorSort: (sort ?? current.contributorSort) as BrowseFilterState["contributorSort"],
    });
  if (tab === "raags")
    return normalizeBrowseFilters({
      ...current,
      raagGroups: selected.raagGroups as BrowseFilterState["raagGroups"],
      raagSort: (sort ?? current.raagSort) as BrowseFilterState["raagSort"],
    });
  return normalizeBrowseFilters({
    ...current,
    wordLetters: selected.wordLetters,
    wordSort: (sort ?? current.wordSort) as BrowseFilterState["wordSort"],
  });
}

function mergeBrowseTab(
  target: BrowseFilterState,
  source: BrowseFilterState,
  tab: BrowseTab,
): BrowseFilterState {
  if (tab === "banis")
    return {
      ...target,
      baniCollections: source.baniCollections,
      baniAvailability: source.baniAvailability,
      baniPersonal: source.baniPersonal,
      baniSort: source.baniSort,
    };
  if (tab === "contributors")
    return {
      ...target,
      contributorTypes: source.contributorTypes,
      contributorSort: source.contributorSort,
    };
  if (tab === "raags")
    return { ...target, raagGroups: source.raagGroups, raagSort: source.raagSort };
  return { ...target, wordLetters: source.wordLetters, wordSort: source.wordSort };
}

function browseFilterCount(filters: BrowseFilterState, tab: BrowseTab) {
  return Object.values(browseFilterSelection(filters, tab)).reduce(
    (total, values) => total + values.length,
    0,
  );
}

function Units({
  heading,
  summary,
  units,
  openSabad,
  more,
  hasMore,
}: {
  heading: string;
  summary: string;
  units: TextUnitSummary[];
  openSabad: (v: string) => Promise<void>;
  more: () => Promise<void>;
  hasMore: boolean;
}) {
  return (
    <section>
      <PageHeading eyebrow="Contributor" title={heading}>
        {summary}
      </PageHeading>
      <UnitList units={units} openSabad={openSabad} />
      {hasMore && (
        <button className="load-more" onClick={() => void more()}>
          Load 50 more
        </button>
      )}
    </section>
  );
}
function UnitList({
  units,
  openSabad,
}: {
  units: TextUnitSummary[];
  openSabad: (v: string) => Promise<void>;
}) {
  return (
    <div className="unit-list">
      {units.map((u) => (
        <button key={u.id} onClick={() => void openSabad(u.id)}>
          <small>
            {u.contributorName} · Ang {range(u.firstAng, u.lastAng)}
          </small>
          <span className="gurmukhi">{u.preview}</span>
          {u.transliteration && (
            <span className="transliteration">{u.transliteration}</span>
          )}
          <b>Read complete Shabad →</b>
        </button>
      ))}
    </div>
  );
}
function RaagView({
  raag,
  people,
  selected,
  filter,
  units,
  openSabad,
  more,
}: {
  raag: RaagSummary;
  people: RaagContributorSummary[];
  selected: string[];
  filter: (v: string[]) => Promise<void>;
  units: TextUnitSummary[];
  openSabad: (v: string) => Promise<void>;
  more: () => Promise<void>;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  return (
    <section>
      <PageHeading eyebrow="Raag" title={raag.name}>
        {raag.unitCount.toLocaleString()} Shabads
      </PageHeading>
      <FilterButton count={selected.length} onClick={() => setFilterOpen(true)} />
      <FilterSheet
        open={filterOpen}
        title={`Shabads in ${raag.name}`}
        groups={[{
          id: "contributors",
          label: "Contributors within this Raag",
          options: people.map((person) => ({
            value: person.id,
            label: person.name,
            detail: `${person.unitCount.toLocaleString()} Shabads`,
          })),
        }]}
        selected={{ contributors: selected }}
        onClose={() => setFilterOpen(false)}
        onApply={(value) => {
          window.localStorage.setItem(`shabad-sojhi:raag-filter-current:${raag.id}`, JSON.stringify(value.contributors));
          void filter(value.contributors);
          setFilterOpen(false);
        }}
        onSetDefault={(value) => {
          window.localStorage.setItem(`shabad-sojhi:raag-filter-default:${raag.id}`, JSON.stringify(value.contributors));
          window.localStorage.setItem(`shabad-sojhi:raag-filter-current:${raag.id}`, JSON.stringify(value.contributors));
          void filter(value.contributors);
          setFilterOpen(false);
        }}
        onResetDefault={() => {
          const stored = storedStringList(`shabad-sojhi:raag-filter-default:${raag.id}`);
          window.localStorage.setItem(`shabad-sojhi:raag-filter-current:${raag.id}`, JSON.stringify(stored));
          void filter(stored);
          setFilterOpen(false);
        }}
      />
      <UnitList units={units} openSabad={openSabad} />
      <button className="load-more" onClick={() => void more()}>
        Load more
      </button>
    </section>
  );
}

type SearchViewProps = {
  query: string;
  setQuery: (v: string) => void;
  mode: SearchMode;
  setMode: (v: SearchMode) => void;
  filters: SearchFilters;
  setFilters: (v: SearchFilters) => void;
  filterDefault: SearchFilters;
  setFilterDefault: (v: SearchFilters) => void;
  sources: SourceWorkOption[];
  run: () => Promise<void>;
  runVoice: (terms: string[]) => Promise<void>;
  response: CorpusSearchResponse;
  banis: BaniSummary[];
  contributors: ContributorSummary[];
  raags: RaagSummary[];
  history: SearchHistoryEntry[];
  restoreHistory: (v: SearchHistoryEntry) => Promise<void>;
  openBani: (v: BaniSummary) => Promise<void>;
  openContributor: (v: ContributorSummary) => Promise<void>;
  openRaag: (v: RaagSummary) => Promise<void>;
  openSabad: (v: string, lineId?: string | null) => Promise<void>;
  openWord: (v: string, filters?: SearchFilters) => Promise<void>;
  openDictionary: (v: string) => Promise<void>;
  saveSearch: () => void;
  notify: (v: string) => void;
  fail: (v: string) => void;
  showExperimental: boolean;
  personal: PersonalData;
  setPersonal: CommonReader["setPersonal"];
};

function searchFilterGroups(
  sources: SourceWorkOption[],
  raags: RaagSummary[],
  contributors: ContributorSummary[],
) {
  return [
    {
      id: "sourceWorkIds",
      label: "Texts",
      options: sources.map((source) => ({ value: source.id, label: source.title })),
    },
    {
      id: "raags",
      label: "Raags",
      options: raags.map((raag) => ({
        value: raag.name,
        label: raag.name,
        detail: `${raag.unitCount.toLocaleString()} Shabads`,
      })),
    },
    {
      id: "contributorIds",
      label: "Contributors",
      options: contributors.map((person) => ({
        value: person.id,
        label: person.name,
        detail: `${person.unitCount.toLocaleString()} Shabads`,
      })),
    },
    {
      id: "tggspCoverages",
      label: "TGGSP available",
      options: [
        { value: "any", label: "Any TGGSP material" },
        { value: "translation", label: "Translation" },
        { value: "word-analysis", label: "Etymology" },
        { value: "extended", label: "Extended interpretation" },
      ],
    },
    {
      id: "providerContentTypes",
      label: "TGGSP sections",
      options: providerFilterOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    },
    {
      id: "resultTypes",
      label: "Result type",
      options: [
        { value: "sabad", label: "Shabads and Gurbani lines" },
        { value: "translation", label: "Translation and analysis" },
      ],
    },
  ];
}

function searchFilterSelection(filters: SearchFilters) {
  const value = normalizeSearchFilters(filters);
  return {
    sourceWorkIds: value.sourceWorkIds,
    raags: value.raags,
    contributorIds: value.contributorIds,
    tggspCoverages: value.tggspCoverages,
    providerContentTypes: value.providerContentTypes,
    resultTypes: value.resultTypes,
  };
}

function applySearchSelection(
  current: SearchFilters,
  selected: Record<string, string[]>,
): SearchFilters {
  return normalizeSearchFilters({
    ...current,
    sourceWorkIds: selected.sourceWorkIds,
    raags: selected.raags,
    contributorIds: selected.contributorIds,
    tggspCoverages: selected.tggspCoverages as SearchFilters["tggspCoverages"],
    providerContentTypes: selected.providerContentTypes,
    resultTypes: selected.resultTypes as SearchFilters["resultTypes"],
    sourceWorkId: "all",
    raag: "",
    contributorId: "",
    tggspOnly: false,
    tggspCoverage: "",
  });
}

function searchFilterCount(filters: SearchFilters) {
  return Object.values(searchFilterSelection(filters)).reduce(
    (total, values) => total + values.length,
    0,
  );
}

function SearchView(p: SearchViewProps) {
  const [live, setLive] = useState<CorpusSearchResponse>(emptySearch);
  const [themes, setThemes] = useState<CorpusSearchResponse>(emptySearch);
  const [filterOpen, setFilterOpen] = useState(false);
  const q = fold(p.query);
  useEffect(() => {
    const term = p.query.trim();
    if (!term) {
      setLive(emptySearch);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void corpusGateway
        .searchCorpus(term, p.filters, 12, "auto")
        .then((value) => {
          if (active) setLive(value);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [p.query, p.filters]);
  useEffect(() => {
    const term = p.query.trim();
    if (!p.showExperimental || !term) {
      setThemes(emptySearch);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void corpusGateway
        .searchCorpus(term, p.filters, 8, "theme")
        .then((value) => {
          if (active) setThemes(value);
        });
    }, 320);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [p.query, p.filters, p.showExperimental]);
  const baniHits = q
    ? p.banis
        .filter(
          (x) =>
            fold(baniSearchText(x)).includes(q) ||
            scoreSearchCandidate(p.query, x.gurmukhi, baniSearchText(x))
              .score >= 700,
        )
        .slice(0, 10)
    : [];
  const peopleHits = q
    ? p.contributors.filter((x) => fold(x.name).includes(q)).slice(0, 10)
    : [];
  const raagHits = q
    ? p.raags.filter((x) => fold(x.name).includes(q)).slice(0, 10)
    : [];
  const activeScope = [
    ...p.filters.sourceWorkIds.map((id) => ({ facet: "sourceWorkIds", value: id, label: p.sources.find((x) => x.id === id)?.title })),
    ...p.filters.raags.map((raag) => ({ facet: "raags", value: raag, label: `Raag ${raag}` })),
    ...p.filters.contributorIds.map((id) => ({ facet: "contributorIds", value: id, label: p.contributors.find((x) => x.id === id)?.name })),
    ...p.filters.tggspCoverages.map((value) =>
      ({ facet: "tggspCoverages", value, label: value === "any" ? "TGGSP available" : value === "word-analysis" ? "TGGSP etymology" : `TGGSP ${value}` }),
    ),
    ...p.filters.resultTypes.map((value) => ({ facet: "resultTypes", value, label: value === "sabad" ? "Shabads" : title(value) })),
  ].filter((item) => item.label);
  const displayed = p.response.query === p.query.trim() ? p.response : live;
  return (
    <section>
      <div className="search-heading">
        <PageHeading eyebrow="Universal search" title="Search Gurbani">
          Search words, spoken or typed Roman phrases, English, and Gurmukhi
          first-letter sequences.
        </PageHeading>
        <FilterButton
          count={searchFilterCount(p.filters)}
          onClick={() => setFilterOpen(true)}
        />
      </div>
      <SearchBar
        value={p.query}
        onChange={p.setQuery}
        onSubmit={p.run}
        onVoice={p.runVoice}
        notify={p.notify}
        fail={p.fail}
        showVoiceLanguage
      />
      <div className="search-mode-tabs">
        <button className="active">Gurbani search</button>
        <button onClick={() => void p.openDictionary(p.query)}>
          Dictionary
        </button>
      </div>
      <div className="scope-chips">
        {activeScope.map((item) => (
          <button
            className="active-filter-chip"
            key={`${item.facet}:${item.value}`}
            aria-label={`Remove ${item.label} filter`}
            onClick={() =>
              p.setFilters({
                ...p.filters,
                [item.facet]: (p.filters[item.facet as keyof SearchFilters] as string[]).filter(
                  (value) => value !== item.value,
                ),
              })
            }
          >
            {item.label} <Icon name="close" />
          </button>
        ))}
        <button className="save-scope" onClick={p.saveSearch}>
          Save search
        </button>
      </div>
      <FilterSheet
        open={filterOpen}
        title="Search Gurbani"
        groups={searchFilterGroups(p.sources, p.raags, p.contributors)}
        selected={searchFilterSelection(p.filters)}
        onClose={() => setFilterOpen(false)}
        onApply={(selected) => {
          p.setFilters(applySearchSelection(p.filters, selected));
          setFilterOpen(false);
        }}
        onSetDefault={(selected) => {
          const next = applySearchSelection(p.filters, selected);
          p.setFilterDefault(next);
          p.setFilters(next);
          setFilterOpen(false);
        }}
        onResetDefault={() => {
          p.setFilters(p.filterDefault);
          setFilterOpen(false);
        }}
      />
      {!p.query.trim() && p.history.length > 0 && (
        <section className="recent-searches">
          <h2>Recent searches</h2>
          {p.history.slice(0, 8).map((row) => (
            <button key={row.id} onClick={() => void p.restoreHistory(row)}>
              <span>{row.query}</span>
              <small>{new Date(row.searchedAt).toLocaleDateString()}</small>
            </button>
          ))}
        </section>
      )}
      {baniHits.length + peopleHits.length + raagHits.length > 0 && (
        <section className="entity-section">
          <h2>Suggestions</h2>
          <div className="search-entities">
            {baniHits.map((x) => (
              <button onClick={() => void p.openBani(x)} key={x.id}>
                <b>Bani</b> {baniDisplayName(x)}
              </button>
            ))}
            {peopleHits.map((x) => (
              <button onClick={() => void p.openContributor(x)} key={x.id}>
                <b>Contributor</b> {x.name}
              </button>
            ))}
            {raagHits.map((x) => (
              <button onClick={() => void p.openRaag(x)} key={x.id + x.name}>
                <b>Raag</b> {x.name}
              </button>
            ))}
          </div>
        </section>
      )}
      {displayed.candidateForms.length > 0 && (
        <section>
          <h2>Exact forms in this scope</h2>
          <div className="candidates">
            {displayed.candidateForms.map((x) => (
              <button
                key={x.gurmukhi}
                onClick={() => void p.openWord(x.gurmukhi, p.filters)}
              >
                <span className="gurmukhi">{x.gurmukhi}</span>{" "}
                <small>{x.note}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2>
          {p.response.query === p.query.trim() ? "Matches" : "Live shortlist"}
        </h2>
        <SearchResults response={displayed} openSabad={p.openSabad} />
      </section>
      {p.showExperimental && themes.results.length > 0 && (
        <section className="theme-results">
          <header>
            <div>
              <span className="experimental-badge">Experimental</span>
              <h2>Themes in TGGSP analysis</h2>
            </div>
            <small>
              Concept-led suggestions, not a complete or definitive
              classification.
            </small>
          </header>
          <SearchResults response={themes} openSabad={p.openSabad} />
        </section>
      )}
      {p.showExperimental && (
        <IdentifyKeertan
          personal={p.personal}
          setPersonal={p.setPersonal}
          openSabad={p.openSabad}
        />
      )}
    </section>
  );
}

function SearchResults({
  response,
  openSabad,
}: {
  response: CorpusSearchResponse;
  openSabad: (id: string, lineId?: string | null) => Promise<void>;
}) {
  return (
    <div className="search-results">
      {response.results.map((result) => (
        <button
          key={result.id}
          onClick={() =>
            result.textUnitId &&
            void openSabad(result.textUnitId, result.lineId)
          }
        >
          <span className="result-badges">
            <span className="tag">{result.matchKind.replace("-", " ")}</span>
            {result.providerContentTypes?.length ? (
              <span className="tggsp-badge">TGGSP</span>
            ) : null}
          </span>
          <strong>{result.title}</strong>
          <small>{result.subtitle}</small>
          <span className="gurmukhi">{result.gurmukhi}</span>
          {result.transliteration && (
            <span className="transliteration">{result.transliteration}</span>
          )}
          {result.english && <p>{result.english}</p>}
          <b>{result.lineId ? "Open at matching line →" : "Open Shabad →"}</b>
        </button>
      ))}
      {response.query && !response.results.length && (
        <p className="empty">
          No text matches in this scope. Clear a filter, try a shorter phrase,
          or use the Gurmukhi keyboard.
        </p>
      )}
    </div>
  );
}

function IdentifyKeertan({
  personal,
  setPersonal,
  openSabad,
}: {
  personal: PersonalData;
  setPersonal: CommonReader["setPersonal"];
  openSabad: (id: string, lineId?: string | null) => Promise<void>;
}) {
  const [source, setSource] = useState<"nearby-audio" | "same-device-speaker">(
    "nearby-audio",
  );
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string[]>([]);
  const [results, setResults] = useState<CorpusSearchResponse["results"]>([]);
  const [error, setError] = useState("");
  const identify = async () => {
    setListening(true);
    setHeard([]);
    setResults([]);
    setError("");
    try {
      if (!(await voiceSearchAvailable()))
        throw new Error("Voice recognition is not available on this device.");
      const alternatives = await listenForSearch("pa-IN");
      const responses = [];
      for (const transcript of alternatives)
        responses.push(
          await corpusGateway.searchCorpus(
            transcript,
            defaultSearchFilters,
            20,
            "auto",
          ),
        );
      const seen = new Set<string>();
      const matches = responses
        .flatMap((response) => response.results)
        .sort(
          (left, right) => (right.searchScore ?? 0) - (left.searchScore ?? 0),
        )
        .filter(
          (row) =>
            row.resultType === "sabad" &&
            row.textUnitId &&
            (!seen.has(row.textUnitId)
              ? (seen.add(row.textUnitId), true)
              : false),
        )
        .slice(0, 5);
      setHeard(alternatives);
      setResults(matches);
      setPersonal((current) => ({
        ...current,
        keertanTests: [
          {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            source,
            heard: alternatives,
            resultLineIds: matches.flatMap((row) =>
              row.lineId ? [row.lineId] : [],
            ),
            verdict: matches.length
              ? ("unreviewed" as const)
              : ("no-match" as const),
          },
          ...current.keertanTests,
        ].slice(0, 100),
      }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No audio could be recognised.",
      );
    } finally {
      setListening(false);
    }
  };
  const markLatest = (verdict: "correct" | "wrong" | "no-match") =>
    setPersonal((current) => ({
      ...current,
      keertanTests: current.keertanTests.map((test, index) =>
        index === 0 ? { ...test, verdict } : test,
      ),
    }));
  return (
    <details className="panel experimental-keertan">
      <summary>
        <span className="experimental-badge">Experimental</span> Identify
        playing Keertan
      </summary>
      <p>
        Let the microphone listen for a sung line. Every recognised transcript
        is searched; no raw audio is retained.
      </p>
      <label>
        Audio source
        <select
          value={source}
          onChange={(event) => setSource(event.target.value as typeof source)}
        >
          <option value="nearby-audio">Playing nearby</option>
          <option value="same-device-speaker">Playing on this phone</option>
        </select>
      </label>
      {source === "same-device-speaker" && (
        <p className="notice">
          Android may suppress sound played by the same phone. A nearby speaker
          is more reliable in this beta.
        </p>
      )}
      <button disabled={listening} onClick={() => void identify()}>
        <Icon name="hearing" />{" "}
        {listening ? "Listening…" : "Listen and identify"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {heard.length > 0 && (
        <p>
          <b>Heard:</b> {heard.join(" · ")}
        </p>
      )}
      <div className="saved-list">
        {results.map((row) => (
          <button
            key={`${row.textUnitId}-${row.lineId}`}
            onClick={() =>
              row.textUnitId && void openSabad(row.textUnitId, row.lineId)
            }
          >
            <span className="gurmukhi">{row.gurmukhi}</span>
            <small>{row.subtitle}</small>
          </button>
        ))}
      </div>
      {heard.length > 0 && (
        <div className="keertan-feedback">
          <span>Was the correct Shabad shown?</span>
          <button onClick={() => markLatest("correct")}>Yes</button>
          <button className="secondary" onClick={() => markLatest("wrong")}>
            No
          </button>
          <button className="secondary" onClick={() => markLatest("no-match")}>
            No useful match
          </button>
        </div>
      )}
      <small>
        {personal.keertanTests.length} local beta test{" "}
        {personal.keertanTests.length === 1 ? "record" : "records"} will be
        included in a backup.
      </small>
    </details>
  );
}

function WordView({
  word,
  filters,
  sources,
  contributors,
  stats,
  concordance,
  related,
  grouped,
  saved,
  toggleSaved,
  group,
  more,
  openSabad,
  openGlossary,
}: {
  word: string;
  filters: SearchFilters;
  sources: SourceWorkOption[];
  contributors: ContributorSummary[];
  stats: WordStats | null;
  concordance: ConcordancePage;
  related: RelatedForm[];
  grouped: GroupedFrequency | null;
  saved: boolean;
  toggleSaved: () => void;
  group: (v: string[]) => void;
  more: () => Promise<void>;
  openSabad: (v: string, lineId?: string | null) => Promise<void>;
  openGlossary: (v: string) => Promise<void>;
}) {
  const [forms, setForms] = useState([word]);
  useEffect(() => setForms([word]), [word]);
  const scope = [
    ...(filters.sourceWorkIds.length
      ? filters.sourceWorkIds.map((id) => sources.find((x) => x.id === id)?.title)
      : ["All texts"]),
    ...filters.raags.map((value) => `Raag ${value}`),
    ...filters.contributorIds.map((id) => contributors.find((x) => x.id === id)?.name),
    ...filters.tggspCoverages.map((value) => `TGGSP ${value}`),
  ].filter(Boolean);
  return (
    <section>
      <PageHeading
        eyebrow="Exact written form"
        title={<span className="gurmukhi">{word}</span>}
      >
        The exact total never silently combines spellings.
      </PageHeading>
      <div className="scope-chips">
        {scope.map((x) => (
          <span key={String(x)}>{x}</span>
        ))}
      </div>
      <div className="metrics">
        <EmptyMetric label="Occurrences" value={stats?.rawFrequency ?? null} />
        <EmptyMetric
          label="Matching passages"
          value={stats?.distinctLines ?? null}
        />
        <EmptyMetric
          label="Shabad units"
          value={stats?.distinctUnits ?? null}
        />
      </div>
      <button className="secondary" onClick={toggleSaved}>
        {saved ? "Remove saved term" : "Save exact term"}
      </button>{" "}
      <button className="secondary" onClick={() => void openGlossary(word)}>
        Open Dictionary
      </button>
      {related.length > 0 && (
        <details className="panel">
          <summary>Optional form grouping</summary>
          {[word, ...related.map((x) => x.form)].map((x) => (
            <label className="form-option" key={x}>
              <input
                type="checkbox"
                checked={forms.includes(x)}
                disabled={x === word}
                onChange={() =>
                  setForms((v) =>
                    v.includes(x) ? v.filter((y) => y !== x) : [...v, x],
                  )
                }
              />
              <span className="gurmukhi">{x}</span>
            </label>
          ))}
          <button disabled={forms.length < 2} onClick={() => group(forms)}>
            Calculate selected forms in this scope
          </button>
          {grouped && (
            <p>
              <b>{grouped.totalFrequency.toLocaleString()}</b> combined
              occurrences across the explicitly selected forms.
            </p>
          )}
        </details>
      )}
      <article className="concordance">
        <h2>Concordance</h2>
        <p>
          Showing {concordance.matches.length.toLocaleString()} of{" "}
          {concordance.total.toLocaleString()} matching passages in this scope.
        </p>
        {concordance.matches.map((l) => (
          <button key={l.id} onClick={() => void openSabad(l.textUnitId, l.id)}>
            <span className="gurmukhi">{l.gurmukhi}</span>
            <small>
              {l.contributorName} · Ang {l.ang}
            </small>
            <b>Open at matching line →</b>
          </button>
        ))}
        {concordance.matches.length < concordance.total && (
          <button className="load-more" onClick={() => void more()}>
            Load 50 more
          </button>
        )}
      </article>
    </section>
  );
}
function GlossaryView({
  word,
  results,
  search,
  openWord,
}: {
  word: string;
  results: GlossaryResult[];
  search: (v: string) => Promise<void>;
  openWord: (v: string) => Promise<void>;
}) {
  const [q, setQ] = useState(word);
  const [keyboard, setKeyboard] = useState(false);
  const [live, setLive] = useState(results);
  useEffect(() => setLive(results), [results]);
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setLive([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void corpusGateway.glossary(term, 60).then((value) => {
        if (active) setLive(value);
      });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q]);
  return (
    <section>
      <PageHeading
        eyebrow="Dictionary"
        title={
          word ? (
            <span className={/[\u0A00-\u0A7F]/u.test(word) ? "gurmukhi" : ""}>
              {word}
            </span>
          ) : (
            "Find a Gurbani word"
          )
        }
      >
        Search by Gurmukhi or Roman spelling. English concepts suggest possible
        Gurbani terms and are clearly marked experimental.
      </PageHeading>
      <form
        className="search-row large"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <input
          aria-label="Search dictionary"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Gurmukhi, Roman spelling, or English concept"
        />
        <button
          type="button"
          aria-label="Open Gurmukhi keyboard"
          title="Gurmukhi keyboard"
          className="keyboard-button"
          onClick={() => setKeyboard((value) => !value)}
        >
          ਕ
        </button>
        <button>Search</button>
      </form>
      {keyboard && (
        <GurmukhiKeyboard
          value={q}
          onChange={setQ}
          close={() => setKeyboard(false)}
        />
      )}
      <p className="notice">
        English concept matching is experimental: it finds terms whose published
        meanings or etymology contain the concept; it does not claim one-to-one
        equivalence.
      </p>
      {/[\u0A00-\u0A7F]/u.test(word) && (
        <button className="secondary" onClick={() => void openWord(word)}>
          View exact frequency
        </button>
      )}
      <div className="dictionary-results">
        {live.map((x) => {
          const parsed = glossaryFields(x);
          return (
            <article className="panel dictionary-entry" key={x.id}>
              <header>
                <div>
                  <h2 className="gurmukhi">{x.headword}</h2>
                  {x.transliteration && <span>{x.transliteration}</span>}
                </div>
                <span
                  className={
                    x.matchKind === "english-concept"
                      ? "experimental-badge"
                      : "tag"
                  }
                >
                  {x.matchKind === "english-concept"
                    ? "Experimental concept"
                    : x.matchKind === "roman"
                      ? "Roman match"
                      : "Gurmukhi match"}
                </span>
              </header>
              {(x.meaningEn || parsed.meaning) && (
                <p>
                  <b>Meaning:</b> {x.meaningEn || parsed.meaning}
                </p>
              )}
              {x.grammarEn && (
                <p>
                  <b>Grammar:</b> {x.grammarEn}
                </p>
              )}
              {x.etymologyEn && (
                <details>
                  <summary>Etymology</summary>
                  <p>{x.etymologyEn}</p>
                </details>
              )}
              {x.meaningPa && (
                <p className="panjabi">
                  <b>ਪੰਜਾਬੀ:</b> {x.meaningPa}
                </p>
              )}
              {x.frequency !== undefined && (
                <small>
                  Analysed in {x.frequency.toLocaleString()} TGGSP-linked lines
                </small>
              )}
              <small>{x.provider}</small>
              {/[\u0A00-\u0A7F]/u.test(x.headword) && (
                <button
                  className="secondary"
                  onClick={() => void openWord(x.headword)}
                >
                  Frequency & concordance
                </button>
              )}
            </article>
          );
        })}
        {q.trim() && !live.length && (
          <p className="empty">
            No dictionary entries found. Try a shorter Roman spelling or a
            related English concept.
          </p>
        )}
      </div>
    </section>
  );
}
function Saved({
  personal,
  setPersonal,
  savedLines,
  historyUnits,
  banis,
  openBani,
  openSabad,
  restoreHistory,
}: {
  personal: PersonalData;
  setPersonal: CommonReader["setPersonal"];
  savedLines: CanonicalLine[];
  historyUnits: TextUnitSummary[];
  banis: BaniSummary[];
  openBani: (row: BaniSummary) => Promise<void>;
  openSabad: (id: string, lineId?: string | null) => Promise<void>;
  restoreHistory: (row: SearchHistoryEntry) => Promise<void>;
}) {
  const [tab, setTab] = useState<
    "banis" | "bookmarks" | "notes" | "collections" | "history"
  >("banis");
  const [collectionName, setCollectionName] = useState("");
  const lineMap = new Map(savedLines.map((line) => [line.id, line]));
  const unitMap = new Map(historyUnits.map((unit) => [unit.id, unit]));
  const savedBanis = personal.myBaniIds.flatMap((id) => {
    const row = banis.find((item) => item.id === id);
    return row ? [row] : [];
  });
  const createCollection = () => {
    const name = collectionName.trim();
    if (!name) return;
    setPersonal((current) => ({
      ...current,
      collections: [
        ...current.collections,
        {
          id: crypto.randomUUID(),
          title: name,
          lineIds: [],
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setCollectionName("");
  };
  return (
    <section>
      <PageHeading eyebrow="Personal" title="Library">
        Saved Banis, bookmarks, reflections, collections and history stay
        private on this device.
      </PageHeading>
      <div className="tabs saved-tabs">
        {(
          ["banis", "bookmarks", "notes", "collections", "history"] as const
        ).map((value) => (
          <button
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
            key={value}
          >
            {value === "banis"
              ? "Saved Banis"
              : value === "notes"
                ? "Reflections"
                : title(value)}
          </button>
        ))}
      </div>
      {tab === "banis" && (
        <div className="saved-list">
          {savedBanis.map((row) => (
            <button key={row.id} onClick={() => void openBani(row)}>
              <span className="gurmukhi">{row.gurmukhi}</span>
              <strong>{baniDisplayName(row)}</strong>
              <small>Open reading →</small>
            </button>
          ))}
          {!savedBanis.length && (
            <p className="empty">
              No Saved Banis yet. Use the star beside a Bani in Read.
            </p>
          )}
        </div>
      )}
      {tab === "bookmarks" && (
        <SavedLines
          ids={personal.bookmarks}
          lineMap={lineMap}
          empty="No bookmarks yet. In Study view, tap a line and choose Bookmark line."
          openSabad={openSabad}
        />
      )}
      {tab === "notes" && (
        <div className="saved-list">
          {Object.entries(personal.notes).flatMap(([id, note]) => {
            const line = lineMap.get(id);
            return line
              ? [
                  <button
                    key={id}
                    onClick={() => void openSabad(line.textUnitId, line.id)}
                  >
                    <span className="gurmukhi">{line.gurmukhi}</span>
                    <p>{note}</p>
                    <small>Ang {line.ang} · open at line</small>
                  </button>,
                ]
              : [];
          })}
          {!Object.keys(personal.notes).length && (
            <p className="empty">
              No reflections yet. Open Study view and tap a line to write one.
            </p>
          )}
        </div>
      )}
      {tab === "collections" && (
        <>
          <div className="new-collection">
            <input
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder="New collection name"
            />
            <button onClick={createCollection}>Create</button>
          </div>
          {personal.collections.map((collection) => (
            <details className="collection" key={collection.id} open>
              <summary>
                <b>{collection.title}</b> · {collection.lineIds.length} items
              </summary>
              <SavedLines
                ids={collection.lineIds}
                lineMap={lineMap}
                empty="Add lines from the Study view actions."
                openSabad={openSabad}
              />
              <button
                className="danger-link"
                onClick={() =>
                  setPersonal((current) => ({
                    ...current,
                    collections: current.collections.filter(
                      (item) => item.id !== collection.id,
                    ),
                  }))
                }
              >
                Delete collection
              </button>
            </details>
          ))}
        </>
      )}
      {tab === "history" && (
        <div className="history-sections">
          <section>
            <header>
              <h2>Search history</h2>
              {personal.searchHistory.length > 0 && (
                <button
                  className="danger-link"
                  onClick={() =>
                    setPersonal((current) => ({
                      ...current,
                      searchHistory: [],
                    }))
                  }
                >
                  Clear all searches
                </button>
              )}
            </header>
            {personal.searchHistory.map((row) => (
              <div className="history-row" key={row.id}>
                <button onClick={() => void restoreHistory(row)}>
                  <b>{row.query}</b>
                  <small>{new Date(row.searchedAt).toLocaleString()}</small>
                </button>
                <button
                  aria-label={`Delete search ${row.query}`}
                  className="delete-history"
                  onClick={() =>
                    setPersonal((current) => ({
                      ...current,
                      searchHistory: current.searchHistory.filter(
                        (item) => item.id !== row.id,
                      ),
                    }))
                  }
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
            {!personal.searchHistory.length && (
              <p className="empty">Search history will appear here.</p>
            )}
          </section>
          <section>
            <header>
              <h2>Reading history</h2>
              {personal.history.length > 0 && (
                <button
                  className="danger-link"
                  onClick={() =>
                    setPersonal((current) => ({ ...current, history: [] }))
                  }
                >
                  Clear reading history
                </button>
              )}
            </header>
            {personal.history.map((item) => {
              const unit = unitMap.get(item.textUnitId);
              return unit ? (
                <div className="history-row" key={item.textUnitId}>
                  <button
                    onClick={() => void openSabad(item.textUnitId, item.lineId)}
                  >
                    <span className="gurmukhi">{unit.preview}</span>
                    <small>
                      {unit.contributorName} · Ang{" "}
                      {range(unit.firstAng, unit.lastAng)} ·{" "}
                      {new Date(item.visitedAt).toLocaleDateString()}
                    </small>
                  </button>
                  <button
                    className="delete-history"
                    aria-label="Delete reading history item"
                    onClick={() =>
                      setPersonal((current) => ({
                        ...current,
                        history: current.history.filter(
                          (row) => row.textUnitId !== item.textUnitId,
                        ),
                      }))
                    }
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ) : null;
            })}
            {!personal.history.length && (
              <p className="empty">Reading history will appear here.</p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function Settings({
  personal,
  preferences,
  setPreferences,
  openWord,
  restoreSearch,
  openSources,
  openHelp,
  exportData,
  importData,
}: {
  personal: PersonalData;
  preferences: ReaderPreferences;
  setPreferences: CommonReader["setPreferences"];
  openWord: (word: string) => Promise<void>;
  restoreSearch: (row: SavedSearch) => Promise<void>;
  openSources: () => void;
  openHelp: () => void;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
}) {
  return (
    <section>
      <PageHeading eyebrow="App" title="Settings">
        Appearance, help, experimental features and local backup.
      </PageHeading>
      <div className="settings-stack">
        <section className="panel">
          <h2>Colour accent</h2>
          <div className="accent-choices">
            {(["indigo", "burgundy", "slate", "forest"] as const).map(
              (accent) => (
                <button
                  className={preferences.accent === accent ? "active" : ""}
                  data-palette={accent}
                  onClick={() =>
                    setPreferences((current) => ({ ...current, accent }))
                  }
                  key={accent}
                >
                  {title(accent)}
                </button>
              ),
            )}
          </div>
        </section>
        <section className="panel">
          <h2>Experimental features</h2>
          <label>
            <input
              type="checkbox"
              checked={preferences.showExperimentalFeatures}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  showExperimentalFeatures: event.target.checked,
                }))
              }
            />{" "}
            Show TGGSP theme suggestions and Identify Keertan
          </label>
          <p className="notice">
            Experimental results are clearly labelled and never replace ordinary
            Gurbani search results.
          </p>
        </section>
        <section className="panel">
          <h2>Help and sources</h2>
          <p>
            Learn the search controls, Study view, personal reflections, and
            what BaniDB and TGGSP provide.
          </p>
          <button onClick={openHelp}>Open Help &amp; Guide</button>
          <button
            className="secondary"
            onClick={() =>
              setPreferences((current) => ({
                ...current,
                onboardingComplete: false,
              }))
            }
          >
            Replay welcome guide
          </button>
          <button className="secondary" onClick={openSources}>
            Texts and translations
          </button>
        </section>
        <section className="panel">
          <h2>Saved terms</h2>
          {personal.savedTerms.map((term) => (
            <button
              className="saved-term gurmukhi"
              onClick={() => void openWord(term)}
              key={term}
            >
              {term}
            </button>
          ))}
          {!personal.savedTerms.length && (
            <p className="empty">No saved dictionary terms.</p>
          )}
        </section>
        <section className="panel">
          <h2>Saved searches</h2>
          {personal.savedSearches.map((row) => (
            <button
              className="saved-search"
              onClick={() => void restoreSearch(row)}
              key={row.id}
            >
              {row.title}
              <small>Reopen with filters</small>
            </button>
          ))}
          {!personal.savedSearches.length && (
            <p className="empty">No saved searches.</p>
          )}
        </section>
        <section className="panel">
          <h2>Backup and restore</h2>
          <p>
            Export Saved Banis, bookmarks, reflections, collections, history,
            tests and preferences.
          </p>
          <button onClick={() => void exportData()}>Export backup</button>
          <label className="import-button">
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importData(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <small>
            Import validates the backup, then replaces local personal data and
            preferences.
          </small>
        </section>
      </div>
    </section>
  );
}

function SavedLines({
  ids,
  lineMap,
  empty,
  openSabad,
}: {
  ids: string[];
  lineMap: Map<string, CanonicalLine>;
  empty: string;
  openSabad: (v: string, lineId?: string | null) => Promise<void>;
}) {
  return (
    <div className="saved-list">
      {ids.flatMap((id) => {
        const line = lineMap.get(id);
        return line
          ? [
              <button
                key={id}
                onClick={() => void openSabad(line.textUnitId, line.id)}
              >
                <span className="gurmukhi">{line.gurmukhi}</span>
                <small>
                  {line.contributorName} · Ang {line.ang} · open at line
                </small>
              </button>,
            ]
          : [];
      })}
      {!ids.length && <p className="empty">{empty}</p>}
    </div>
  );
}

function LineSheet({
  line,
  personal,
  setPersonal,
  close,
  openSabad,
  openWord,
  notify,
}: {
  line: CanonicalLine;
  personal: PersonalData;
  setPersonal: CommonReader["setPersonal"];
  close: () => void;
  openSabad: (v: string, lineId?: string | null) => Promise<void>;
  openWord: (v: string) => Promise<void>;
  notify: (v: string) => void;
}) {
  const [note, setNote] = useState(personal.notes[line.id] ?? "");
  const [collectionId, setCollectionId] = useState(
    personal.collections[0]?.id ?? "",
  );
  const [newCollection, setNewCollection] = useState("");
  const saveNote = () => {
    setPersonal((p) => {
      const notes = { ...p.notes };
      if (note.trim()) notes[line.id] = note.trim();
      else delete notes[line.id];
      return { ...p, notes };
    });
    notify(note.trim() ? "Note saved." : "Note removed.");
  };
  const addToCollection = () => {
    let id = collectionId;
    setPersonal((p) => {
      let collections = p.collections;
      if (newCollection.trim()) {
        id = crypto.randomUUID();
        collections = [
          ...collections,
          {
            id,
            title: newCollection.trim(),
            lineIds: [],
            createdAt: new Date().toISOString(),
          },
        ];
      }
      if (!id) return p;
      return {
        ...p,
        collections: collections.map((collection) =>
          collection.id === id
            ? {
                ...collection,
                lineIds: [...new Set([...collection.lineIds, line.id])],
              }
            : collection,
        ),
      };
    });
    setNewCollection("");
    notify("Added to collection.");
  };
  const copyReference = async () => {
    const ref = `${line.gurmukhi}\n${line.contributorName ?? "Contributor"} · Ang ${line.ang}\nShabad Sojhi reference: ${line.sourceWorkId} / ${line.textUnitId} / ${line.id}`;
    await copyText(ref);
    notify("Reference copied.");
  };
  return (
    <div className="sheet-backdrop" onClick={close}>
      <aside className="line-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={close}>
          Close
        </button>
        <p className="gurmukhi">{line.gurmukhi}</p>
        <small>
          {line.contributorName} · Ang {line.ang}
        </small>
        <button
          onClick={() =>
            setPersonal((p) => ({
              ...p,
              bookmarks: toggleValue(p.bookmarks, line.id),
            }))
          }
        >
          {personal.bookmarks.includes(line.id)
            ? "Remove bookmark"
            : "Bookmark line"}
        </button>
        <label className="note-editor">
          Private note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add your note…"
          />
        </label>
        <button onClick={saveNote}>Save note</button>
        <div className="collection-adder">
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            <option value="">Choose collection</option>
            {personal.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select>
          <input
            value={newCollection}
            onChange={(e) => setNewCollection(e.target.value)}
            placeholder="or new collection"
          />
          <button
            onClick={addToCollection}
            disabled={!collectionId && !newCollection.trim()}
          >
            Add
          </button>
        </div>
        <button
          onClick={() => {
            close();
            void openSabad(line.textUnitId, line.id);
          }}
        >
          {line.providerLayers?.length
            ? `Open Shabad · TGGSP available (${line.providerLayers.length})`
            : "Open complete Shabad"}
        </button>
        <button
          onClick={() => {
            const first = cleanWord(line.gurmukhi);
            close();
            void openWord(first);
          }}
        >
          Explore first word
        </button>
        <button className="secondary" onClick={() => void copyReference()}>
          Copy direct reference
        </button>
      </aside>
    </div>
  );
}

function Onboarding({
  complete,
  openSources,
  start,
}: {
  complete: () => void;
  openSources: () => void;
  start: (goal: "search" | "read" | "study") => void;
}) {
  const [step, setStep] = useState(0);
  const pages = [
    {
      icon: "explore",
      title: "Welcome to Shabad Sojhi",
      body: "Read Gurbani, identify a Shabad from words or voice, and explore translations without losing sight of the original text.",
      controls: (
        <div className="guide-controls">
          <span>
            <Icon name="search" /> Find
          </span>
          <span>
            <Icon name="menu_book" /> Read
          </span>
          <span>
            <Icon name="school" /> Understand
          </span>
        </div>
      ),
    },
    {
      icon: "search",
      title: "Find a Shabad in the way you remember it",
      body: "Speak or type a Gurmukhi, Roman or English phrase. Tap ਕ for the built-in Gurmukhi keyboard. Filters can combine texts, Raags, contributors and result types.",
      controls: (
        <div className="guide-controls">
          <span>
            <Icon name="mic" /> speak
          </span>
          <span className="gurmukhi">ਕ</span>
          <span>
            <Icon name="filter_list" /> combine filters
          </span>
        </div>
      ),
    },
    {
      icon: "menu_book",
      title: "Read simply—or open Study tools",
      body: "Read view keeps the text flowing. Study view lets you tap a line to bookmark it, write a private reflection, add it to a collection or explore an exact word. Saved Banis and everything personal live in Library.",
      controls: (
        <div className="guide-controls">
          <span>
            <Icon name="menu_book" /> Read
          </span>
          <span>
            <Icon name="edit_note" /> Study
          </span>
          <span>
            <Icon name="library_books" /> Library
          </span>
        </div>
      ),
    },
    {
      icon: "touch_app",
      title: "Start with a real task",
      body: "Choose what you want to do first. The full, searchable guide remains under Settings → Help & Guide.",
      controls: null,
    },
  ];
  const page = pages[step];
  return (
    <div
      className="onboarding-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Shabad Sojhi"
    >
      <section className="onboarding-card">
        <Icon name={page.icon} />
        <small>
          {step + 1} of {pages.length}
        </small>
        <h1>{page.title}</h1>
        <p>{page.body}</p>
        {page.controls}
        {step === pages.length - 1 && (
          <div className="onboarding-goals">
            <button onClick={() => start("search")}><Icon name="search" /> Find a Shabad</button>
            <button onClick={() => start("read")}><Icon name="menu_book" /> Choose a Bani</button>
            <button onClick={() => start("study")}><Icon name="school" /> Explore Study view</button>
          </div>
        )}
        <div className="onboarding-actions">
          {step > 0 && (
            <button
              className="secondary"
              onClick={() => setStep((value) => value - 1)}
            >
              Back
            </button>
          )}
          {step < pages.length - 1 && (
            <button onClick={() => setStep((value) => value + 1)}>Next</button>
          )}
        </div>
        <button className="source-guide-link" onClick={openSources}>
          About BaniDB and TGGSP
        </button>
        <button className="skip-guide" onClick={complete}>
          Skip guide
        </button>
      </section>
    </div>
  );
}

const helpTopics = [
  {
    section: "Quick start",
    title: "Find something you remember",
    icon: "search",
    body: "Open Search. Type a Gurmukhi, Roman or English phrase, tap the microphone to speak it, or tap ਕ for the built-in Gurmukhi keyboard. Suggestions update as you type; open a result to see the complete Shabad at the matched line.",
  },
  {
    section: "Find Gurbani",
    title: "Search by voice, spelling or first letters",
    icon: "mic",
    body: "Voice and Roman spelling are tolerant rather than literal. The app also recognises Gurmukhi words and first-letter sequences. Use Filters to combine several texts, Raags, contributors, TGGSP coverage and result types. Choices remain in place until you clear or reset them.",
  },
  {
    section: "Find Gurbani",
    title: "Identify nearby Keertan (experimental)",
    icon: "graphic_eq",
    body: "In Search, open Identify Keertan. Let the microphone hear a sung phrase, then review the transcript and ranked Shabad candidates. Results are suggestions because singing, accompaniment and background audio can reduce recognition accuracy.",
  },
  {
    section: "Read Gurbani",
    title: "Open a Bani, Ang, Raag or contributor",
    icon: "menu_book",
    body: "Read contains All Banis, the Ang picker, Raags, contributors and the full word index. Star any Bani to add it to Saved Banis. Filters are multi-select: choices within a group are combined, while different groups narrow one another.",
  },
  {
    section: "Understand Gurbani",
    title: "Use Read and Study views",
    icon: "school",
    body: "Read view removes line actions for uninterrupted reading. Study view reveals line actions and layers. Aa changes the Gurmukhi and English sizes, weight and colours; Layers controls transliteration, translation, etymology and other available TGGSP material.",
  },
  {
    section: "Understand Gurbani",
    title: "Recognise BaniDB and TGGSP content",
    icon: "layers",
    body: "The rail beside each layer identifies its source without repeating a provider label on every line. TGGSP is used where mapped; BaniDB supplies the broader installed text, transliteration and baseline translation. Some TGGSP translations apply to a whole passage and therefore remain after that passage.",
  },
  {
    section: "Save and reflect",
    title: "Save a Bani, bookmark or private reflection",
    icon: "bookmark",
    body: "A star saves a whole Bani. In Study view, tap a line to bookmark it, write a reflection, add it to a collection or copy a direct reference. Library holds Saved Banis, bookmarks, reflections, collections and history. All personal material stays on this device unless you export it.",
  },
  {
    section: "Personalise",
    title: "Change appearance and keep filter defaults",
    icon: "palette",
    body: "Use the Settings gear for themes, accent colours and experimental features. In any filter panel, Set as default stores that view’s configuration; Reset to default restores it and Clear all removes the active selections.",
  },
  {
    section: "Troubleshooting",
    title: "When search or voice does not find the expected Shabad",
    icon: "help",
    body: "Check the ‘Heard’ transcript, try a shorter phrase, and clear restrictive filters. Punjabi voice recognition may depend on the device language service and network. Typed search and the installed reading data remain available offline.",
  },
];

function HelpGuide({
  openSources,
  replay,
}: {
  openSources: () => void;
  replay: () => void;
}) {
  const [query, setQuery] = useState("");
  const folded = fold(query);
  const topics = helpTopics.filter((topic) =>
    fold(`${topic.section} ${topic.title} ${topic.body}`).includes(folded),
  );
  return (
    <section>
      <PageHeading eyebrow="Help" title="Help & Guide">
        Find a task, learn the controls, or replay the short first-use guide.
      </PageHeading>
      <label className="guide-search">
        <Icon name="search" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the guide" />
      </label>
      <div className="guide-actions">
        <button onClick={replay}><Icon name="replay" /> Replay welcome guide</button>
        <button className="secondary" onClick={openSources}><Icon name="info" /> Texts and translations</button>
      </div>
      <div className="help-topics">
        {topics.map((topic, index) => (
          <details key={`${topic.section}:${topic.title}`} open={!query && index < 2}>
            <summary>
              <Icon name={topic.icon} />
              <span><small>{topic.section}</small><b>{topic.title}</b></span>
            </summary>
            <p>{topic.body}</p>
          </details>
        ))}
        {!topics.length && <p className="empty">No guide topic matches that phrase.</p>}
      </div>
    </section>
  );
}

function SourcesGuide({ close }: { close: () => void }) {
  return (
    <section>
      <PageHeading eyebrow="Guide" title="Texts, translations and coverage">
        The app keeps source text, transliteration, translation and
        interpretation visibly distinct.
      </PageHeading>
      <div className="source-guide-grid">
        <article className="panel source-card banidb-source">
          <span className="source-symbol">B</span>
          <h2>BaniDB</h2>
          <p>
            Provides the installed Gurbani text, structure, transliteration and
            baseline English translation across most lines. It also supplies the
            SGPC reading setting used for the included Dasam Banis.
          </p>
          <a href="https://www.banidb.com/" target="_blank" rel="noreferrer">
            Visit BaniDB ↗
          </a>
        </article>
        <article className="panel source-card sikhri-source">
          <span className="source-symbol">T</span>
          <h2>The Guru Granth Sahib Project (TGGSP)</h2>
          <p>
            Sikh Research Institute’s project provides detailed transliteration,
            literal translation, etymology and extended interpretation for
            selected readings. Passage-level translations remain at the end of
            their supplied passage.
          </p>
          <a
            href="https://gurugranthsahib.io/info/english/project"
            target="_blank"
            rel="noreferrer"
          >
            About the project ↗
          </a>
        </article>
      </div>
      <article className="panel">
        <h2>What “where available” means</h2>
        <p>
          TGGSP material appears only where a reviewed mapping exists. When the
          TGGSP translation option is selected and none is mapped to a line, the
          BaniDB translation is shown so the line is not left unexplained. A
          solid rail identifies TGGSP; a dashed rail identifies the BaniDB
          fallback.
        </p>
      </article>
      <article className="panel">
        <h2>Installed texts</h2>
        <p>
          Guru Granth Sahib, Vaaran Bhai Gurdas, selected Dasam Banis, compiled
          Rehras Sahib and Ardas readings, and available TGGSP ceremonial
          collections. “Dasam Bani” does not imply that the complete Dasam
          Granth is installed.
        </p>
      </article>
      <p className="attribution-note">
        BaniDB text and baseline translations are used under its terms. The Guru
        Granth Sahib Project material is © Sikh Research Institute and used with
        permission.
      </p>
      <button onClick={close}>Back</button>
    </section>
  );
}

function words(text: string, open: (v: string) => Promise<void>) {
  return text.split(/(\s+)/u).map((part, i) =>
    /[\p{L}\p{M}]/u.test(part) ? (
      <button
        className="word"
        key={i}
        onClick={(e) => {
          e.stopPropagation();
          void open(part);
        }}
      >
        {part}
      </button>
    ) : (
      part
    ),
  );
}
function cleanWord(value: string) {
  return value.normalize("NFC").match(/[\p{L}\p{M}]+/u)?.[0] ?? "";
}
function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();
}
function accessibleReaderColours(preferences: ReaderPreferences) {
  const fallback =
    preferences.theme === "dark" || preferences.theme === "black"
      ? { gurmukhi: "#f3f7f5", latin: "#c7d5cf" }
      : { gurmukhi: "#18231f", latin: "#46574f" };
  return {
    gurmukhi:
      contrastRatio(preferences.gurmukhiColor, preferences.backgroundColor) >=
      4.5
        ? preferences.gurmukhiColor
        : fallback.gurmukhi,
    latin:
      contrastRatio(preferences.latinColor, preferences.backgroundColor) >= 4.5
        ? preferences.latinColor
        : fallback.latin,
  };
}
function contrastRatio(left: string, right: string) {
  const [a, b] = [relativeLuminance(left), relativeLuminance(right)].sort(
    (x, y) => y - x,
  );
  return (a + 0.05) / (b + 0.05);
}
function relativeLuminance(hex: string) {
  const raw = hex.replace("#", "");
  const value =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  const rgb = [0, 2, 4]
    .map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4),
    );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function title(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}
function range(a: number, b: number) {
  return a === b ? String(a) : `${a}–${b}`;
}
function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/gu, "-");
}
async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
function plain(value: string) {
  try {
    return Object.values(JSON.parse(value) as Record<string, unknown>)
      .filter((x) => typeof x === "string")
      .join(" ");
  } catch {
    return value.replace(/<[^>]*>/gu, " ");
  }
}
function glossaryFields(row: GlossaryResult): { meaning: string } {
  try {
    const value = JSON.parse(row.content) as Record<string, unknown>;
    return { meaning: String(value.meaning ?? "") };
  } catch {
    return { meaning: plain(row.content) };
  }
}
function homeModuleLabel(item: HomeModule) {
  return (
    {
      search: "Search",
      banis: "Banis",
      ang: "Go to Ang",
      dictionary: "Dictionary",
      recent: "Recent reading",
      explore: "Explore",
    } as Record<HomeModule, string>
  )[item];
}
function resumeTitle(
  position: string | null,
  sabad: ShabadView | null,
  banis: BaniSummary[],
  collections: TggspCollectionSummary[],
  ang: number,
) {
  if (position?.startsWith("bani|")) {
    const row = banis.find((item) => item.id === position.slice(5));
    return row ? baniDisplayName(row) : "last Bani";
  }
  if (position?.startsWith("tggsp|"))
    return (
      collections.find((item) => item.code === position.slice(6))?.titleEn ??
      "last TGGSP reading"
    );
  if (position)
    return sabad?.id === position
      ? `${sabad.contributorName} · Ang ${range(sabad.firstAng, sabad.lastAng)}`
      : "last Shabad";
  return `Ang ${ang}`;
}
function baniDisplayName(row: BaniSummary) {
  const common: Record<string, string> = {
    japji: "Japji Sahib",
    jaap: "Jaap Sahib",
    "shabad-hazare-patshahi-10": "Shabad Hazare Patshahi 10",
    "tav-prasad-savaiye": "Tav-Prasad Savaiye",
    "benti-chaupai": "Benti Chaupai Sahib",
    anand: "Anand Sahib",
    rehras: "Rehras Sahib",
    ardas: "Ardas",
    "kirtan-sohila": "Kirtan Sohila",
    sukhmani: "Sukhmani Sahib",
    salokm9: "Salok Mahalla 9",
    asadivar: "Asa Di Vaar",
  };
  return (
    common[row.token] ??
    (/asa\s+(ki|di)\s+v(a|aa)r/i.test(row.transliteration)
      ? "Asa Di Vaar"
      : row.transliteration)
  );
}
function baniSearchText(row: BaniSummary) {
  const name = baniDisplayName(row);
  const aliases: Record<string, string> = {
    sukhmani: "Sukhmani Sahib Sukhamanee Sahib",
    asadivar: "Asa Di Vaar Asa Ki Vaar Aasa Di Var Aasa Ki Vaar",
    "kirtan-sohila": "Kirtan Sohila Sohila Sahib",
    japji: "Japji Sahib",
    anand: "Anand Sahib",
    rehras: "Rehras Sahib Rehraas Sahib",
    salokm9: "Salok Mahalla 9 Salok Mahala Nauva",
  };
  return `${row.transliteration} ${name} ${name.replace(/Asa/gi, "Aasa").replace(/Di/gi, "Ki").replace(/Vaar/gi, "Var")} ${aliases[row.token] ?? ""} ${row.gurmukhi} ${row.token}`;
}
function baniGroup(row: BaniSummary) {
  if (
    [
      "japji",
      "anand",
      "jaap",
      "tav-prasad-savaiye",
      "benti-chaupai",
      "rehras",
      "kirtan-sohila",
    ].includes(row.token)
  )
    return "daily";
  if (
    [
      "sukhmani",
      "salokm9",
      "asadivar",
      "ardas",
      "shabad-hazare-patshahi-10",
    ].includes(row.token)
  )
    return "common";
  if (row.token.includes("vaar") || row.token.includes("var")) return "vaaran";
  if (fold(row.transliteration).startsWith("raag ")) return "raag";
  return "composition";
}
function baniGroupLabel(group: string) {
  return (
    (
      {
        daily: "Daily prayer",
        common: "Common Bani",
        vaaran: "Vaar",
        raag: "Raag collection",
        composition: "Composition form",
      } as Record<string, string>
    )[group] ?? group
  );
}
function dailyPeriod(token: string) {
  return token === "rehras"
    ? "Evening prayer"
    : token === "kirtan-sohila"
      ? "Night prayer"
      : "Morning prayer";
}
function contributorGroup(type: string): BrowseFilterState["contributorTypes"][number] {
  const value = fold(type);
  if (value.includes("guru")) return "guru";
  if (value.includes("bhagat")) return "bhagat";
  if (value.includes("bhatt")) return "bhatt";
  return "other";
}

function storedStringList(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function CoachTip({
  id,
  title: tipTitle,
  preferences,
  setPreferences,
  children,
}: {
  id: string;
  title: string;
  preferences: ReaderPreferences;
  setPreferences: CommonReader["setPreferences"];
  children: ReactNode;
}) {
  if (preferences.seenGuideTips?.includes(id)) return null;
  return (
    <aside className="coach-tip" role="note">
      <Icon name="lightbulb" />
      <div><strong>{tipTitle}</strong><p>{children}</p></div>
      <button
        className="icon-button"
        aria-label="Dismiss tip"
        onClick={() =>
          setPreferences((current) => ({
            ...current,
            seenGuideTips: [...new Set([...(current.seenGuideTips ?? []), id])],
          }))
        }
      >
        <Icon name="close" />
      </button>
    </aside>
  );
}
function contributorSource(id: string, current: string) {
  if (id === "contributor:combined:bhai-gurdas") return "source:B";
  if (id.startsWith("contributor:banidb:D:")) return "source:D";
  return current === "source:B" || current === "source:D"
    ? current
    : "source:G";
}
function tggspLifeEventOrder(code: string) {
  return (
    (
      { BANC: 1, IntCer: 2, ASWC1: 3, SuhiM: 4, ASWC2: 5, ASFC: 6 } as Record<
        string,
        number
      >
    )[code] ?? 99
  );
}
function lifeEventContext(code: string) {
  return (
    (
      {
        BANC: "Birth & naming",
        IntCer: "Amrit Sanskar",
        ASWC1: "Anand Sanskar · opening",
        SuhiM: "Anand Sanskar · Laavan",
        ASWC2: "Anand Sanskar · conclusion",
        ASFC: "Antam Sanskar",
      } as Record<string, string>
    )[code] ?? "Ceremony"
  );
}
const mainRaagSequence = [
  "Siree Raag",
  "Raag Maajh",
  "Raag Gauree",
  "Raag Aasaa",
  "Raag Gujri",
  "Raag Dayv Gandhaaree",
  "Raag Bihaagraa",
  "Raag Vadhans",
  "Raag Sorath",
  "Raag Dhanaasree",
  "Raag Jaithsree",
  "Raag Todee",
  "Raag Baihaaree",
  "Raag Tilang",
  "Raag Soohee",
  "Raag Bilaaval",
  "Raag Gond",
  "Raag Raamkalee",
  "Raag Nat Naaraayan",
  "Raag Maalee Gauraa",
  "Raag Maaroo",
  "Raag Tukhaari",
  "Raag Kaydaaraa",
  "Raag Bhairao",
  "Raag Basant",
  "Raag Saarang",
  "Raag Malaar",
  "Raag Kaanraa",
  "Raag Kalyaan",
  "Raag Prabhaatee",
  "Raag Jaijaavantee",
];
function isMainRaag(name: string) {
  return mainRaagSequence.includes(name);
}
function raagOrder(name: string) {
  const index = mainRaagSequence.indexOf(name);
  return index < 0 ? 999 : index;
}

const gurmukhiLetters = [
  "ੳ",
  "ਅ",
  "ੲ",
  "ਸ",
  "ਹ",
  "ਕ",
  "ਖ",
  "ਗ",
  "ਘ",
  "ਙ",
  "ਚ",
  "ਛ",
  "ਜ",
  "ਝ",
  "ਞ",
  "ਟ",
  "ਠ",
  "ਡ",
  "ਢ",
  "ਣ",
  "ਤ",
  "ਥ",
  "ਦ",
  "ਧ",
  "ਨ",
  "ਪ",
  "ਫ",
  "ਬ",
  "ਭ",
  "ਮ",
  "ਯ",
  "ਰ",
  "ਲ",
  "ਵ",
  "ੜ",
  "ਸ਼",
  "ਖ਼",
  "ਗ਼",
  "ਜ਼",
  "ਫ਼",
];

const providerFilterOptions = [
  { id: "reference_gurmukhi", label: "Reference Gurmukhi" },
  { id: "transliteration", label: "Transcription" },
  { id: "literal_translation_en", label: "Literal · English" },
  { id: "literal_translation_pa", label: "Literal · Panjabi" },
  { id: "commentary_en", label: "Commentary · English" },
  { id: "commentary_pa", label: "Commentary · Panjabi" },
  { id: "poetical_dimension_en", label: "Poetical dimension · English" },
  { id: "poetical_dimension_pa", label: "Poetical dimension · Panjabi" },
];
