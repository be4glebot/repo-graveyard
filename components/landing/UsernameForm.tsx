"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { isValidUsername } from "@/lib/username";

const EMPTY_MESSAGE = "A username is required";
const INVALID_MESSAGE = "That doesn't look like a valid GitHub username";

/**
 * Landing-page username form. Renders a labeled text input and a submit button
 * inside a native `<form>`, so both Enter-in-input and button activation submit
 * and the Tab order is input then button.
 *
 * On submit the value is trimmed and validated: an empty value shows the
 * "required" message, an invalid value shows the invalid-format message, and a
 * valid value navigates to `/g/{username}`.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
export default function UsernameForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inputId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = value.trim();

    if (username.length === 0) {
      setError(EMPTY_MESSAGE);
      return;
    }

    if (!isValidUsername(username)) {
      setError(INVALID_MESSAGE);
      return;
    }

    setError(null);
    router.push(`/g/${encodeURIComponent(username)}`);
  }

  const hasError = error !== null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        GitHub username
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input
          id={inputId}
          name="username"
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          placeholder="octocat"
          className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background sm:w-64"
        />
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background transition-colors hover:bg-foreground/90 focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-2 focus:ring-offset-background"
        >
          Visit graveyard
        </button>
      </div>
      {hasError ? (
        <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
