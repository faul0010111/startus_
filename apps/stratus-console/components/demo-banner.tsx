/** Shown whenever the console is rendering bundled sample data instead of the API. */
export function DemoBanner({ live }: { live: boolean }) {
  if (live) return null;
  return (
    <p className="border border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">
      Showing bundled sample data — the STRATUS API is not reachable at {process.env.NEXT_PUBLIC_STRATUS_API_URL}.
    </p>
  );
}
