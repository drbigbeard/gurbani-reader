import type { ProviderLayer } from '../types';

const labels: Record<string, string> = {
  reference_gurmukhi: 'Reference Gurmukhi', transliteration: 'Transcription',
  literal_translation_pa: 'Literal translation · Panjabi', literal_translation_en: 'Literal translation · English',
  interpretive_transcreation_pa: 'Interpretive transcreation · Panjabi', interpretive_transcreation_en: 'Interpretive transcreation · English',
  commentary_pa: 'Commentary · Panjabi', commentary_en: 'Commentary · English',
  poetical_dimension_pa: 'Poetical dimension · Panjabi', poetical_dimension_en: 'Poetical dimension · English'
};
const order = Object.keys(labels);

export function ProviderLayers({ layers, visibility, setVisibility, scale = 1 }: {
  layers: ProviderLayer[]; visibility: Record<string, boolean>;
  setVisibility: (contentType: string, visible: boolean) => void; scale?: number;
}) {
  if (!layers.length) return <p className="empty">No TGGSP analysis is mapped to this Sabad.</p>;
  const available = new Set(layers.map(layer => layer.contentType));
  const shown = layers.filter(layer => visibility[layer.contentType]);
  return <section className="provider-layers"><header><div><span className="eyebrow">Research & interpretation</span><h2>The Guru Granth Sahib Project</h2><small>Used with permission · SikhRI</small></div></header>
    <details className="layer-picker"><summary>Choose visible sections ({shown.length})</summary><div>{order.map(type => <label key={type} className={!available.has(type) ? 'unavailable' : ''}><input type="checkbox" disabled={!available.has(type)} checked={available.has(type) && Boolean(visibility[type])} onChange={event => setVisibility(type, event.target.checked)} />{labels[type]}</label>)}</div></details>
    {shown.map(layer => <details className="provider-layer" key={layer.id} open><summary><strong>{labels[layer.contentType] ?? humanise(layer.contentType)}</strong></summary><div className={layer.contentType.endsWith('_pa') || layer.contentType === 'reference_gurmukhi' ? 'gurmukhi provider-body' : 'provider-body'} style={{ fontSize: `${scale}em` }}><ProviderContent content={layer.content} /></div></details>)}
    {!shown.length && <p className="empty">Select one or more available sections above.</p>}
  </section>;
}

function ProviderContent({ content }: { content: string }) {
  try { const parsed = JSON.parse(content) as Record<string, unknown>; const fields = Object.entries(parsed).filter(([, value]) => typeof value === 'string' && value.trim()); return <dl className="provider-fields">{fields.map(([key, value]) => <div key={key}><dt>{humanise(key)}</dt><dd>{plainText(String(value))}</dd></div>)}</dl>; }
  catch { return <p>{plainText(content)}</p>; }
}
function humanise(value: string) { return value.replaceAll(/([A-Z])/g, ' $1').replaceAll('_', ' ').trim(); }
function plainText(content: string) { if (typeof DOMParser === 'undefined') return content.replace(/<[^>]*>/gu, ' '); return new DOMParser().parseFromString(content, 'text/html').body.textContent?.replace(/\s+/gu, ' ').trim() ?? ''; }
