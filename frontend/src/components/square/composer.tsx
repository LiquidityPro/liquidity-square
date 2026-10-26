"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LuChartColumn as ChartColumn, LuClock as Clock, LuFileText as FileText, LuTrendingDown as TrendingDown, LuTrendingUp as TrendingUp } from "react-icons/lu";
import { toast } from "sonner";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";
import { type Author, type QuotedPost, type Stance, type TickerSummary } from "./data";
import { deleteDraft, fetchDrafts, saveDraft, type PollDraft, type SavedDraft } from "./api";
import { useCurrentAuthor } from "./use-current-author";
import { useSquare } from "./context";
import { fetchSuggested, fetchTickers, search } from "./api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DraftList, takeRememberedDraft } from "./drafts";
import { useMarketTape } from "./use-market-tape";
import { formatNaira } from "@/lib/market/quotes";
import { PriceChange } from "./price-change";
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

const EMPTY_POLL: { label: string; stance: Stance }[] = [
  { label: "Bullish", stance: "bull" },
  { label: "Bearish", stance: "bear" },
];

type ComposerProps = {
  onPost: (body: string, stance: Stance, extras?: { poll?: PollDraft | null }) => void;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  allowPoll?: boolean;
  quoted?: QuotedPost | null;
  fieldId?: string;
  /** Keep unsent text as a draft, and allow scheduling. */
  persistDrafts?: boolean;
  /** Put the latest unsent draft back in the field. */
  restoreDraft?: boolean;
  /** Pin the composer to the bottom of a locked column. */
  docked?: boolean;
  /** Marks the home composer for the first-run tour. */
  tourAnchor?: string;
};

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(
  function Composer(
    {
      onPost,
      initialValue = "",
      placeholder = "What's moving? Tag a ticker like $DANGCEM",
      submitLabel = "Post",
      autoFocus,
      allowPoll = true,
      quoted,
      fieldId = "square-composer",
      persistDrafts = false,
      restoreDraft = false,
      docked = false,
      tourAnchor,
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
    const [pollOn, setPollOn] = useState(false);
    const [pollOptions, setPollOptions] = useState(EMPTY_POLL);
    const [caret, setCaret] = useState(initialValue.length);
    const [activeIndex, setActiveIndex] = useState(0);
    const [people, setPeople] = useState<Author[]>([]);
    const [peopleLoading, setPeopleLoading] = useState(false);
    const [listed, setListed] = useState<TickerSummary[]>([]);
    const [listedLoading, setListedLoading] = useState(false);
    const [closedKey, setClosedKey] = useState<string | null>(null);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [scheduleAt, setScheduleAt] = useState("");
    const [draftsOpen, setDraftsOpen] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const draftIdRef = useRef<string | null>(null);
    const detachRef = useRef(false);
    const saveGen = useRef(0);
    const bodyRef = useRef(body);
    bodyRef.current = body;
    const left = LIMIT - body.length;
    const pollReady =
      !pollOn ||
      (pollOptions.length >= 2 &&
        pollOptions.every((option) => {
          const label = option.label.trim();
          return label.length > 0 && label.length <= 40;
        }));
    const canPost = body.trim().length > 0 && left >= 0 && pollReady;
    const pct = Math.min(body.length / LIMIT, 1);
    const tokenAtCaret = activeToken(body, caret);

    function pollPayload(): PollDraft | null {
      if (!pollOn) return null;
      return { options: pollOptions.map((option) => ({ label: option.label.trim(), stance: option.stance })) };
    }

    function scheduledIso() {
      if (!scheduleAt) return null;
      const when = new Date(scheduleAt);
      if (Number.isNaN(when.getTime())) return null;
      const lead = when.getTime() - Date.now();
      if (lead < 60_000 || lead > 1000 * 60 * 60 * 24 * 365) return null;
      return when.toISOString();
    }

    function loadDraft(draft: SavedDraft) {
      detachRef.current = false;
      draftIdRef.current = draft.id;
      setBody(draft.body);
      setStance(draft.stance);
      setPollOn(!!draft.poll);
      setPollOptions(
        draft.poll
          ? draft.poll.options.map((option) => ({ label: option.label, stance: option.stance === "bear" ? "bear" : "bull" }))
          : EMPTY_POLL,
      );
      if (draft.scheduledFor) {
        setScheduleOpen(true);
        setScheduleAt(toLocalInput(new Date(draft.scheduledFor)));
      } else {
        setScheduleOpen(false);
        setScheduleAt("");
      }
      setDraftsOpen(false);
    }

    useEffect(() => {
      if (!persistDrafts) return;
      const remembered = restoreDraft ? takeRememberedDraft() : null;
      if (remembered) {
        loadDraft(remembered);
        return;
      }
      if (!restoreDraft || !token) return;
      let cancelled = false;
      fetchDrafts(token)
        .then((rows) => {
          if (cancelled || detachRef.current || bodyRef.current.trim() !== initialValue.trim()) return;
          const open = rows.find((row) => !row.scheduledFor);
          if (open) loadDraft(open);
        })
        .catch((err) => console.error("Draft restore failed", err));
      return () => {
        cancelled = true;
      };
      // Restore once when the composer is ready to keep drafts.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [persistDrafts, restoreDraft, token]);

    useEffect(() => {
      if (!persistDrafts || !token) return;
      if (detachRef.current) {
        if (body.trim() === initialValue.trim()) return;
        detachRef.current = false;
      }
      const timer = window.setTimeout(() => {
        const generation = saveGen.current;
        const text = body.trim();
        const worthSaving = text.length > 0 && text !== initialValue.trim() && pollReady;
        if (!worthSaving) {
          if (draftIdRef.current) {
            const id = draftIdRef.current;
            draftIdRef.current = null;
            void deleteDraft(token, id).catch(() => undefined);
          }
          return;
        }
        void saveDraft(token, {
          id: draftIdRef.current,
          body: text,
          stance,
          poll: pollPayload(),
          scheduledFor: scheduledIso(),
        })
          .then((saved) => {
            if (saveGen.current === generation && !detachRef.current) draftIdRef.current = saved.id;
          })
          .catch((err) => console.error("Draft save failed", err));
      }, 800);
      return () => window.clearTimeout(timer);
    }, [persistDrafts, token, body, stance, pollOn, pollOptions, pollReady, initialValue, scheduleAt]);

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

    function clearComposer() {
      saveGen.current += 1;
      detachRef.current = true;
      draftIdRef.current = null;
      setBody(initialValue);
      setStance(null);
      setPollOn(false);
      setPollOptions(EMPTY_POLL);
      setCaret(initialValue.length);
      setScheduleAt("");
      setScheduleOpen(false);
    }

    function submit() {
      if (!canPost) return;
      const id = draftIdRef.current;
      if (token && id) void deleteDraft(token, id).catch(() => undefined);
      onPost(body.trim(), stance, pollOn ? { poll: pollPayload()! } : undefined);
      clearComposer();
    }

    async function confirmSchedule() {
      if (!canPost || !token) return;
      const when = scheduledIso();
      if (!when) {
        toast.error("Pick a time at least a minute from now.");
        return;
      }
      saveGen.current += 1;
      setSavingDraft(true);
      try {
        await saveDraft(token, {
          id: draftIdRef.current,
          body: body.trim(),
          stance,
          poll: pollPayload(),
          scheduledFor: when,
        });
        clearComposer();
        toast.success("Scheduled. It will post on its own.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't schedule that post");
      } finally {
        setSavingDraft(false);
      }
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
      <>
      <div data-tour={tourAnchor} className={cn("flex gap-3 bg-background px-4 py-3", docked ? "shrink-0 border-t" : "border-b")}>
        <Avatar author={me} />
        <div className="min-w-0 flex-1">
          {quoted && (
            <div className="mb-2 rounded-xl border px-3 py-2 text-sm">
              <p className="font-semibold">
                {quoted.author.name} <span className="font-mono text-xs font-normal text-muted-foreground">@{quoted.author.handle}</span>
              </p>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{quoted.body}</p>
            </div>
          )}
          <label htmlFor={fieldId} className="sr-only">
            Write a post
          </label>
          <textarea
            id={fieldId}
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
          {scheduleOpen && (
            <label className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Post at</span>
              <input
                type="datetime-local"
                value={scheduleAt}
                min={toLocalInput(new Date(Date.now() + 60_000))}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="h-9 rounded-full border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          )}
          {pollOn && (
            <div className="mb-3 space-y-2">
              <p className="text-xs text-muted-foreground">Tag a ticker in the post so votes move that name's bar.</p>
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={option.label}
                    maxLength={40}
                    aria-label={`Poll option ${index + 1}`}
                    onChange={(event) =>
                      setPollOptions((current) =>
                        current.map((row, rowIndex) => (rowIndex === index ? { ...row, label: event.target.value } : row)),
                      )
                    }
                    className="min-h-9 min-w-0 flex-1 rounded-full border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <select
                    aria-label={`Stance for option ${index + 1}`}
                    value={option.stance ?? ""}
                    onChange={(event) => {
                      const next = event.target.value;
                      setPollOptions((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, stance: next === "bull" || next === "bear" ? next : null } : row,
                        ),
                      );
                    }}
                    className="h-9 rounded-full border bg-transparent px-2 text-xs"
                  >
                    <option value="bull">Bull</option>
                    <option value="bear">Bear</option>
                    <option value="">Watching</option>
                  </select>
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() => setPollOptions((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                      className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((current) => [...current, { label: "", stance: null }])}
                  className="text-sm font-semibold text-primary"
                >
                  Add option
                </button>
              )}
            </div>
          )}
          <div className="flex flex-nowrap items-center justify-between gap-1.5 border-t pt-3 sm:gap-2">
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-1" role="group" aria-label="Your stance">
              <StanceButton current={stance} value="bull" onChange={setStance} />
              <StanceButton current={stance} value="bear" onChange={setStance} />
              {allowPoll && (
                <button
                  type="button"
                  aria-pressed={pollOn}
                  aria-label={pollOn ? "Remove poll" : "Add poll"}
                  title="Poll"
                  onClick={() => setPollOn((open) => !open)}
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10 sm:size-9",
                    pollOn && "bg-primary/10",
                  )}
                >
                  <ChartColumn className="size-3.5 sm:size-[18px]" />
                </button>
              )}
              {persistDrafts && (
                <>
                  <button
                    type="button"
                    aria-label="Drafts"
                    title="Drafts"
                    onClick={() => setDraftsOpen(true)}
                    className="grid size-7 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10 sm:size-9"
                  >
                    <FileText className="size-3.5 sm:size-[18px]" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={scheduleOpen}
                    aria-label={scheduleOpen ? "Hide schedule" : "Schedule post"}
                    title="Schedule"
                    onClick={() => setScheduleOpen((open) => !open)}
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10 sm:size-9",
                      scheduleOpen && "bg-primary/10",
                    )}
                  >
                    <Clock className="size-3.5 sm:size-[18px]" />
                  </button>
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              {body.length > 0 && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <svg viewBox="0 0 24 24" className="size-5 -rotate-90 sm:size-6" aria-hidden="true">
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
                onClick={() => {
                  if (scheduleAt) void confirmSchedule();
                  else submit();
                }}
                disabled={!canPost || savingDraft || (!!scheduleAt && !scheduledIso())}
                className="h-7 shrink-0 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-40 enabled:active:scale-[0.96] sm:h-9 sm:px-5 sm:text-sm"
              >
                {scheduleAt ? "Schedule" : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      {persistDrafts && (
        <Dialog open={draftsOpen} onOpenChange={setDraftsOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Drafts</DialogTitle>
            </DialogHeader>
            <DraftList onEdit={loadDraft} />
          </DialogContent>
        </Dialog>
      )}
      </>
    );
  },
);

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
        {quote.changePct != null && <PriceChange changePct={quote.changePct} className="font-mono text-xs" />}
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
        "label-mono flex h-7 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.62rem] transition active:scale-[0.96] sm:h-9 sm:px-3 sm:text-[0.72rem]",
        bull
          ? on
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary/40 text-primary hover:bg-primary/10"
          : on
            ? "border-bear bg-bear text-primary-foreground"
            : "border-bear/40 text-bear hover:bg-bear/10",
      )}
    >
      {bull ? <TrendingUp className="size-3 sm:size-3.5" /> : <TrendingDown className="size-3 sm:size-3.5" />}
      {bull ? "Bull" : "Bear"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
