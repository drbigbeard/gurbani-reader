import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "./Common";
import { Icon } from "./Icon";
import {
  exportFeedback,
  feedbackCandidate,
  newFeedbackRecord,
} from "../lib/feedback";
import { defaultSearchFilters } from "../lib/filters";
import { corpusGateway } from "../lib/gateway";
import type {
  FeedbackCandidate,
  FeedbackKind,
  FeedbackRecord,
  FeedbackVerdict,
} from "../lib/persistence";
import type { CorpusSearchResult, SearchFilters } from "../types";

export interface FeedbackContext {
  kind: FeedbackKind;
  query?: string;
  voiceAlternatives?: string[];
  audioSource?: FeedbackRecord["audioSource"];
  filters?: SearchFilters;
  candidates?: CorpusSearchResult[];
}

export function FeedbackComposer({
  open,
  context,
  onSave,
  onClose,
}: {
  open: boolean;
  context: FeedbackContext;
  onSave: (record: FeedbackRecord) => void;
  onClose: () => void;
}) {
  const [verdict, setVerdict] = useState<FeedbackVerdict>("wrong");
  const [correctedQuery, setCorrectedQuery] = useState("");
  const [comment, setComment] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState<CorpusSearchResult[]>([]);
  const [looking, setLooking] = useState(false);
  const [selected, setSelected] = useState<FeedbackCandidate | null>(null);

  useEffect(() => {
    if (!open) return;
    setVerdict(context.kind === "theme" ? "not-relevant" : context.kind === "general" ? "partly-correct" : "wrong");
    setCorrectedQuery("");
    setComment("");
    setManualQuery("");
    setManualResults([]);
    setSelected(null);
  }, [open, context.kind, context.query]);

  const presented = useMemo(
    () =>
      (context.candidates ?? [])
        .map(feedbackCandidate)
        .filter((value): value is FeedbackCandidate => Boolean(value)),
    [context.candidates],
  );
  const choices = [
    ...presented,
    ...manualResults
      .map(feedbackCandidate)
      .filter((value): value is FeedbackCandidate => Boolean(value))
      .filter(
        (candidate) =>
          !presented.some(
            (row) =>
              row.textUnitId === candidate.textUnitId &&
              row.lineId === candidate.lineId,
          ),
      ),
  ];

  const findExpected = async () => {
    const query = manualQuery.trim();
    if (!query) return;
    setLooking(true);
    try {
      const response = await corpusGateway.searchCorpus(
        query,
        defaultSearchFilters,
        12,
        "auto",
      );
      setManualResults(
        response.results.filter(
          (result) => result.resultType === "sabad" && result.textUnitId,
        ),
      );
    } finally {
      setLooking(false);
    }
  };

  const save = () => {
    onSave(
      newFeedbackRecord({
        kind: context.kind,
        verdict,
        query: context.query,
        correctedQuery,
        voiceAlternatives: context.voiceAlternatives,
        audioSource: context.audioSource,
        filters: context.filters,
        candidates: presented,
        selectedResult: selected,
        comment,
      }),
    );
    onClose();
  };

  if (!open) return null;
  const theme = context.kind === "theme";
  const general = context.kind === "general";
  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      <section
        className="feedback-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Provide feedback"
      >
        <header>
          <div>
            <small>Stored on this device</small>
            <h2>
              {general
                ? "Send general feedback"
                : theme
                  ? "Review theme suggestions"
                  : "Correct this search"}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close feedback"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="feedback-sheet-body">
          {context.query && (
            <p className="feedback-query">
              <small>Search</small>
              <strong>{context.query}</strong>
            </p>
          )}
          {context.voiceAlternatives?.length ? (
            <p className="notice">
              <b>Heard:</b> {context.voiceAlternatives.join(" · ")}
            </p>
          ) : null}
          <fieldset>
            <legend>{general ? "Feedback type" : "What happened?"}</legend>
            <div className="feedback-verdicts">
              {(general
                ? [
                    ["partly-correct", "Suggestion"],
                    ["wrong", "Something is broken"],
                    ["missing", "Missing capability"],
                  ]
                : theme
                  ? [
                      ["correct", "Relevant"],
                      ["not-relevant", "Not relevant"],
                      ["missing", "Expected something else"],
                    ]
                  : [
                      ["correct", "Found it"],
                      ["partly-correct", "Close"],
                      ["wrong", "Wrong results"],
                      ["no-match", "No useful match"],
                    ]
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="feedback-verdict"
                    value={value}
                    checked={verdict === value}
                    onChange={() => setVerdict(value as FeedbackVerdict)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {!general && (
            <label>
              Correct the wording or transcript
              <input
                value={correctedQuery}
                onChange={(event) => setCorrectedQuery(event.target.value)}
                placeholder="What did you type, say or mean?"
              />
            </label>
          )}
          {!general && choices.length > 0 && (
            <fieldset>
              <legend>Select the Shabad you meant, if shown</legend>
              <div className="feedback-candidates">
                {choices.map((candidate) => {
                  const key = `${candidate.textUnitId}|${candidate.lineId ?? ""}`;
                  const active =
                    selected?.textUnitId === candidate.textUnitId &&
                    selected.lineId === candidate.lineId;
                  return (
                    <button
                      type="button"
                      className={active ? "selected" : ""}
                      key={key}
                      onClick={() => setSelected(candidate)}
                    >
                      <span className="gurmukhi">{candidate.gurmukhi}</span>
                      <strong>{candidate.title}</strong>
                      <small>{candidate.transliteration}</small>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {!general && (
            <fieldset>
              <legend>Not listed? Find the intended Shabad</legend>
              <div className="feedback-lookup">
                <input
                  value={manualQuery}
                  onChange={(event) => setManualQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void findExpected();
                  }}
                  placeholder="Title, Gurmukhi or Roman words"
                />
                <button disabled={looking} onClick={() => void findExpected()}>
                  {looking ? "Searching…" : "Find"}
                </button>
              </div>
            </fieldset>
          )}
          <label>
            {general ? "Tell us what happened" : "Anything else?"}
            <textarea
              rows={4}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Optional explanation"
            />
          </label>
          <p className="feedback-privacy">
            No raw audio, bookmarks, reflections or reading history are included.
            You decide when to export or share this record.
          </p>
        </div>
        <footer>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button onClick={save}>Save feedback</button>
        </footer>
      </section>
    </div>
  );
}

export function FeedbackCenter({
  records,
  setRecords,
  notify,
  fail,
}: {
  records: FeedbackRecord[];
  setRecords: (next: FeedbackRecord[]) => void;
  notify: (message: string) => void;
  fail: (message: string) => void;
}) {
  const [generalOpen, setGeneralOpen] = useState(false);
  const save = (record: FeedbackRecord) => {
    setRecords([record, ...records].slice(0, 250));
    notify("Feedback saved on this device.");
  };
  return (
    <section>
      <PageHeading eyebrow="Beta testing" title="Feedback">
        Correct search and voice results, review experimental suggestions, and
        share only the records you choose.
      </PageHeading>
      <div className="feedback-actions">
        <button onClick={() => setGeneralOpen(true)}>
          <Icon name="add_comment" /> New feedback
        </button>
        <button
          className="secondary"
          disabled={!records.length}
          onClick={() =>
            void exportFeedback(records)
              .then(() => notify("Feedback ready to save or share."))
              .catch(() => fail("Feedback could not be exported."))
          }
        >
          <Icon name="ios_share" /> Export {records.length || ""} records
        </button>
      </div>
      <p className="notice">
        Feedback does not automatically change search. Exported records are
        reviewed before they become tests or search improvements.
      </p>
      <div className="feedback-records">
        {records.map((record) => (
          <article className="panel" key={record.id}>
            <header>
              <div>
                <span className="tag">{record.kind.replaceAll("-", " ")}</span>
                <h2>{record.query || record.comment || "General feedback"}</h2>
              </div>
              <button
                className="icon-button danger"
                aria-label="Delete feedback record"
                onClick={() =>
                  setRecords(records.filter((item) => item.id !== record.id))
                }
              >
                <Icon name="delete" />
              </button>
            </header>
            <p>
              <b>{record.verdict.replaceAll("-", " ")}</b>
              {record.correctedQuery
                ? ` · Correction: ${record.correctedQuery}`
                : ""}
            </p>
            {record.selectedResult && (
              <p>
                Intended: <span className="gurmukhi">{record.selectedResult.gurmukhi}</span>{" "}
                · {record.selectedResult.title}
              </p>
            )}
            {record.comment && <p>{record.comment}</p>}
            <small>
              {new Date(record.createdAt).toLocaleString()} · {record.appVersion} ·{" "}
              {record.platform}
            </small>
          </article>
        ))}
        {!records.length && (
          <p className="empty">
            No feedback saved yet. Search and voice correction controls will
            also add records here.
          </p>
        )}
      </div>
      <FeedbackComposer
        open={generalOpen}
        context={{ kind: "general" }}
        onSave={save}
        onClose={() => setGeneralOpen(false)}
      />
    </section>
  );
}
