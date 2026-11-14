/**
 * DOM tests for the badge dialogs (GetBadgeDialog and RepoBadgeDialog):
 * snippets, style toggle, copy feedback, preview fallback, focus handling,
 * closing and accessibility. Plain DOM assertions only (no jest-dom).
 *
 * Requirements: 7.3-7.8, 7.13, 7.14, 8.2, 8.4-8.6, 9.1-9.9, 10.5
 */
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { GetBadgeDialog } from "@/components/badge/GetBadgeDialog";
import { RepoBadgeDialog } from "@/components/badge/RepoBadgeDialog";
import { resolveSiteUrl } from "@/lib/site-meta";

const OWNER = "octo";
const REPO = "crypt";
const SITE = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL).origin;

type Kind = "owner" | "repo";

function Harness({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <p data-testid="sibling">Sibling content</p>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
        Open badge
      </button>
      {open && kind === "owner" && (
        <GetBadgeDialog
          owner={OWNER}
          onClose={() => setOpen(false)}
          openerRef={openerRef}
        />
      )}
      {open && kind === "repo" && (
        <RepoBadgeDialog
          owner={OWNER}
          repo={REPO}
          onClose={() => setOpen(false)}
          openerRef={openerRef}
        />
      )}
    </div>
  );
}

const opener = () => screen.getByRole("button", { name: "Open badge" });
const dialog = () => screen.queryByRole("dialog");
const active = () => document.activeElement as HTMLElement | null;
const radio = (name: RegExp) => screen.getByRole("radio", { name }) as HTMLInputElement;
const markdown = () => (screen.getByLabelText(/Markdown/) as HTMLTextAreaElement).value;
const html = () => (screen.getByLabelText(/HTML/) as HTMLTextAreaElement).value;
const preview = () =>
  within(screen.getByTestId("badge-preview")).getByRole("img") as HTMLImageElement;
const status = () => screen.getByRole("status");
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function openDialog(kind: Kind) {
  render(<Harness kind={kind} />);
  opener().focus();
  fireEvent.click(opener());
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

/** Flush the rAF used by the live-region announcement. */
async function flush(ms = 50) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "clipboard");
});

describe.each([
  ["owner" as const, `${OWNER}`, `/api/badge/${OWNER}`, `${SITE}/g/${OWNER}`],
  ["repo" as const, `${OWNER}/${REPO}`, `/api/badge/${OWNER}/${REPO}`, `${SITE}/g/${OWNER}/${REPO}`],
])("%s badge dialog", (kind, subject, path, link) => {
  it("shows Markdown and HTML snippets for haunted, and flat only on the image URL", () => {
    openDialog(kind);
    const img = `${SITE}${path}`;
    expect(markdown()).toBe(`[![Repo Graveyard](${img})](${link})`);
    expect(html()).toBe(`<a href="${link}"><img src="${img}" alt="Repo Graveyard"></a>`);
    expect(preview().getAttribute("src")).toBe(path);

    fireEvent.click(radio(/Flat/));
    expect(markdown()).toBe(`[![Repo Graveyard](${img}?style=flat)](${link})`);
    expect(html()).toBe(
      `<a href="${link}"><img src="${img}?style=flat" alt="Repo Graveyard"></a>`,
    );
    expect(markdown()).not.toContain(`${link}?style`);
    expect(preview().getAttribute("src")).toBe(`${path}?style=flat`);
  });

  it("toggles style in one act and resets to haunted after close and reopen", () => {
    openDialog(kind);
    expect(radio(/Haunted/).checked).toBe(true);
    act(() => {
      fireEvent.click(radio(/Flat/));
    });
    expect(radio(/Flat/).checked).toBe(true);
    expect(preview().getAttribute("src")).toContain("?style=flat");
    expect(markdown()).toContain("?style=flat");
    expect(html()).toContain("?style=flat");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog()).toBeNull();
    fireEvent.click(opener());
    expect(radio(/Haunted/).checked).toBe(true);
    expect(preview().getAttribute("src")).not.toContain("style=");
  });

  it("style picker: radiogroup of two cards with plain names, explanations and live thumbnails", () => {
    openDialog(kind);
    const group = screen.getByRole("radiogroup");
    expect(within(group).getAllByRole("radio").length).toBe(2);
    expect(radio(/Haunted/).getAttribute("name")).toBe(radio(/Flat/).getAttribute("name"));
    expect(radio(/Haunted/).classList.contains("seance-focus")).toBe(true);
    expect(group.textContent).toContain("Spooky");
    expect(group.textContent).toContain("Plain");
    expect(group.textContent).toMatch(/matches this site/);
    expect(group.textContent).toMatch(/blends with other README badges/);

    const thumbs = within(group).getAllByTestId("style-thumb") as HTMLImageElement[];
    expect(thumbs.map((t) => t.getAttribute("src"))).toEqual([path, `${path}?style=flat`]);
  });

  it("selecting a card highlights it and updates snippets and the main preview", () => {
    openDialog(kind);
    const card = (s: string) => screen.getByTestId(`style-card-${s}`);
    expect(card("haunted").getAttribute("data-selected")).toBe("true");
    expect(card("flat").getAttribute("data-selected")).toBe("false");
    fireEvent.click(radio(/Flat/));
    expect(card("flat").getAttribute("data-selected")).toBe("true");
    expect(card("haunted").getAttribute("data-selected")).toBe("false");
    expect(markdown()).toContain("?style=flat");
    expect(preview().getAttribute("src")).toBe(`${path}?style=flat`);
  });

  it("thumbnails show a loading skeleton, then the image, and plain text on error", () => {
    openDialog(kind);
    const [haunted, flat] = screen.getAllByTestId("style-thumb");
    expect(screen.getAllByTestId("style-thumb-loading").length).toBe(2);
    fireEvent.load(haunted);
    expect(screen.getAllByTestId("style-thumb-loading").length).toBe(1);
    fireEvent.error(flat);
    expect(screen.queryAllByTestId("style-thumb-loading").length).toBe(0);
    expect(screen.getByTestId("style-thumb-failed").textContent).toMatch(/unavailable/i);
    // The other style and the controls are unaffected.
    expect(screen.getAllByTestId("style-thumb").length).toBe(1);
    expect(radio(/Flat/)).toBeTruthy();
  });

  it("copies the exact snippet and announces Copied, clearing after 2000 ms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    openDialog(kind);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Markdown" }));
    });
    expect(writeText).toHaveBeenLastCalledWith(markdown());
    await flush();
    expect(status().textContent).toBe("Copied");

    await flush(1900);
    expect(status().textContent).toBe("Copied");
    await flush(200);
    expect(status().textContent).toBe("");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy HTML" }));
    });
    expect(writeText).toHaveBeenLastCalledWith(html());
  });

  it("announces failure when the clipboard rejects, and stays open and readable", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    openDialog(kind);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Markdown" }));
    });
    await flush();
    expect(status().textContent).toMatch(/could not copy/i);
    expect(dialog()).not.toBeNull();
    const area = screen.getByLabelText(/Markdown/) as HTMLTextAreaElement;
    expect(area.readOnly).toBe(true);
    expect(area.disabled).toBe(false);
    expect(area.value).toContain("[![Repo Graveyard]");
  });

  it("announces failure when the clipboard is missing", async () => {
    setClipboard(undefined);
    openDialog(kind);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy HTML" }));
    });
    await flush();
    expect(status().textContent).toMatch(/could not copy/i);
    expect(dialog()).not.toBeNull();
    expect((screen.getByLabelText(/HTML/) as HTMLTextAreaElement).value).toContain("<a href");
  });

  it("falls back to text naming the subject when the preview errors, keeping controls operable", () => {
    openDialog(kind);
    const mdBefore = markdown();
    fireEvent.error(preview());
    expect(within(screen.getByTestId("badge-preview")).queryByRole("img")).toBeNull();
    const text = screen.getByTestId("badge-preview").textContent ?? "";
    expect(text).toContain(subject);
    expect(markdown()).toBe(mdBefore);
    expect(screen.getByRole("button", { name: "Copy Markdown" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy HTML" })).toBeTruthy();
    fireEvent.click(radio(/Flat/));
    expect(radio(/Flat/).checked).toBe(true);
    expect(markdown()).toContain("?style=flat");
  });

  it("focuses the first focusable element and wraps Tab and Shift+Tab", () => {
    openDialog(kind);
    const items = Array.from(dialog()!.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    expect(active()).toBe(first);

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(active()).toBe(first);

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(active()).toBe(last);
  });

  it.each([
    ["Escape", () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })],
    ["Close", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["backdrop", () => fireEvent.click(screen.getByTestId("badge-backdrop"))],
  ])("closes via %s, returns focus to the opener and clears the live region", async (_n, close) => {
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    openDialog(kind);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy Markdown" }));
    });
    await flush();
    expect(status().textContent).toBe("Copied");

    close();
    expect(dialog()).toBeNull();
    expect(active()).toBe(opener());

    fireEvent.click(opener());
    expect(status().textContent).toBe("");
  });

  it("has dialog semantics, makes siblings inert while open and restores them", () => {
    render(<Harness kind={kind} />);
    const container = screen.getByTestId("sibling").parentElement!.parentElement!;
    opener().focus();
    fireEvent.click(opener());

    const d = dialog()!;
    expect(d.getAttribute("aria-modal")).toBe("true");
    const labelledBy = d.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelledBy)?.textContent).toBe(
      kind === "owner" ? "Share your graveyard" : "Share this repo",
    );
    expect(screen.getByRole("dialog", { name: /share/i })).toBe(d);
    expect(container.hasAttribute("inert")).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.hasAttribute("inert")).toBe(false);
  });

  it("gives every control a focus ring and no unconditional transition", () => {
    openDialog(kind);
    const controls = dialog()!.querySelectorAll<HTMLElement>(FOCUSABLE);
    expect(controls.length).toBeGreaterThan(0);
    for (const el of Array.from(controls)) {
      expect(el.classList.contains("seance-focus")).toBe(true);
    }
    for (const el of Array.from(dialog()!.querySelectorAll<HTMLElement>("*"))) {
      for (const cls of Array.from(el.classList)) {
        expect(/^transition(-|$)/.test(cls)).toBe(false);
      }
    }
  });
});
