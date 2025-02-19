import ThemeToggle from './ThemeToggle';

export default function Footer() {
  return (
    <footer className="w-full py-4 mt-8 bg-[var(--footer-background)] relative">
      <div className="max-w-screen-xl mx-auto px-4 text-sm text-center">
        {new Date().getFullYear()} © Declan Huggins
      </div>
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
        <ThemeToggle />
      </div>
    </footer>
  );
}