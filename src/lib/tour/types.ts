/**
 * Tour step pointed at a real UI element by CSS selector. Side hints
 * Driver.js where to draw the tooltip relative to the element.
 */
export type TourStep = {
  /** CSS selector to spotlight. Use `[data-tour="my-anchor"]`. */
  element: string;
  /** Short heading shown at the top of the tooltip. */
  title: string;
  /** Plain-language body. 2–4 sentences max. */
  body: string;
  /** Optional preferred side; Driver.js falls back if it doesn't fit. */
  side?: "top" | "right" | "bottom" | "left";
};

export type TourDefinition = {
  /** Stable id used to track "seen" state in localStorage. */
  id: string;
  /** Pathname pattern. First match wins. */
  match: RegExp;
  /** Steps in order. */
  steps: TourStep[];
};
