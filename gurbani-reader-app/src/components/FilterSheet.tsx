import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export interface FilterOption {
  value: string;
  label: string;
  detail?: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

export function FilterButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button className="filter-button" onClick={onClick} aria-label={`Filters${count ? `, ${count} active` : ""}`}>
      <Icon name="filter_list" /> Filters {count > 0 && <b>{count}</b>}
    </button>
  );
}

export function FilterSheet({
  open,
  title,
  groups,
  selected,
  sortOptions,
  sort,
  onApply,
  onClose,
  onSetDefault,
  onResetDefault,
}: {
  open: boolean;
  title: string;
  groups: FilterGroup[];
  selected: Record<string, string[]>;
  sortOptions?: FilterOption[];
  sort?: string;
  onApply: (selected: Record<string, string[]>, sort?: string) => void;
  onClose: () => void;
  onSetDefault: (selected: Record<string, string[]>, sort?: string) => void;
  onResetDefault: () => void;
}) {
  const [draft, setDraft] = useState(selected);
  const [draftSort, setDraftSort] = useState(sort);
  useEffect(() => {
    if (!open) return;
    setDraft(selected);
    setDraftSort(sort);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    window.addEventListener("gurbani:close-overlay", close);
    return () => window.removeEventListener("gurbani:close-overlay", close);
  }, [onClose, open]);
  if (!open) return null;
  const toggle = (group: string, value: string) =>
    setDraft((current) => ({
      ...current,
      [group]: current[group]?.includes(value)
        ? current[group].filter((item) => item !== value)
        : [...(current[group] ?? []), value],
    }));
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="filter-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <small>Filter and sort</small>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close filters" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="filter-sheet-body">
          {groups.map((group) => (
            <fieldset key={group.id}>
              <legend>{group.label}</legend>
              <div className="check-list">
                {group.options.map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={draft[group.id]?.includes(option.value) ?? false}
                      onChange={() => toggle(group.id, option.value)}
                    />
                    <span>{option.label}{option.detail && <small>{option.detail}</small>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {sortOptions?.length ? (
            <fieldset>
              <legend>Sort by</legend>
              <div className="check-list">
                {sortOptions.map((option) => (
                  <label key={option.value}>
                    <input type="radio" name={`${title}-sort`} checked={draftSort === option.value} onChange={() => setDraftSort(option.value)} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
        <footer>
          <button className="text-button" onClick={() => setDraft(Object.fromEntries(groups.map((group) => [group.id, []])))}>
            Clear all
          </button>
          <button className="text-button" onClick={onResetDefault}>Reset to default</button>
          <button className="text-button" onClick={() => onSetDefault(draft, draftSort)}>Set as default</button>
          <button onClick={() => onApply(draft, draftSort)}>Show results</button>
        </footer>
      </section>
    </div>
  );
}
