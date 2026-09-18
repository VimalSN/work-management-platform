// A burst of socket events (several task updates landing within
// milliseconds of each other) would otherwise trigger one refetch per
// event. Debouncing collapses a burst into a single refetch, fired once
// the burst actually settles.
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
