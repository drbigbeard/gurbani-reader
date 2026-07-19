import type { ReactNode } from 'react';
import type { Screen } from '../types';

const items: Array<{ id: Screen; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '⌂' }, { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'browse', label: 'Read', icon: '☷' }, { id: 'saved', label: 'Library', icon: '♡' }
];

export function Chrome({ active, onNavigate, onBack, children }: {
  active: Screen; onNavigate: (screen: Screen) => void; onBack: () => void; children: ReactNode;
}) {
  const root = items.some(item => item.id === active);
  return <div className={`app-shell screen-${active}`}>
    <aside className="sidebar">
      <div className="brand"><span className="gurmukhi brand-mark">ੴ</span><strong>Gurbani Reader</strong><small>Read · understand · explore</small></div>
      {!root && <button className="back-button" onClick={onBack}>← Back</button>}
      <nav aria-label="Primary navigation">{items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
    </aside>
    <main>{!root && <button className="mobile-back" onClick={onBack}>← Back</button>}{children}</main>
    <nav className="mobile-nav" aria-label="Primary navigation">{items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></button>)}</nav>
  </div>;
}
