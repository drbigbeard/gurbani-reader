import type { ReactNode } from 'react';
import type { Screen } from '../types';

const items: Array<{ id: Screen; label: string }> = [
  { id: 'home', label: 'Home' }, { id: 'read', label: 'Read' }, { id: 'search', label: 'Search' },
  { id: 'browse', label: 'Browse' }, { id: 'saved', label: 'Saved' }
];

export function Chrome({ active, onNavigate, onBack, children }: {
  active: Screen; onNavigate: (screen: Screen) => void; onBack: () => void; children: ReactNode;
}) {
  const root = items.some(item => item.id === active);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="gurmukhi brand-mark">ੴ</span><strong>Gurbani Reader</strong><small>Read · understand · explore</small></div>
      {!root && <button className="back-button" onClick={onBack}>← Back</button>}
      <nav aria-label="Primary navigation">{items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.label}</button>)}</nav>
    </aside>
    <main>{!root && <button className="mobile-back" onClick={onBack}>← Back</button>}{children}</main>
    <nav className="mobile-nav" aria-label="Primary navigation">{items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.label}</button>)}</nav>
  </div>;
}
