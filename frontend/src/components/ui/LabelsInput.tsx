import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';

export function LabelsInput({
  labels,
  onChange,
  readOnly,
}: {
  labels: string[];
  onChange: (labels: string[]) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState('');

  function addLabel() {
    const value = draft.trim();
    if (value && !labels.includes(value) && labels.length < 10) {
      onChange([...labels, value]);
    }
    setDraft('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addLabel();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs"
        >
          {label}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange(labels.filter((l) => l !== label))}
              className="text-brand-400 hover:text-brand-700"
              aria-label={`Remove label ${label}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          className="input flex-1 min-w-32 !py-1"
          placeholder="Add a label, press Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addLabel}
        />
      )}
      {readOnly && labels.length === 0 && <span className="text-slate-400 text-xs">None</span>}
    </div>
  );
}
