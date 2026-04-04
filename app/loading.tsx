function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-2">
        <div className="h-5 w-3/4 rounded" style={{ backgroundColor: 'var(--footer-background)' }} />
      </div>
      <div className="flex gap-3 mb-3">
        <div className="h-3 w-20 rounded" style={{ backgroundColor: 'var(--footer-background)' }} />
        <div className="h-3 w-28 rounded" style={{ backgroundColor: 'var(--footer-background)' }} />
      </div>
      <div className="w-full rounded" style={{ aspectRatio: '3 / 2', backgroundColor: 'var(--footer-background)' }} />
    </div>
  );
}

export default function Loading() {
  return (
    <>
      <style>{`
        .loading-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }
        @media (min-width: 768px) {
          .loading-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
      <div className="loading-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}
