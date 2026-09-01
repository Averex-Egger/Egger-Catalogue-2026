import { copyFile, mkdir, cp } from "node:fs/promises";

// Only website assets are published. Server code, tests and dependencies stay out.
await mkdir("dist", { recursive: true });
for (const file of [
  "index.html",
  "styles.css",
  "download-tracking.js",
  "Averex Logo.png",
  "Egger Catalogue 26+.pdf",
]) {
  await copyFile(file, `dist/${file}`);
}
await cp("images", "dist/images", { recursive: true });
