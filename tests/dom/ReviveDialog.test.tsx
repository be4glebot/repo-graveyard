/**
 * DOM tests for the Revive_Dialog: semantics, focus handling, closing, the
 * estate demo note and its coexistence with the real DetailPanel.
 * Plain DOM assertions only (no jest-dom).
 *
 * Requirements: 3.1-3.9, 3.11, 3.12, 3.16, 1.4, 8.9
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DetailPanel from "@/components/detail/DetailPanel";
import { ReviveInKiro } from "@/components/seance/ReviveInKiro";
import estateJson from "@/data/estate.json";
import { resolveEstate } from "@/lib/estate";
import { estateSchema } from "@/lib/estate-schema";
import { buildRows } from "@/lib/graveyard-view";
import { buildRepoRows } from "@/lib/repoRow";
import { ESTATE_DEMO_NOTICE, buildCloneCommand } from "@/lib/revive-brief";
import { seanceResultSchema } from "@/lib/seance-schema";

const NOW = "2024-06-01T00:00:00.000Z";
const DIALOG_NAME = "Raise it in Kiro";
const ACTIONS = ["Copy clone command", "Copy Kiro prompt", "Download REVIVAL.md"];
const FOCUSABLE =
  'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const estate = estateSchema.parse(estateJson);
const { repos, overrides } = resolveEstate(estate, NOW);
const rows = buildRows(repos, overrides, NOW);
const repoRows = buildRepoRows(repos);
const REVIVE_INDEX = estate.repos.findIndex(
  (r) => (r.seanceResult as { verdict?: string }).verdict === "revive",
);
const result = seanceResultSchema.parse(estate.repos[REVIVE_INDEX].seanceResult);

function stubMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      query.includes("min-width: 768px") ||
      query.includes("prefers-reduced-motion") ||
      query.includes("hover: hover"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  stubMedia();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  document.getElementById("scene-root")?.remove();
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const reviveButton = () => screen.getByRole("button", { name: /Revive in Kiro/ });
const reviveDialog = () => screen.queryByRole("dialog", { name: DIALOG_NAME });
const active = () => document.activeElement as HTMLElement | null;
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(active() ?? document.body, { key: k, ...init });

function focusables(): HTMLElement[] {
  return Array.from(reviveDialog()!.querySelectorAll<HTMLElement>(FOCUSABLE));
}

function renderButton(owner = "octo") {
  const facts = { owner, repo: "crypt-keeper", state: "zombie" };
  return render(<ReviveInKiro result={result} facts={facts} onAnnounce={() => {}} />);
}

async function openDialog() {
  const button = reviveButton();
  await userEvent.click(button);
  await waitFor(() => expect(reviveDialog()).not.toBeNull());
  return button;
}

function failClipboard() {
  vi.stubGlobal("navigator", {
    ...navigator,
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
}

describe("dialog semantics and content", () => {
  it("is a labelled modal dialog with Close, three actions and three steps", async () => {
    renderButton();
    await openDialog();
    const dlg = reviveDialog()!;
    expect(dlg.getAttribute("role")).toBe("dialog");
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    const labelId = dlg.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)?.textContent).toBe(DIALOG_NAME);

    const labels = Array.from(dlg.querySelectorAll("button")).map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(labels).toEqual(["Close", ...ACTIONS]);
    expect(dlg.querySelectorAll("ol > li").length).toBe(3);
  });

  it("moves focus to the Close control on open", async () => {
    renderButton();
    await openDialog();
    expect(active()?.textContent?.trim()).toBe("Close");
  });

  it("carries the responsive and wrapping classes", async () => {
    renderButton();
    await openDialog();
    const dlg = reviveDialog()!;
    expect(dlg.className).toContain("motion-safe:");
    expect(dlg.className).toContain("max-h");
    expect(dlg.className).toContain("overflow-y-auto");
    const clone = Array.from(dlg.querySelectorAll("p")).find((p) =>
      (p.textContent ?? "").startsWith("git clone"),
    )!;
    expect(clone.className).toContain("break-all");
  });
});

describe("Tab wrapping", () => {
  it("wraps forwards and backwards", async () => {
    renderButton();
    await openDialog();
    const items = focusables();
    expect(items.length).toBe(4);
    items[items.length - 1].focus();
    key("Tab");
    expect(active()).toBe(items[0]);
    key("Tab", { shiftKey: true });
    expect(active()).toBe(items[items.length - 1]);
    key("Tab", { shiftKey: true });
    expect(active()).toBe(items[items.length - 2]);
  });

  it("wraps with the fallback textareas visible", async () => {
    failClipboard();
    renderButton();
    await openDialog();
    await userEvent.click(screen.getByRole("button", { name: ACTIONS[0] }));
    await waitFor(() => expect(reviveDialog()!.querySelectorAll("textarea").length).toBe(2));
    const items = focusables();
    expect(items.length).toBe(6);
    items[items.length - 1].focus();
    key("Tab");
    expect(active()).toBe(items[0]);
    key("Tab", { shiftKey: true });
    expect(active()).toBe(items[items.length - 1]);
  });
});

describe("closing", () => {
  it("Escape closes and returns focus to the button", async () => {
    renderButton();
    const button = await openDialog();
    key("Escape");
    await waitFor(() => expect(reviveDialog()).toBeNull());
    expect(active()).toBe(button);
  });

  it("Close closes and returns focus to the button", async () => {
    renderButton();
    const button = await openDialog();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(reviveDialog()).toBeNull());
    expect(active()).toBe(button);
  });

  it("backdrop click closes and returns focus to the button", async () => {
    renderButton();
    const button = await openDialog();
    fireEvent.click(screen.getByTestId("revive-backdrop"));
    await waitFor(() => expect(reviveDialog()).toBeNull());
    expect(active()).toBe(button);
  });
});

describe("estate demo note", () => {
  it("appears once, directly after the clone command, only for the estate", async () => {
    const { unmount } = renderButton("");
    const estateLabel = reviveButton().textContent;
    await openDialog();
    let dlg = reviveDialog()!;
    const notes = dlg.querySelectorAll('[data-testid="estate-demo-note"]');
    expect(notes.length).toBe(1);
    expect(notes[0].textContent).toBe(ESTATE_DEMO_NOTICE);
    expect(notes[0].previousElementSibling?.textContent).toBe(
      buildCloneCommand({ owner: "", repo: "crypt-keeper" }),
    );
    const estateActions = Array.from(dlg.querySelectorAll("button")).map((b) => [
      b.textContent,
      b.disabled,
    ]);
    const estateFocusable = focusables().length;
    unmount();

    renderButton("octo");
    expect(reviveButton().textContent).toBe(estateLabel);
    await openDialog();
    dlg = reviveDialog()!;
    expect(dlg.querySelector('[data-testid="estate-demo-note"]')).toBeNull();
    expect(
      Array.from(dlg.querySelectorAll("button")).map((b) => [b.textContent, b.disabled]),
    ).toEqual(estateActions);
    expect(focusables().length).toBe(estateFocusable);
  });
});

describe("with the real DetailPanel", () => {
  async function openInPanel(owner: string) {
    const scene = document.createElement("div");
    scene.id = "scene-root";
    document.body.appendChild(scene);
    const onClose = vi.fn();
    render(
      <DetailPanel
        row={repoRows[REVIVE_INDEX]}
        owner={owner}
        classification={{
          state: rows[REVIVE_INDEX].state,
          decayLevel: rows[REVIVE_INDEX].decayLevel,
        }}
        facts={repos[REVIVE_INDEX]}
        renderedAt={NOW}
        isFixture={true}
        seanceFixture={estate.repos[REVIVE_INDEX].seanceResult}
        sceneRootId="scene-root"
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Hold a séance/ }));
    const button = await screen.findByRole(
      "button",
      { name: /Revive in Kiro/ },
      { timeout: 4000 },
    );
    await userEvent.click(button);
    await waitFor(() => expect(reviveDialog()).not.toBeNull());
    return { onClose, button, scene };
  }

  const panelClose = () => screen.getByRole("button", { name: "Close record" });

  it("Escape closes only the dialog; the panel stays open and inert holds", async () => {
    const { onClose, button, scene } = await openInPanel(estate.username);
    key("Escape");
    await waitFor(() => expect(reviveDialog()).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: repoRows[REVIVE_INDEX].name })).toBeTruthy();
    expect(scene.hasAttribute("inert")).toBe(true);
    expect(active()).toBe(button);
  });

  it("after clicking the heading, Tab stays in the dialog and wraps at both ends", async () => {
    await openInPanel(estate.username);
    const heading = screen.getByRole("heading", { name: DIALOG_NAME });
    await userEvent.click(heading);
    const items = focusables();
    const dlg = reviveDialog()!;

    key("Tab");
    expect(dlg.contains(active())).toBe(true);
    expect(active()).not.toBe(panelClose());

    items[items.length - 1].focus();
    key("Tab");
    expect(active()).toBe(items[0]);
    expect(active()).not.toBe(panelClose());

    key("Tab", { shiftKey: true });
    expect(active()).toBe(items[items.length - 1]);
    expect(active()).not.toBe(panelClose());
  });

  it("shows the demo note when opened from an estate panel", async () => {
    await openInPanel("");
    const notes = document.querySelectorAll('[data-testid="estate-demo-note"]');
    expect(notes.length).toBe(1);
    expect(notes[0].textContent).toBe(ESTATE_DEMO_NOTICE);
  });
});
