export default function PortfolioLoading() {
  const heights = [280, 200, 320, 240, 300, 220];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8 text-center">Portfolio</h1>
      <style>{`
        .portfolio-skeleton-grid {
          columns: 1;
          column-gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .portfolio-skeleton-grid { columns: 2; }
        }
        @media (min-width: 1024px) {
          .portfolio-skeleton-grid { columns: 3; }
        }
      `}</style>
      <div className="portfolio-skeleton-grid">
        {heights.map((h, i) => (
          <div
            key={i}
            className="animate-pulse rounded mb-6"
            style={{
              height: `${h}px`,
              backgroundColor: 'var(--footer-background)',
              breakInside: 'avoid',
            }}
          />
        ))}
      </div>
    </div>
  );
}
