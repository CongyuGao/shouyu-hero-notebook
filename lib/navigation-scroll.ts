// Run after the new panel commits and modal scroll locks finish releasing.
// Call only for navigation, never for form values or background data refreshes.
export function scheduleScrollToTop(
  target: () => { scrollTo(options: ScrollToOptions): void } | null,
) {
  const frame = requestAnimationFrame(() => {
    target()?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  return () => cancelAnimationFrame(frame);
}
