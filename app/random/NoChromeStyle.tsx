// Server component injecting CSS to hide global chrome for /random to avoid hydration flash.
export default function NoChromeStyle() {
  return (
    <style>{`
      footer,
      [class^="Header_headerContainer__"],
      [class*=" Header_headerContainer__"],
      [class^="Header_innerWrapper__"],
      [class*=" Header_innerWrapper__"] {
        display: none !important;
      }
      body { padding:0 !important; margin:0 !important; }
      main { max-width:none !important; padding:0 !important; margin:0 !important; }
      html, body, #__next { height:100%; }
    `}</style>
  );
}
