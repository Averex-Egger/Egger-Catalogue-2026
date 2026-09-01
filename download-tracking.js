(() => {
  const button = document.querySelector(".button-download");
  if (!button) return;

  let lastClick = -Infinity;
  button.addEventListener("click", () => {
    // Ignore accidental double-clicks; nothing is persisted in the browser.
    const now = Date.now();
    if (now - lastClick < 1000) return;
    lastClick = now;

    // Do not preventDefault or wait: the PDF link works even if this fails.
    try {
      void fetch("/.netlify/functions/track-download", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "download",
        keepalive: true,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      }).catch(() => {});
    } catch {
      // Tracking must never interrupt a download.
    }
  });
})();
