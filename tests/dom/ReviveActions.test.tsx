/**
 * DOM tests for the Revive dialog actions: clipboard, download Blob,
 * announcements and failure fallbacks.
 *
 * Requirements: 3.14, 3.15, 4.1-4.8, 4.10, 8.10, 8.11, 8.12, 8.14
 */

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReviveInKiro } from "@/components/seance/ReviveInKiro";
import {
  COPIED_CLONE_MESSAGE,
  COPIED_PROMPT_MESSAGE,
  COPY_FAILED_MESSAGE,
  DOWNLOADED_MESSAGE,
  DOWNLOAD_FAILED_MESSAGE,
} from "@/components/seance/ReviveDialog";
import {
  buildCloneCommand,
  buildKiroPrompt,
  buildReviveBrief,
  type ReviveFacts,
} from "@/lib/revive-brief";
import type { SeanceResult } from "@/lib/seance-schema";

const result: SeanceResult = {
  voice: "You left me in the middle of the login page.",
  causeOfDeath: "The oauth callback never worked.",
  unfinishedBusiness: [
    { title: "Fix callback", detail: "Redirect loops.", evidence: "abc1234" },
  ],
  verdict: "revive",
  verdictReason: "Close to done.",
};
const facts: ReviveFacts = { owner: "ada", repo: "streak", state: "zombie" };

/** Mirrors SeanceRegion's visually hidden copy status. */
function Harness() {
  const [message, setMessage] = useState("");
  return (
    <div>
      <ReviveInKiro result={result} facts={facts} onAnnounce={setMessage} />
      {message ? <p data-seance-copy-status="">{message}</p> : null}
    </div>
  );
}

const writeText = vi.fn();
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();
const fetchSpy = vi.fn();
let clickSpy: ReturnType<typeof vi.spyOn>;
let downloadNames: string[];

const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;
const origFetch = globalThis.fetch;

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

async function flush(ms = 50) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function openDialog() {
  render(<Harness />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /revive in kiro/i }));
  });
  await flush();
}

async function press(name: RegExp) {
  const button = screen.getByRole("button", { name });
  button.focus();
  await act(async () => {
    fireEvent.click(button);
  });
  await flush();
  return button;
}

const dialogStatus = () =>
  document.querySelector("[data-revive-status]")!.textContent;
const liveStatus = () =>
  document.querySelector("[data-seance-copy-status]")?.textContent;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  writeText.mockReset().mockResolvedValue(undefined);
  createObjectURL.mockReset().mockReturnValue("blob:revival-1");
  revokeObjectURL.mockReset();
  fetchSpy.mockReset();
  downloadNames = [];
  setClipboard({ writeText });
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloadNames.push(this.download);
    });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clickSpy.mockRestore();
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;
  globalThis.fetch = origFetch;
  setClipboard(undefined);
});

describe("Revive dialog copy actions", () => {
  it("copies the exact clone command once and announces it", async () => {
    await openDialog();
    await press(/copy clone command/i);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(buildCloneCommand(facts));
    expect(dialogStatus()).toBe(COPIED_CLONE_MESSAGE);
    expect(liveStatus()).toBe(COPIED_CLONE_MESSAGE);
    expect(screen.queryByLabelText("Kiro prompt")).toBeNull();
  });

  it("copies the exact Kiro prompt once and announces it", async () => {
    await openDialog();
    await press(/copy kiro prompt/i);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(buildKiroPrompt(result, facts));
    expect(dialogStatus()).toBe(COPIED_PROMPT_MESSAGE);
    expect(liveStatus()).toBe(COPIED_PROMPT_MESSAGE);
  });

  it("shows the failure message and selectable textareas when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    await openDialog();
    const button = await press(/copy kiro prompt/i);
    expect(dialogStatus()).toBe(COPY_FAILED_MESSAGE);
    expect(liveStatus()).toBe(COPY_FAILED_MESSAGE);
    const clone = screen.getByLabelText("Clone command") as HTMLTextAreaElement;
    const prompt = screen.getByLabelText("Kiro prompt") as HTMLTextAreaElement;
    expect(clone.readOnly).toBe(true);
    expect(clone.value).toBe(buildCloneCommand(facts));
    expect(prompt.value).toBe(buildKiroPrompt(result, facts));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back the same way when the clipboard is missing", async () => {
    setClipboard(undefined);
    await openDialog();
    const button = await press(/copy clone command/i);
    expect(dialogStatus()).toBe(COPY_FAILED_MESSAGE);
    expect(screen.getByLabelText("Clone command")).toBeTruthy();
    expect(screen.getByLabelText("Kiro prompt")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(button);
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Revive dialog download", () => {
  it("creates one markdown Blob, names it REVIVAL.md and revokes once within 10 s", async () => {
    await openDialog();
    await press(/download revival\.md/i);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("text/markdown;charset=utf-8");
    expect(await blob.text()).toBe(buildReviveBrief(result, facts));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(downloadNames).toEqual(["REVIVAL.md"]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(dialogStatus()).toBe(DOWNLOADED_MESSAGE);
    expect(liveStatus()).toBe(DOWNLOADED_MESSAGE);

    await flush(10000);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:revival-1");
  });

  it("announces the failure when createObjectURL throws", async () => {
    createObjectURL.mockImplementation(() => {
      throw new Error("nope");
    });
    await openDialog();
    await press(/download revival\.md/i);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(dialogStatus()).toBe(DOWNLOAD_FAILED_MESSAGE);
    expect(liveStatus()).toBe(DOWNLOAD_FAILED_MESSAGE);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("announces the failure and revokes when the click throws", async () => {
    clickSpy.mockImplementation(() => {
      throw new Error("blocked");
    });
    await openDialog();
    await press(/download revival\.md/i);
    expect(dialogStatus()).toBe(DOWNLOAD_FAILED_MESSAGE);
    expect(liveStatus()).toBe(DOWNLOAD_FAILED_MESSAGE);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:revival-1");
    await flush(10000);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a[download]")).toBeNull();
  });
});

describe("Revive dialog network", () => {
  it("never calls fetch across all actions", async () => {
    await openDialog();
    await press(/copy clone command/i);
    await press(/copy kiro prompt/i);
    await press(/download revival\.md/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
