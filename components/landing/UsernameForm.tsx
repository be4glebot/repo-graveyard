"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import ThemedButton from "@/components/ui/ThemedButton";
import { validateUsernameInput } from "@/lib/username";

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

  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateUsernameInput(value);

    if (!result.ok) {
      // Keep the typed value; return focus to the input.
      setError(result.message);
      inputRef.current?.focus();
      return;
    }

    setError(null);
    router.push(`/g/${encodeURIComponent(result.username)}`);
  }

  const hasError = error !== null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-scene-fg">
        GitHub username
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input
          ref={inputRef}
          id={inputId}
          name="username"
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          placeholder="octocat"
          className="w-full rounded-md border border-iron-border bg-night-sky px-3 py-2 text-scene-fg placeholder:text-scene-fg-muted focus:outline-none focus:ring-2 focus:ring-candle-400 focus:ring-offset-2 focus:ring-offset-night-sky sm:w-64"
        />
        <ThemedButton type="submit" variant="crimson">
          Open the gate
        </ThemedButton>
      </div>
      {hasError ? (
        <p id={errorId} role="alert" className="text-sm text-crimson-200">
          {error}
        </p>
      ) : null}
    </form>
  );
}
