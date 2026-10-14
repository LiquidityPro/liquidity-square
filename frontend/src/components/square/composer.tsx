"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LuChartColumn as ChartColumn, LuTrendingDown as TrendingDown, LuTrendingUp as TrendingUp } from "react-icons/lu";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";
import { type Author, type Stance, type TickerSummary } from "./data";
import { useCurrentAuthor } from "./use-current-author";
import { useSquare } from "./context";
import { fetchSuggested, fetchTickers, search } from "./api";
import { useMarketTape } from "./use-market-tape";
import { formatChange, formatNaira } from "@/lib/market/quotes";
import type { TapeQuote } from "@/lib/market/tape";

/* Composer                                                            */
/* ------------------------------------------------------------------ */

const LIMIT = 280;
const SUGGESTION_LIMIT = 6;

type ActiveToken = { kind: "$" | "@"; query: string; start: number };

type TickerSuggestion = {
  symbol: string;
  label: string;
  sector: string;
  price: number | null;
  changePct: number | null;
};

/** The `$ticker` or `@person` the caret is still typing, if any. */
function activeToken(value: string, caret: number): ActiveToken | null {
  const match = value.slice(0, caret).match(/(?:^|\s)([$@])([A-Za-z0-9._-]*)$/);
  if (!match) return null;
  return { kind: match[1] as "$" | "@", query: match[2], start: caret - match[2].length - 1 };
}

type ComposerProps = {
  onPost: (body: string, stance: Stance) => void;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
};

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer(
    {
      onPost,
      initialValue = "",
      placeholder = "What's moving? Tag a ticker like $DANGCEM",
      submitLabel = "Post",
      autoFocus,
    },
    ref,
  ) {
    const me = useCurrentAuthor();
    const { token } = useSquare();
    const { snapshot } = useMarketTape();
    const [fallbackQuotes, setFallbackQuotes] = useState<TapeQuote[] | null>(null);
    const fieldRef = useRef<HTMLTextAreaElement | null>(null);
    const setField = useCallback(
      (node: HTMLTextAreaElement | null) => {
        fieldRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    const [body, setBody] = useState(initialValue);
    const [stance, setStance] = useState<Stance>(null);
    const [caret, setCaret] = useState(initialValue.length);
    const [activeIndex, setActiveIndex] = useState(0);
    const [people, setPeople] = useState<Author[]>([]);
    const [peopleLoading, setPeopleLoading] = useState(false);
    const [listed, setListed] = useState<TickerSummary[]>([]);
    const [listedLoading, setListedLoading] = useState(false);
    const [closedKey, setClosedKey] = useState<string | null>(null);
    const left = LIMIT - body.length;
    const canPost = body.trim().length > 0 && left >= 0;
    const pct = Math.min(body.length / LIMIT, 1);
    const tokenAtCaret = activeToken(body, caret);

    const quotes = snapshot?.quotes?.length ? snapshot.quotes : (fallbackQuotes ?? []);

    useEffect(() => {
      if (tokenAtCaret?.kind !== "$" || quotes.length > 0) return;
      let cancelled = false;
      fetch("/api/market/tape", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { quotes?: TapeQuote[] } | null) => {
          if (!cancelled && data?.quotes?.length) setFallbackQuotes(data.quotes);
        })
        .catch((err) => console.error("Ticker suggestions failed", err));
      return () => {
        cancelled = true;
      };
    }, [tokenAtCaret?.kind, quotes.length]);

    useEffect(() => {
      if (tokenAtCaret?.kind !== "$" || !token) {
        setListed([]);
        setListedLoading(false);
        return;
      }
      let cancelled = false;
      setListed([]);
      setListedLoading(true);
      const timer = window.setTimeout(() => {
        const request = tokenAtCaret.query
          ? search(token, tokenAtCaret.query).then((result) => result.tickers)
          : fetchTickers(token, SUGGESTION_LIMIT);
        request
          .then((rows) => {
            if (!cancelled) setListed(rows);
          })
          .catch((err) => {
            console.error("Ticker suggestions failed", err);
            if (!cancelled) setListed([]);
          })
          .finally(() => {
            if (!cancelled) setListedLoading(false);
          });
      }, tokenAtCaret.query ? 180 : 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }, [token, tokenAtCaret?.kind, tokenAtCaret?.query]);

    const tickers = useMemo(() => {
      if (tokenAtCaret?.kind !== "$") return [];
      const query = tokenAtCaret.query.toUpperCase();
      const bySymbol = new Map<string, TickerSuggestion>();

      const add = (symbol: string, patch: Partial<TickerSuggestion>) => {
        const existing = bySymbol.get(symbol);
        bySymbol.set(symbol, {
          symbol,
          label: patch.label || existing?.label || symbol,
          sector: patch.sector || existing?.sector || "NGX",
          price: patch.price ?? existing?.price ?? null,
          changePct: patch.changePct ?? existing?.changePct ?? null,
        });
      };

      for (const row of listed) {
        const name = row.name?.trim();
        add(row.symbol, { label: name && name !== row.symbol ? name : row.symbol, sector: row.sector || "NGX" });
      }

      const tapeMatches = query
        ? quotes.filter((quote) => quote.symbol.includes(query))
        : [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct) || a.symbol.localeCompare(b.symbol));
      for (const quote of query ? tapeMatches : tapeMatches.slice(0, SUGGESTION_LIMIT)) {
        add(quote.symbol, { sector: quote.sector, price: quote.price, changePct: quote.changePct });
      }

      const rows = Array.from(bySymbol.values()).filter(
        (row) => !query || row.symbol.includes(query) || row.label.toUpperCase().includes(query),
      );
      if (query) {
        rows.sort(
          (a, b) => Number(!a.symbol.startsWith(query)) - Number(!b.symbol.startsWith(query)) || a.symbol.localeCompare(b.symbol),
        );
      } else if (quotes.length > 0) {
        rows.sort((a, b) => Math.abs((b.changePct ?? 0)) - Math.abs(a.changePct ?? 0) || a.symbol.localeCompare(b.symbol));
      }
      return rows.slice(0, SUGGESTION_LIMIT);
    }, [listed, quotes, tokenAtCaret]);

    useEffect(() => {
      if (tokenAtCaret?.kind !== "@" || !token) {
        setPeople([]);
        setPeopleLoading(false);
        return;
      }
      let cancelled = false;
      setPeople([]);
      setPeopleLoading(true);
      const timer = window.setTimeout(() => {
        const request = tokenAtCaret.query
          ? search(token, tokenAtCaret.query).then((result) => result.users)
          : fetchSuggested(token, SUGGESTION_LIMIT);
        request
          .then((users) => {
            if (!cancelled) setPeople(users.slice(0, SUGGESTION_LIMIT));
          })
          .catch((err) => {
            console.error("Composer suggestions failed", err);
            if (!cancelled) setPeople([]);
          })
          .finally(() => {
            if (!cancelled) setPeopleLoading(false);
          });
      }, tokenAtCaret.query ? 180 : 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }, [token, tokenAtCaret?.kind, tokenAtCaret?.query]);

    const suggestions = tokenAtCaret?.kind === "$" ? tickers : people;
    const suggestionKey = tokenAtCaret ? `${tokenAtCaret.kind}${tokenAtCaret.query}` : "";
    const menuOpen = tokenAtCaret !== null && closedKey !== suggestionKey;
    const highlighted = Math.min(activeIndex, Math.max(suggestions.length - 1, 0));

    useEffect(() => {
      setActiveIndex(0);
    }, [tokenAtCaret?.kind, tokenAtCaret?.query]);

    useLayoutEffect(() => {
      const field = fieldRef.current;
      if (!field || document.activeElement !== field) return;
      setCaret(field.selectionStart ?? field.value.length);
    }, [body]);

    function rememberCaret(element: HTMLTextAreaElement) {
      setCaret(element.selectionStart ?? element.value.length);
    }

    useEffect(() => {
      const field = fieldRef.current;
      if (!field) return;
      const sync = () => {
        if (document.activeElement !== field) return;
        setCaret(field.selectionStart ?? field.value.length);
      };
      document.addEventListener("selectionchange", sync);
      sync();
      return () => document.removeEventListener("selectionchange", sync);
    }, []);

    function submit() {
      if (!canPost) return;
      onPost(body.trim(), stance);
      setBody(initialValue);
      setStance(null);
      setCaret(initialValue.length);
    }

    function insertSuggestion(insertion: string) {
      if (!tokenAtCaret) return;
      const next = `${body.slice(0, tokenAtCaret.start)}${insertion}${body.slice(caret)}`;
      const nextCaret = tokenAtCaret.start + insertion.length;
      setBody(next);
      setCaret(nextCaret);
      requestAnimationFrame(() => {
        const field = fieldRef.current;
        if (!field) return;
        field.focus();
        field.setSelectionRange(nextCaret, nextCaret);
        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
      });
    }

    function chooseHighlighted() {
      if (tokenAtCaret?.kind === "$") {
        const quote = tickers[highlighted];
        if (quote) insertSuggestion(`$${quote.symbol} `);
        return;
      }
      const person = people[highlighted];
      if (person) insertSuggestion(`@${person.handle} `);
    }

    return (
      <div className="flex gap-3 border-b px-4 py-3">
        <Avatar author={me} />
        <div className="min-w-0 flex-1">
          <label htmlFor="square-composer" className="sr-only">
            Write a post
          </label>
          <textarea
            id="square-composer"
            ref={setField}
            value={body}
            rows={2}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "composer-suggestions" : undefined}
            aria-activedescendant={menuOpen && suggestions[highlighted] ? suggestionId(highlighted) : undefined}
            onChange={(e) => {
              setBody(e.target.value);
              rememberCaret(e.target);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onSelect={(e) => rememberCaret(e.currentTarget)}
            onKeyDown={(e) => {
              if (menuOpen && suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                const delta = e.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((index) => (index + delta + suggestions.length) % suggestions.length);
                return;
              }
              if (menuOpen && suggestions.length > 0 && (e.key === "Enter" || e.key === "Tab") && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                chooseHighlighted();
                return;
              }
              if (e.key === "Escape" && menuOpen) {
                e.preventDefault();
                setClosedKey(suggestionKey);
                return;
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            autoFocus={autoFocus}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent py-2 text-lg placeholder:text-muted-foreground focus:outline-none"
          />
          {menuOpen && (
            <ul
              id="composer-suggestions"
              role="listbox"
              aria-label={tokenAtCaret.kind === "$" ? "Tickers" : "People"}
              className="z-30 mb-2 max-h-64 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
            >
              {tokenAtCaret.kind === "$" ? (
                tickers.length > 0 ? (
                  tickers.map((quote, index) => (
                    <TickerOption
                      key={quote.symbol}
                      quote={quote}
                      index={index}
                      active={index === highlighted}
                      onHover={() => setActiveIndex(index)}
                      onPick={() => insertSuggestion(`$${quote.symbol} `)}
                    />
                  ))
                ) : (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    {listedLoading
                      ? "Loading tickers…"
                      : tokenAtCaret.query
                        ? `No tickers match $${tokenAtCaret.query}`
                        : "No tickers to suggest yet"}
                  </li>
                )
              ) : people.length > 0 ? (
                people.map((person, index) => (
                  <PersonOption
                    key={person.id ?? person.handle}
                    person={person}
                    index={index}
                    active={index === highlighted}
                    onHover={() => setActiveIndex(index)}
                    onPick={() => insertSuggestion(`@${person.handle} `)}
                  />
                ))
              ) : peopleLoading ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">Looking up people…</li>
              ) : (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {tokenAtCaret.query ? `No people match @${tokenAtCaret.query}` : "No people to mention yet"}
                </li>
              )}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex items-center gap-1" role="group" aria-label="Your stance">
              <StanceButton current={stance} value="bull" onChange={setStance} />
              <StanceButton current={stance} value="bear" onChange={setStance} />
              <button
                type="button"
                aria-label="Add poll (coming soon)"
                title="Polls — coming soon"
                className="grid size-9 place-items-center rounded-full text-primary hover:bg-primary/10"
              >
                <ChartColumn className="size-[18px]" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              {body.length > 0 && (
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke={left < 0 ? "var(--bear)" : left <= 20 ? "oklch(0.85 0.17 85)" : "var(--primary)"}
                      strokeWidth="2.5"
                      strokeDasharray={`${pct * 62.83} 62.83`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {left <= 20 && (
                    <span className={cn("font-mono text-xs", left < 0 ? "text-bear" : "text-muted-foreground")}>{left}</span>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!canPost}
                className="min-h-9 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-40 enabled:active:scale-[0.96]"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

function suggestionId(index: number) {
  return `composer-suggestion-${index}`;
}

function optionClass(active: boolean) {
  return cn(
    "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
  );
}

function TickerOption({
  quote,
  index,
  active,
  onPick,
  onHover,
}: {
  quote: TickerSuggestion;
  index: number;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const detail = quote.label !== quote.symbol ? quote.label : quote.sector;
  return (
    <li id={suggestionId(index)} role="option" aria-selected={active}>
      <button type="button" className={optionClass(active)} onMouseDown={(event) => event.preventDefault()} onMouseEnter={onHover} onClick={onPick}>
        <span className="font-semibold">${quote.symbol}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{detail}</span>
        {quote.price != null && <span className="font-mono text-xs">₦{formatNaira(quote.price)}</span>}
        {quote.changePct != null && (
          <span className={cn("font-mono text-xs", quote.changePct > 0 ? "text-primary" : quote.changePct < 0 ? "text-bear" : "text-muted-foreground")}>
            {formatChange(quote.changePct)}
          </span>
        )}
      </button>
    </li>
  );
}

function PersonOption({
  person,
  index,
  active,
  onPick,
  onHover,
}: {
  person: Author;
  index: number;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  return (
    <li id={suggestionId(index)} role="option" aria-selected={active}>
      <button type="button" className={optionClass(active)} onMouseDown={(event) => event.preventDefault()} onMouseEnter={onHover} onClick={onPick}>
        <Avatar author={person} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{person.name}</span>
          <span className="block truncate text-muted-foreground">@{person.handle}</span>
        </span>
      </button>
    </li>
  );
}

function StanceButton({
  current,
  value,
  onChange,
}: {
  current: Stance;
  value: "bull" | "bear";
  onChange: (s: Stance) => void;
}) {
  const on = current === value;
  const bull = value === "bull";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(on ? null : value)}
      className={cn(
        "label-mono flex min-h-9 items-center gap-1 rounded-full border px-3 transition active:scale-[0.96]",
        bull
          ? on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary/40 text-primary hover:bg-primary/10"
          : on
            ? "border-bear bg-bear text-primary-foreground"
            : "border-bear/40 text-bear hover:bg-bear/10",
      )}
    >
      {bull ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {bull ? "Bull" : "Bear"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
