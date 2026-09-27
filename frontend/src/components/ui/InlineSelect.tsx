import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

export type InlineSelectOption = {
  value: string;
  // Plain text used for search matching, and as the fallback display if
  // `render` isn't given.
  label: string;
  render?: ReactNode;
};

// A JIRA-style field: the current value sits flush with the surrounding
// text (no border, no permanent dropdown arrow) until hovered, and clicking
// it opens a small searchable popover instead of a plain native <select>'s
// always-expanded option list. `search`/`onSearchChange` are optional - pass
// both to make the search box server-driven (e.g. querying an API as the
// user types) instead of filtering `options` locally.
export function InlineSelect({
  value,
  options,
  onChange,
  placeholder = 'None',
  disabled = false,
  allowClear = false,
  clearLabel = 'None',
  search,
  onSearchChange,
  loading = false,
  selectedLabel,
  variant = 'flush',
}: {
  value: string;
  options: InlineSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  search?: string;
  onSearchChange?: (query: string) => void;
  loading?: boolean;
  // Overrides how the closed state renders, instead of looking `value` up
  // in `options`. Needed whenever `options` is a live, changing result set
  // (server search) rather than a fixed list - the option that was picked
  // a moment ago may no longer be in the current `options` array (the
  // search text has since changed), but the box should still show what's
  // actually selected.
  selectedLabel?: ReactNode;
  // 'flush' (default): no visible border, just a hover highlight - for a
  // field sitting on its own in a sidebar/details card, matching Jira.
  // 'bordered': looks like the app's other form inputs (a visible border) -
  // for a field sitting inline among Input/Select components in a form,
  // where a borderless field would look broken rather than intentional.
  variant?: 'flush' | 'bordered';
}) {
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isServerSearch = onSearchChange != null;
  const query = isServerSearch ? (search ?? '') : localQuery;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setLocalQuery('');
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = isServerSearch
    ? options
    : options.filter((o) => o.label.toLowerCase().includes(localQuery.toLowerCase()));

  function select(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  const closedContent = selectedLabel ?? selected?.render ?? selected?.label ?? (
    <span className="text-slate-400">{placeholder}</span>
  );
  const boxClasses =
    variant === 'bordered'
      ? 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2'
      : 'py-1.5 px-1 rounded';

  if (disabled) {
    return <div className={boxClasses}>{closedContent}</div>;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left hover:bg-slate-100 transition-colors ${boxClasses}`}
      >
        {closedContent}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 max-w-[80vw] bg-white border border-slate-200 rounded-md shadow-lg z-30">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              className="flex-1 text-sm outline-none placeholder:text-slate-400"
              placeholder="Search…"
              value={query}
              onChange={(e) => {
                if (isServerSearch) onSearchChange(e.target.value);
                else setLocalQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {allowClear && (
              <button
                type="button"
                onClick={() => select('')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-slate-500 hover:bg-slate-50"
              >
                {clearLabel}
              </button>
            )}
            {loading && <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">No matches</p>
            )}
            {!loading &&
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-50 ${
                    o.value === value ? 'bg-brand-50 text-brand-700' : 'text-slate-700'
                  }`}
                >
                  {o.render ?? o.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
