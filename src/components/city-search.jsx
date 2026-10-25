"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitySearch } from "@/hooks/use-city-search";

function resultSecondary(result) {
  return [result.admin1, result.country]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(" · ");
}

export function CitySearch({
  onSelect,
  onQueryChange,
  autoFocus = false,
  compact = false,
  className,
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listId = useId();
  const inputId = useId();
  const { status, results, error, retry, query: searchedQuery } = useCitySearch(query);
  const showResults = status === "success" && results.length > 0;
  const showEmpty = status === "success" && results.length === 0;
  const hasQuery = query.trim().length > 0;
  const resolvedActiveIndex =
    activeIndex >= 0 && activeIndex < results.length ? activeIndex : -1;

  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  function choose(result) {
    setQuery("");
    onSelect(result);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && (resolvedActiveIndex >= 0 || results.length === 1)) {
      event.preventDefault();
      choose(results[resolvedActiveIndex >= 0 ? resolvedActiveIndex : 0]);
    } else if (event.key === "Escape" && hasQuery) {
      event.preventDefault();
      setQuery("");
      setActiveIndex(-1);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (results[resolvedActiveIndex >= 0 ? resolvedActiveIndex : 0]) {
      choose(results[resolvedActiveIndex >= 0 ? resolvedActiveIndex : 0]);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <form role="search" onSubmit={handleSubmit} className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search for a city or town
        </label>
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border border-outline-variant bg-card px-4 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_18%,transparent)]",
            compact ? "min-h-12" : "min-h-14 md:min-h-16",
          )}
        >
          <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            role="combobox"
            aria-expanded={showResults}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              showResults && resolvedActiveIndex >= 0 ? `${listId}-${resolvedActiveIndex}` : undefined
            }
            aria-describedby={`${inputId}-help`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            enterKeyHint="search"
            autoFocus={autoFocus}
            placeholder="Search for a city or town"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent py-3 text-base text-foreground outline-none placeholder:text-muted-foreground",
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
          {status === "loading" ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-5 shrink-0 animate-spin text-muted-foreground"
            />
          ) : null}
          {hasQuery && status !== "loading" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4.5" />
            </button>
          ) : (
            <span
              className={cn(
                "hidden shrink-0 rounded-full border border-outline-variant px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:block",
              )}
            >
              Places
            </span>
          )}
        </div>
        <p id={`${inputId}-help`} className="sr-only">
          Type at least two characters, then use the arrow keys to review results and Enter to
          choose a place.
        </p>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {status === "loading" && searchedQuery.length >= 2
          ? `Searching for ${searchedQuery}`
          : showResults
            ? `${results.length} places found`
            : showEmpty
              ? `No places found for ${searchedQuery}`
              : ""}
      </p>

      {showResults ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Place search results"
          className="mt-2 overflow-hidden rounded-2xl border border-outline-variant bg-card p-1.5 shadow-[var(--shadow-soft)]"
        >
          {results.map((result, index) => {
            const secondary = resultSecondary(result);
            const isActive = resolvedActiveIndex === index;
            return (
              <li
                key={`${result.id}-${result.latitude}-${result.longitude}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(result)}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  isActive ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full",
                    isActive ? "bg-card/55" : "bg-surface-container",
                  )}
                >
                  <MapPin aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{result.name}</span>
                  {secondary ? (
                    <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
                  ) : null}
                </span>
                {result.country_code ? (
                  <span className="hidden rounded-md bg-surface-container px-1.5 py-0.5 text-[0.6rem] font-bold tracking-[0.12em] text-muted-foreground sm:block">
                    {result.country_code}
                  </span>
                ) : null}
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />
              </li>
            );
          })}
        </ul>
      ) : null}

      {showEmpty ? (
        <div className="mt-3 rounded-2xl border border-dashed border-outline-variant px-4 py-5 text-sm">
          <p className="font-semibold">No places found for “{searchedQuery}”</p>
          <p className="mt-1 text-muted-foreground">
            Try a nearby town, a different spelling, or a larger nearby city.
          </p>
        </div>
      ) : null}

      {status === "error" ? (
        <div role="alert" className="mt-3 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4 text-sm">
          <p className="font-semibold text-destructive">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 rounded-full px-3 py-1.5 font-semibold text-primary hover:bg-primary-container"
          >
            Try search again
          </button>
        </div>
      ) : null}

      {hasQuery && query.trim().length === 1 && status === "idle" ? (
        <p className="mt-3 px-1 text-sm text-muted-foreground">
          Add one more character to search.
        </p>
      ) : null}
    </div>
  );
}
