"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import "driver.js/dist/driver.css";
import { driver, type Driver } from "driver.js";
import { findTour } from "@/lib/tour/registry";

const SEEN_PREFIX = "bmsys.tour.seen.";

function hasSeen(tourId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_PREFIX + tourId) === "1";
  } catch {
    return true;
  }
}

function markSeen(tourId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_PREFIX + tourId, "1");
  } catch {
    // ignore — private mode, etc.
  }
}

/**
 * Waits until at least one step element exists, returning the subset
 * of selectors that resolved. Lenient: missing anchors are skipped
 * instead of blocking the whole tour, so an element that only renders
 * conditionally (e.g. the cart bar) doesn't break first-visit launch.
 */
async function waitForAnyElements(
  selectors: string[],
  maxMs = 1500,
): Promise<string[]> {
  const start = Date.now();
  let present: string[] = [];
  while (Date.now() - start < maxMs) {
    present = selectors.filter((s) => document.querySelector(s));
    if (present.length === selectors.length) return present;
    await new Promise((r) => setTimeout(r, 100));
  }
  return present;
}

export function TourLauncher() {
  const pathname = usePathname();
  const [available, setAvailable] = useState(false);
  const tour = pathname ? findTour(pathname) : null;

  const launch = useCallback(async () => {
    if (!tour) return;
    const present = new Set(
      await waitForAnyElements(tour.steps.map((s) => s.element)),
    );
    const liveSteps = tour.steps.filter((s) => present.has(s.element));
    if (liveSteps.length === 0) return;

    const d: Driver = driver({
      showProgress: liveSteps.length > 1,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Got it",
      steps: liveSteps.map((s) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.body,
          side: s.side,
          align: "start",
        },
      })),
      onDestroyStarted: () => {
        markSeen(tour.id);
        d.destroy();
      },
    });
    d.drive();
  }, [tour]);

  // Hide the button on routes with no tour; reveal it (and auto-launch
  // on first visit) once at least one anchor exists.
  useEffect(() => {
    let cancelled = false;
    setAvailable(false);
    if (!tour) return;
    (async () => {
      const present = await waitForAnyElements(tour.steps.map((s) => s.element));
      if (cancelled) return;
      const ready = present.length > 0;
      setAvailable(ready);
      if (ready && !hasSeen(tour.id)) launch();
    })();
    return () => {
      cancelled = true;
    };
  }, [tour, launch]);

  if (!tour || !available) return null;
  if (pathname === "/login") return null;

  return (
    <button
      type="button"
      onClick={launch}
      aria-label="Show me around this screen"
      className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-800 shadow-lg hover:bg-zinc-50 sm:bottom-6 sm:right-6"
    >
      <HelpCircle className="h-6 w-6" strokeWidth={1.5} />
    </button>
  );
}
