import { useEffect, useState } from 'react';
import type { ReaderPreferences } from '../lib/persistence';

type SetPreferences = (next: ReaderPreferences | ((current: ReaderPreferences) => ReaderPreferences)) => void;
type Panel = 'appearance' | 'layers' | null;
const themes: ReaderPreferences['theme'][] = ['paper', 'sepia', 'light', 'dark', 'black'];
const themeBackground: Record<ReaderPreferences['theme'], string> = { paper: '#fbf7ed', sepia: '#f3e6cc', light: '#ffffff', dark: '#17201d', black: '#000000' };

export function TextControls({ preferences, setPreferences }: { preferences: ReaderPreferences; setPreferences: SetPreferences }) {
  const [panel, setPanel] = useState<Panel>(null);
  const adjust = (key: 'textScale' | 'transliterationScale' | 'interpretationScale', delta: number) => setPreferences(current => ({ ...current, [key]: clamp(current[key] + delta, .55, 2) }));
  useEffect(() => {
    const close = () => setPanel(null);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('gurbani:close-overlay', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('gurbani:close-overlay', close); window.removeEventListener('keydown', key); };
  }, []);
  const toggle = (next: Exclude<Panel, null>) => setPanel(current => current === next ? null : next);
  return <div className="reader-controls">
    <button className={panel === 'appearance' ? 'compact-control active' : 'compact-control'} aria-expanded={panel === 'appearance'} aria-label="Appearance" onClick={() => toggle('appearance')}>Aa</button>
    <button className={panel === 'layers' ? 'compact-control active' : 'compact-control'} aria-expanded={panel === 'layers'} onClick={() => toggle('layers')}>Layers</button>
    {panel && <div className="control-backdrop" onClick={() => setPanel(null)}><section className={`control-grid control-popover ${panel === 'layers' ? 'layers-popover' : ''}`} role="dialog" aria-modal="true" aria-label={panel === 'appearance' ? 'Appearance' : 'Reading layers'} onClick={event => event.stopPropagation()}>
      <header><b>{panel === 'appearance' ? 'Appearance' : 'Reading layers'}</b><button className="popover-close" onClick={() => setPanel(null)}>Close</button></header>
      {panel === 'appearance' ? <>
        <label className="mode-toggle"><span>View</span><select value={preferences.readerMode} onChange={event => setPreferences(current => ({ ...current, readerMode: event.target.value as ReaderPreferences['readerMode'] }))}><option value="reading">Reading — uninterrupted</option><option value="study">Study — line tools</option></select></label>
        {preferences.readerMode === 'study' && <label><input type="checkbox" checked={preferences.wordMode} onChange={event => setPreferences(current => ({ ...current, wordMode: event.target.checked }))} /> Tap individual Gurmukhi words</label>}
        <Control label="Gurmukhi" value={preferences.textScale} decrease={() => adjust('textScale', -.1)} increase={() => adjust('textScale', .1)} />
        <label>Gurmukhi weight<select value={preferences.gurmukhiWeight} onChange={event => setPreferences(current => ({ ...current, gurmukhiWeight: event.target.value as ReaderPreferences['gurmukhiWeight'] }))}><option value="normal">Normal</option><option value="bold">Bold</option></select></label>
        <Control label="Latin / English" value={preferences.transliterationScale} decrease={() => adjust('transliterationScale', -.1)} increase={() => adjust('transliterationScale', .1)} />
        <Control label="Interpretation" value={preferences.interpretationScale} decrease={() => adjust('interpretationScale', -.1)} increase={() => adjust('interpretationScale', .1)} />
        <label className="spacing-control"><span>Line spacing</span><input type="range" min="1.15" max="2.4" step="0.05" value={preferences.lineSpacing} onChange={event => setPreferences(current => ({ ...current, lineSpacing: Number(event.target.value) }))} /><b>{preferences.lineSpacing.toFixed(2)}</b></label>
        <fieldset className="theme-choices"><legend>Theme</legend>{themes.map(theme => <button className={preferences.theme === theme ? 'active' : ''} key={theme} onClick={() => setPreferences(current => ({ ...current, theme, backgroundColor: themeBackground[theme] }))}>{theme}</button>)}</fieldset>
        <label>Background colour <input type="color" value={preferences.backgroundColor} onChange={event => setPreferences(current => ({ ...current, backgroundColor: event.target.value }))} /></label>
        <label>Gurmukhi colour <input type="color" value={preferences.gurmukhiColor} onChange={event => setPreferences(current => ({ ...current, gurmukhiColor: event.target.value }))} /></label>
        <label>Latin / English colour <input type="color" value={preferences.latinColor} onChange={event => setPreferences(current => ({ ...current, latinColor: event.target.value }))} /></label>
      </> : <>
        <label><input type="checkbox" checked={preferences.showTransliteration} onChange={event => setPreferences(current => ({ ...current, showTransliteration: event.target.checked }))} /> Transliteration</label>
        <label>Transliteration source<select value={preferences.transliterationSource} onChange={event => setPreferences(current => ({ ...current, transliterationSource: event.target.value as ReaderPreferences['transliterationSource'] }))}><option value="tggsp">SikhRI / TGGSP where available</option><option value="banidb">BaniDB</option></select></label>
        <label>Translation<select value={preferences.translationSource} onChange={event => setPreferences(current => ({ ...current, translationSource: event.target.value as ReaderPreferences['translationSource'] }))}><option value="off">Off</option><option value="banidb">BaniDB</option><option value="tggsp">SikhRI / TGGSP where available</option></select></label>
        <label><input type="checkbox" checked={preferences.showWordAnalysis} onChange={event => setPreferences(current => ({ ...current, showWordAnalysis: event.target.checked }))} /> SikhRI word details</label>
        <label><input type="checkbox" checked={preferences.showProviderLayers} onChange={event => setPreferences(current => ({ ...current, showProviderLayers: event.target.checked }))} /> Commentary, transcreation & poetical dimension</label>
        <label>SikhRI language<select value={preferences.tggspLanguage} onChange={event => setPreferences(current => ({ ...current, tggspLanguage: event.target.value as ReaderPreferences['tggspLanguage'] }))}><option value="english">English</option><option value="panjabi">Panjabi</option><option value="both">Both</option></select></label>
      </>}
    </section></div>}
  </div>;
}

function Control({ label, value, decrease, increase }: { label: string; value: number; decrease: () => void; increase: () => void }) {
  return <div className="scale-control"><span>{label}</span><div><button onClick={decrease} aria-label={`Reduce ${label} size`}>−</button><b>{Math.round(value * 100)}%</b><button onClick={increase} aria-label={`Increase ${label} size`}>+</button></div></div>;
}
function clamp(value: number, min: number, max: number) { return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100; }
