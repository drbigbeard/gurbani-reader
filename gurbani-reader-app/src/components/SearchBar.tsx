import { useState } from "react";
import { listenForSearch, voiceSearchAvailable } from "../lib/voice-search";
import { GurmukhiKeyboard } from "./GurmukhiKeyboard";
import { Icon } from "./Icon";

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onVoice,
  notify,
  fail,
  showVoiceLanguage = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onVoice: (alternatives: string[]) => Promise<void>;
  notify: (message: string) => void;
  fail: (message: string) => void;
  showVoiceLanguage?: boolean;
}) {
  const [keyboard, setKeyboard] = useState(false);
  const [language, setLanguage] = useState<"pa-IN" | "en-GB">("pa-IN");
  const [listening, setListening] = useState(false);
  const [alternatives, setAlternatives] = useState<string[]>([]);

  async function startVoice() {
    setListening(true);
    setAlternatives([]);
    try {
      if (!(await voiceSearchAvailable()))
        throw new Error("Voice search is not available on this device.");
      const heard = await listenForSearch(language);
      if (!heard.length) throw new Error("No speech was recognised.");
      setAlternatives(heard);
      await onVoice(heard);
      notify(
        `Searched ${heard.length} recognised voice ${heard.length === 1 ? "transcript" : "alternatives"}.`,
      );
    } catch (error) {
      fail(
        error instanceof Error
          ? error.message
          : "Voice search could not start.",
      );
    } finally {
      setListening(false);
    }
  }

  return (
    <>
      <form
        className="search-row large shared-search"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <input
          aria-label="Search Gurbani"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Gurmukhi, Roman, English or first letters"
        />
        {value && (
          <button
            type="button"
            className="search-icon-button"
            aria-label="Clear search"
            onClick={() => onChange("")}
          >
            <Icon name="close" />
          </button>
        )}
        <button
          type="button"
          aria-label="Open Gurmukhi keyboard"
          title="Gurmukhi keyboard"
          className="keyboard-button"
          onClick={() => setKeyboard((current) => !current)}
        >
          ਕ
        </button>
        <button
          type="button"
          className="voice-button"
          aria-label="Voice search"
          disabled={listening}
          onClick={() => void startVoice()}
        >
          <Icon name={listening ? "graphic_eq" : "mic"} />
        </button>
        <button aria-label="Run search">
          <Icon name="search" />
        </button>
      </form>
      {showVoiceLanguage && (
        <div className="voice-options">
          <span>Voice:</span>
          <button
            className={language === "pa-IN" ? "active" : ""}
            onClick={() => setLanguage("pa-IN")}
          >
            Punjabi
          </button>
          <button
            className={language === "en-GB" ? "active" : ""}
            onClick={() => setLanguage("en-GB")}
          >
            Roman / English
          </button>
          {listening && <small>Listening…</small>}
        </div>
      )}
      {alternatives.length > 0 && (
        <div className="voice-alternatives">
          <small>Heard — every alternative was searched:</small>
          {alternatives.map((option) => (
            <button
              key={option}
              onClick={() =>
                void onVoice([
                  option,
                  ...alternatives.filter((candidate) => candidate !== option),
                ])
              }
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {keyboard && (
        <GurmukhiKeyboard
          value={value}
          onChange={onChange}
          close={() => setKeyboard(false)}
        />
      )}
    </>
  );
}
