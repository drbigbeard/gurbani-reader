import type { ReactNode } from 'react';
import type { CorpusInfo } from '../types';

export function DataFooter({ info }: { info: CorpusInfo | null }) {
  return <footer className="data-footer"><p>Text data: BaniDB · Interpretation and research: The Guru Granth Sahib Project, SikhRI — used with permission.</p>
    <details><summary>Available offline · data details</summary><p>{info ? `${info.lineCount.toLocaleString()} source lines · ${info.occurrenceCount.toLocaleString()} indexed word occurrences` : 'Opening local data…'}</p></details></footer>;
}

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return <header className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}

export function EmptyMetric({ label, value }: { label: string; value: number | string | null }) {
  return <div className="metric"><strong>{value ?? '—'}</strong><span>{label}</span></div>;
}
