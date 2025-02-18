// app/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="w-full py-4 mt-8 bg-[var(--footer-background)]">
      <div className="max-w-screen-xl mx-auto px-4 text-sm text-center">
        {new Date().getFullYear()} © Declan Huggins
      </div>
    </footer>
  );
}