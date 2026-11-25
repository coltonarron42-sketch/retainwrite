// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SkeletonOverlay } from "@/components/skeleton/skeleton-dock";
import { FocusOpener } from "@/components/stages/stage1/welcome-back";
import { StageViewContext } from "@/lib/stages/stage-view-context";
import { isWelcomeLine, reviewWelcomeLine } from "@/lib/coach/welcome-back";
import { pickPhrase } from "@/lib/stage1/paper-context";
import { outlineGap } from "@/lib/stages/outline-map";
import type { PaperSection } from "@/lib/skeleton/sections";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let app: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  app = document.createElement("div");
  app.id = "app-root";
  document.body.appendChild(app);
  host = document.createElement("div");
  app.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const sections: PaperSection[] = [
  { id: "intro", kicker: null, title: "Introduction", group: "intro", sectionKey: "intro", completed: true, preview: ["my hook"] },
  { id: "body-1", kicker: null, title: "Body Paragraph 1", group: "body", sectionKey: "body", completed: false, preview: [] },
];

function overlay(onOpen = vi.fn(), onClose = vi.fn()) {
  act(() => {
    root.render(createElement(SkeletonOverlay, { sections, waiting: null, direction: null, interactive: () => true, onOpen, onClose, returnFocus: () => null }));
  });
  return { onOpen, onClose };
}

describe("PC-30 QA #2: the page behind the open Skeleton is out of reach", () => {
  it("dialog is aria-modal, rendered outside the app root, and the app root is inert until it closes", () => {
    overlay();
    const dlg = document.querySelector<HTMLElement>("[data-skeleton-overlay]")!;
    expect(dlg.getAttribute("role")).toBe("dialog");
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(app.contains(dlg)).toBe(false);
    expect(app.inert).toBe(true);
    expect(app.hasAttribute("data-skeleton-inert")).toBe(true);
    act(() => root.render(null));
    expect(app.inert).toBe(false);
    expect(app.hasAttribute("data-skeleton-inert")).toBe(false);
  });
  it("leaves something that was already inert as it was", () => {
    const other = document.createElement("div");
    other.inert = true;
    document.body.appendChild(other);
    overlay();
    act(() => root.render(null));
    expect(other.inert).toBe(true);
  });
});

describe("PC-30 QA #6: Space opens a focused section, same as Enter", () => {
  for (const key of [" ", "Enter"]) {
    it(`key ${JSON.stringify(key)} opens once`, () => {
      const { onOpen } = overlay();
      const btn = document.querySelector<HTMLButtonElement>('[data-skeleton-block="body-1"]')!;
      btn.focus();
      act(() => {
        btn.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0]![0].id).toBe("body-1");
    });
  }
  it("a held key (repeat) doesn't open again", () => {
    const { onOpen } = overlay();
    const btn = document.querySelector<HTMLButtonElement>('[data-skeleton-block="intro"]')!;
    act(() => {
      btn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true, cancelable: true }));
    });
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("PC-30 QA #1/#4: welcome-back on a finished (read-only) stage", () => {
  const render = (review: boolean) =>
    act(() => {
      root.render(
        createElement(
          StageViewContext.Provider,
          { value: { review, stage: 2, paperStage: 3 } },
          createElement(FocusOpener, { line: "Welcome back.", scope: "t", signal: 1, silent: true, onProgress: () => {} }),
        ),
      );
    });
  it("no 'See skeleton' chip on a read-only stage", () => {
    render(true);
    expect(document.querySelector("[data-welcome-back]")).not.toBeNull();
    expect(document.querySelector("[data-focus-progress]")).toBeNull();
    expect(document.body.textContent).not.toContain("See skeleton");
  });
  it("the chip stays on a live stage", () => {
    render(false);
    expect(document.querySelector("[data-focus-progress]")).not.toBeNull();
  });
  it("says the stage is done and read-only, never 'rolling into' or 'up next'", () => {
    const line = reviewWelcomeLine(2, "Stance", 3);
    expect(line).toBe("Welcome back. Stage 2, Stance, is done, so this is a read-only look back at what you saved. Your work picks up in Stage 3.");
    expect(line).not.toMatch(/rolling|up next|is up|locked in/i);
    expect(isWelcomeLine(line)).toBe(true);
    expect(isWelcomeLine(reviewWelcomeLine(1, "Intake", 2))).toBe(true);
    expect(reviewWelcomeLine(3, null, 3)).toBe("Welcome back. Stage 3 is done, so this is a read-only look back at what you saved.");
  });
});

describe("PC-30 QA #5: every style they picked, joined naturally", () => {
  it("two styles", () => {
    expect(pickPhrase({ pick: "Transformational", answer: "I'd pick servant and transformational because Walton put associates first" })).toBe("servant and transformational leadership");
  });
  it("three styles", () => {
    expect(pickPhrase({ pick: "Servant", answer: "servant, transformational and situational, since he adapted" })).toBe("servant, transformational and situational leadership");
  });
  it("one pick stays as it was", () => {
    expect(pickPhrase({ pick: "Transformational", answer: "transformational because of the vision" })).toBe("Transformational");
    expect(pickPhrase(null)).toBeNull();
  });
  it("the Stage 3 intro coaching names both", () => {
    const pick = pickPhrase({ pick: "Transformational", answer: "servant and transformational" });
    const gap = outlineGap("Introduction", ["Sam Walton started Walmart in 1962"], null, null, pick);
    expect(gap).toContain("You picked servant and transformational leadership:");
    expect(gap).not.toMatch(/You picked transformational leadership/);
  });
  it("tying a body example to the pick: either picked style counts", () => {
    const pick = pickPhrase({ pick: "Servant", answer: "servant and transformational" });
    expect(outlineGap("Body", ["Sam Walton listened to associates in 1985", "that was transformational for Walmart"], null, null, pick)).toBeNull();
  });
});

describe("PC-30 QA: the Stage 2 quick lesson names every picked style", () => {
  it("two styles in the ask and the definition", async () => {
    const { contextTeachCard } = await import("@/lib/coaching/teach");
    const card = contextTeachCard({ summary: null, options: null, decision: { pick: "Transformational", answer: "servant and transformational, because Walton put associates first" } }, "r")!;
    expect(card.ask).toBe("You picked servant and transformational leadership. Which moment shows it best?");
    expect(card.definition).toMatch(/^servant and transformational leadership are the ideas this section/);
  });
  it("one pick reads as before", async () => {
    const { contextTeachCard } = await import("@/lib/coaching/teach");
    const card = contextTeachCard({ summary: null, options: null, decision: { pick: "Transformational", answer: "transformational because of the vision" } }, "r")!;
    expect(card.ask).toBe("You picked Transformational. Which moment shows it best?");
    expect(card.definition).toMatch(/^Transformational is the idea/);
  });
});
