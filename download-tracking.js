(() => {
  const buttons = document.querySelectorAll(".button-download");

  buttons.forEach((button) => {
    let lastClick = -Infinity;
    button.addEventListener("click", () => {
      // Suppress accidental double-clicks independently for each catalogue.
      const now = Date.now();
      if (now - lastClick < 1000) return;
      lastClick = now;

      // Keep the existing EGGER event unchanged to preserve its historical count.
      const eventBody = button.dataset.catalogue === "cleaf" ? "download:cleaf" : "download";

      // Never interrupt navigation: PDF downloads work even if tracking fails.
      try {
        void fetch("/.netlify/functions/track-download", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: eventBody,
          keepalive: true,
          credentials: "omit",
          referrerPolicy: "no-referrer",
        }).catch(() => {});
      } catch {
        // Tracking must never interrupt a download.
      }
    });
  });
})();
