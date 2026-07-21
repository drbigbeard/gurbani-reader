import type { ReactNode } from "react";
import type { Screen } from "../types";
import { Icon } from "./Icon";

const items: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "search", label: "Search", icon: "search" },
  { id: "browse", label: "Read", icon: "menu_book" },
  { id: "saved", label: "Library", icon: "library_books" },
];

export function Chrome({
  active,
  onNavigate,
  onBack,
  children,
}: {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  children: ReactNode;
}) {
  const root = items.some((item) => item.id === active);
  return (
    <div className={`app-shell screen-${active}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="gurmukhi brand-mark" aria-hidden="true">ਸ</span>
          <strong>Shabad Sojhi</strong>
          <small>Read · Find · Understand Gurbani</small>
        </div>
        {active !== "settings" && (
          <button
            className="settings-button"
            aria-label="Settings"
            onClick={() => onNavigate("settings")}
          >
            <Icon name="settings" /> Settings
          </button>
        )}
        {!root && (
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
        )}
        <nav aria-label="Primary navigation">
          {items.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? "active" : ""}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <header className="mobile-app-bar">
          {!root ? (
            <button className="mobile-back" aria-label="Back" onClick={onBack}>
              <Icon name="arrow_back" />
            </button>
          ) : (
            <span />
          )}
          {active !== "settings" ? (
            <button
              className="mobile-settings"
              aria-label="Settings"
              onClick={() => onNavigate("settings")}
            >
              <Icon name="settings" />
            </button>
          ) : <span />}
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Primary navigation">
        {items.map((item) => (
          <button
            key={item.id}
            className={active === item.id ? "active" : ""}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} />
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
