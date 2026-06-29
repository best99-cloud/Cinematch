import { useEffect, useRef } from "react";

/**
 * Renders a third-party Adsterra ad unit.
 *
 * Two real constraints shape this implementation:
 *
 * 1. React does NOT execute <script> tags written directly in JSX — the
 *    browser silently ignores them when React creates elements that way.
 *    Ad network scripts must be inserted via real DOM manipulation inside
 *    a ref, exactly as if pasted into plain HTML.
 *
 * 2. Adsterra's "iframe" banner format sets a global `window.atOptions`
 *    variable that its invoke.js script reads. If two banner ads were ever
 *    rendered on the same page, the second one's config would silently
 *    overwrite the first's before either script finishes loading, causing
 *    one ad to load wrong or not at all. The documented, working fix is to
 *    load the banner inside its own real <iframe> (via srcdoc), giving it
 *    a completely separate `window` object and avoiding any conflict —
 *    this matters here even with just one banner today, in case another
 *    banner-format unit is ever added later.
 *
 * The Native Banner format doesn't have this global-variable conflict, so
 * it's injected directly into the page DOM as Adsterra's snippet intends.
 */
export default function AdBanner({ variant = "banner" }) {
  const containerRef = useRef(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || injectedRef.current) return;
    injectedRef.current = true;

    if (variant === "banner") {
      const iframe = document.createElement("iframe");
      iframe.style.width = "300px";
      iframe.style.height = "250px";
      iframe.style.border = "none";
      iframe.style.overflow = "hidden";
      iframe.scrolling = "no";

      // Each banner gets its own isolated window/document via srcdoc, so its
      // window.atOptions can never collide with any other ad unit's config.
      iframe.srcdoc = `
        <!DOCTYPE html>
        <html>
          <head><style>body{margin:0;padding:0;}</style></head>
          <body>
            <script type="text/javascript">
              atOptions = {
                'key' : '20028bfc4bab47dbcd90c7504fa6894f',
                'format' : 'iframe',
                'height' : 250,
                'width' : 300,
                'params' : {}
              };
            </script>
            <script type="text/javascript" src="//www.highperformanceformat.com/20028bfc4bab47dbcd90c7504fa6894f/invoke.js"></script>
          </body>
        </html>
      `;

      containerRef.current.appendChild(iframe);
    } else if (variant === "native") {
      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src = "https://pl30121052.effectivecpmnetwork.com/f88846f46471ac2e46a23aaed2938e0e/invoke.js";
      containerRef.current.appendChild(script);
    }
  }, [variant]);

  if (variant === "banner") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "20px 0" }}>
        <div ref={containerRef} style={{ width: "300px", height: "250px" }} />
      </div>
    );
  }

  // Native banner: container div with the exact id the ad network's script expects
  return (
    <div style={{ margin: "20px 0" }}>
      <div ref={containerRef}>
        <div id="container-f88846f46471ac2e46a23aaed2938e0e" />
      </div>
    </div>
  );
}
