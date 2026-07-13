import type { ReaderPreferences } from '../lib/persistence';

type SetPreferences = (next: ReaderPreferences | ((current: ReaderPreferences) => ReaderPreferences)) => void;
const themes: ReaderPreferences['theme'][] = ['paper', 'sepia', 'light', 'dark', 'black'];
const themeBackground: Record<ReaderPreferences['theme'], string> = { paper: '#fbf7ed', sepia: '#f3e6cc', light: '#ffffff', dark: '#17201d', black: '#000000' };

export function TextControls({ preferences, setPreferences }: { preferences: ReaderPreferences; setPreferences: SetPreferences }) {
  const adjust = (key: 'textScale' | 'transliterationScale' | 'interpretationScale', delta: number) => setPreferences(current => ({ ...current, [key]: clamp(current[key] + delta, .55, 2) }));
  return <details className="text-controls"><summary>Appearance & reading mode</summary><div className="control-grid">
    <label className="mode-toggle"><span>View</span><select value={preferences.readerMode} onChange={event => setPreferences(current => ({ ...current, readerMode: event.target.value as ReaderPreferences['readerMode'] }))}><option value="reading">Reading — uninterrupted</option><option value="study">Study — line tools</option></select></label>
    <label><input type="checkbox" checked={preferences.showTransliteration} onChange={event => setPreferences(current => ({ ...current, showTransliteration: event.target.checked }))} /> Show BaniDB transliteration</label>
    <label><input type="checkbox" checked={preferences.showProviderLayers} onChange={event => setPreferences(current => ({ ...current, showProviderLayers: event.target.checked }))} /> Show TGGSP sections when available</label>
    {preferences.readerMode === 'study' && <label><input type="checkbox" checked={preferences.wordMode} onChange={event => setPreferences(current => ({ ...current, wordMode: event.target.checked }))} /> Tap individual Gurmukhi words</label>}
    <Control label="Gurmukhi" value={preferences.textScale} decrease={() => adjust('textScale', -.1)} increase={() => adjust('textScale', .1)} />
    <Control label="Latin / English" value={preferences.transliterationScale} decrease={() => adjust('transliterationScale', -.1)} increase={() => adjust('transliterationScale', .1)} />
    <Control label="Interpretation" value={preferences.interpretationScale} decrease={() => adjust('interpretationScale', -.1)} increase={() => adjust('interpretationScale', .1)} />
    <label className="spacing-control"><span>Line spacing</span><input type="range" min="1.15" max="2.4" step="0.05" value={preferences.lineSpacing} onChange={event => setPreferences(current => ({ ...current, lineSpacing: Number(event.target.value) }))} /><b>{preferences.lineSpacing.toFixed(2)}</b></label>
    <fieldset className="theme-choices"><legend>Theme</legend>{themes.map(theme => <button className={preferences.theme === theme ? 'active' : ''} key={theme} onClick={() => setPreferences(current => ({ ...current, theme, backgroundColor: themeBackground[theme] }))}>{theme}</button>)}</fieldset>
    <label>Background colour <input type="color" value={preferences.backgroundColor} onChange={event => setPreferences(current => ({ ...current, backgroundColor: event.target.value }))} /></label>
    <label>Gurmukhi colour <input type="color" value={preferences.gurmukhiColor} onChange={event => setPreferences(current => ({ ...current, gurmukhiColor: event.target.value }))} /></label>
    <label>Latin / English colour <input type="color" value={preferences.latinColor} onChange={event => setPreferences(current => ({ ...current, latinColor: event.target.value }))} /></label>
  </div></details>;
}

function Control({ label, value, decrease, increase }: { label: string; value: number; decrease: () => void; increase: () => void }) {
  return <div className="scale-control"><span>{label}</span><div><button onClick={decrease} aria-label={`Reduce ${label} size`}>−</button><b>{Math.round(value * 100)}%</b><button onClick={increase} aria-label={`Increase ${label} size`}>+</button></div></div>;
}
function clamp(value: number, min: number, max: number) { return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100; }
