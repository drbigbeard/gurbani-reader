const rows = [
  ['ੳ','ਅ','ੲ','ਸ','ਹ','ਕ','ਖ','ਗ','ਘ','ਙ'],
  ['ਚ','ਛ','ਜ','ਝ','ਞ','ਟ','ਠ','ਡ','ਢ','ਣ'],
  ['ਤ','ਥ','ਦ','ਧ','ਨ','ਪ','ਫ','ਬ','ਭ','ਮ'],
  ['ਯ','ਰ','ਲ','ਵ','ੜ','ਸ਼','ਖ਼','ਗ਼','ਜ਼','ਫ਼'],
  ['ਾ','ਿ','ੀ','ੁ','ੂ','ੇ','ੈ','ੋ','ੌ','ੰ','ਂ','ੱ','੍']
];

export function GurmukhiKeyboard({ value, onChange, close }: { value: string; onChange: (value: string) => void; close: () => void }) {
  const append = (letter: string) => onChange(value + letter);
  return <section className="gurmukhi-keyboard" aria-label="Gurmukhi keyboard"><header><strong>ਗੁਰਮੁਖੀ keyboard</strong><button type="button" onClick={close}>Done</button></header>
    {rows.map((row, index) => <div className="keyboard-row" key={index}>{row.map(letter => <button type="button" className="gurmukhi" key={letter} onClick={() => append(letter)}>{letter}</button>)}</div>)}
    <div className="keyboard-actions"><button type="button" onClick={() => append(' ')}>Space</button><button type="button" onClick={() => onChange([...value].slice(0, -1).join(''))}>Delete</button><button type="button" onClick={() => onChange('')}>Clear</button></div>
  </section>;
}
