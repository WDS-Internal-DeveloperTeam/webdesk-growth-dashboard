"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ApiSuccessResponse, UserSummary } from "@webdesk/shared-types";
import { parseApiErrorMessage } from "@/lib/api-errors";
import { getApiBaseUrl } from "@/lib/auth";
import styles from "./user-picker.module.css";

const SEARCH_DEBOUNCE_MS = 300;

export interface UserPickerProps {
  readonly id: string;
  readonly label: string;
  readonly value: UserSummary | null;
  readonly onChange: (user: UserSummary | null) => void;
  readonly helperText?: string;
}

/**
 * A reusable search-and-select control against the read-only `GET /users` lookup endpoint —
 * built for the create/edit project form's owner field, and reusable as-is for team management
 * and approver assignment once those are built (same debounced-search shape all three need).
 * Debounced client-side search, the same direct `fetch()` + `credentials: "include"` pattern
 * every mutation/query in this app already uses from a `"use client"` component. Errors route
 * through the existing `lib/api-errors.ts` allowlist rather than new ad hoc handling.
 */
export function UserPicker({ id, label, value, onChange, helperText }: UserPickerProps): ReactNode {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly UserSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  async function runSearch(search: string): Promise<void> {
    setError(null);
    try {
      const params = new URLSearchParams({ search });
      const response = await fetch(`${getApiBaseUrl()}/users?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        setError(await parseApiErrorMessage(response));
        setResults([]);
        return;
      }
      const body = (await response.json()) as ApiSuccessResponse<readonly UserSummary[]>;
      setResults(body.data);
    } catch {
      setError("Something went wrong. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(user: UserSummary): void {
    onChange(user);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function handleRemove(): void {
    onChange(null);
    setQuery("");
    setResults([]);
  }

  const showDropdown = open && (loading || error !== null || results.length > 0 || query.trim());

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      {value ? (
        <div className={styles.selected}>
          <div className={styles.selectedText}>
            <span className={styles.selectedName}>{value.displayName}</span>
            <span className={styles.selectedEmail}>{value.email}</span>
          </div>
          <button type="button" onClick={handleRemove} className={styles.removeButton}>
            Remove
          </button>
        </div>
      ) : (
        <div className={styles.searchWrapper}>
          <input
            id={id}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delayed so a dropdown item's onMouseDown (which fires before blur/onClick) can
              // still register the selection before the dropdown unmounts.
              setTimeout(() => setOpen(false), 150);
            }}
            placeholder="Search by name or email…"
            className={styles.input}
            autoComplete="off"
            role="combobox"
            aria-expanded={Boolean(showDropdown)}
            aria-controls={`${id}-listbox`}
          />
          {showDropdown ? (
            <ul id={`${id}-listbox`} className={styles.dropdown} role="listbox">
              {loading ? <li className={styles.dropdownStatus}>Searching…</li> : null}
              {error ? (
                <li className={styles.dropdownStatus} role="alert">
                  {error}
                </li>
              ) : null}
              {!loading && !error && results.length === 0 && query.trim() ? (
                <li className={styles.dropdownStatus}>No matches.</li>
              ) : null}
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className={styles.dropdownItem}
                    onMouseDown={() => handleSelect(user)}
                  >
                    <span className={styles.dropdownItemName}>{user.displayName}</span>
                    <span className={styles.dropdownItemEmail}>{user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {helperText ? <span className={styles.helperText}>{helperText}</span> : null}
    </div>
  );
}
