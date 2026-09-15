"use client";

import { useEffect, useRef, useState } from "react";

export interface ResolvedAddress {
  street: string;
  postcode: string;
  city: string;
}

interface Suggestion {
  id: string;
  label: string;
}

/**
 * PDOK's Locatieserver — the Dutch government's free, keyless (CORS-open)
 * address lookup, built on the official BAG register. Replaced Google
 * Places here because a Dutch postcode already pins down a single street,
 * which is exactly the "type postcode -> pick -> street/town fill
 * themselves in" flow this is for; Places needed a paid API enabled
 * anyway and was never actually working (Places API blocked on the key).
 */
const SUGGEST_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest";
const LOOKUP_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup";

interface SuggestDoc {
  id: string;
  weergavenaam: string;
}

interface LookupDoc {
  straatnaam?: string;
  postcode?: string;
  woonplaatsnaam?: string;
}

export default function PostcodeField({
  name,
  placeholder,
  required,
  onResolved,
}: {
  name: string;
  placeholder?: string;
  required?: boolean;
  onResolved: (address: ResolvedAddress) => void;
}) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    // A Dutch postcode is 4 digits + 2 letters — not worth querying before
    // there's enough to narrow it down to a specific neighbourhood.
    if (value.replace(/\s/g, "").length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const thisRequest = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const url = `${SUGGEST_URL}?q=${encodeURIComponent(value)}&fq=type:postcode&rows=8`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("suggest failed");
        const data = await res.json();
        if (thisRequest !== requestId.current) return; // a newer keystroke won

        const docs = (data?.response?.docs ?? []) as SuggestDoc[];
        setSuggestions(docs.map((d) => ({ id: d.id, label: d.weergavenaam })));
        setOpen(docs.length > 0);
      } catch {
        if (thisRequest === requestId.current) setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value]);

  async function pick(suggestion: Suggestion) {
    setOpen(false);
    try {
      const res = await fetch(`${LOOKUP_URL}?id=${encodeURIComponent(suggestion.id)}`);
      const data = await res.json();
      const doc = data?.response?.docs?.[0] as LookupDoc | undefined;
      if (!doc?.postcode) return;

      setValue(doc.postcode);
      onResolved({
        street: doc.straatnaam ?? "",
        postcode: doc.postcode,
        city: doc.woonplaatsnaam ?? "",
      });
    } catch {
      // Nothing to fall back to here — the user can still retype and the
      // street/town fields underneath stay manually editable if this fails.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="h-12 w-full rounded-2xl border border-charcoal-600/15 bg-cream-50 px-4 text-[0.95rem] text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none"
      />

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-2xl border border-charcoal-600/15 bg-cream-50 py-1.5 shadow-lg"
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(s)}
                className="block w-full px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-ember-600/10"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
