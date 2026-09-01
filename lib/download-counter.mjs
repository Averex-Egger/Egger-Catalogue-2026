export const STORE_NAME = "catalogue-downloads";
export const COUNTER_KEY = "total.json";
const PRODUCTION_ORIGIN = "https://eggercatalogue2026.netlify.app";

function respond(status) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(status === 405 ? { Allow: "POST" } : {}),
    },
  });
}

async function isDownloadBody(request) {
  if (!request.body) return false;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32) {
        await reader.cancel();
        return false;
      }
      chunks.push(...value);
    }
    return new TextDecoder().decode(new Uint8Array(chunks)) === "download";
  } finally {
    reader.releaseLock();
  }
}

export async function incrementCounter(store) {
  // Compare-and-swap prevents simultaneous clicks overwriting one another.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await store.getWithMetadata(COUNTER_KEY, {
      type: "json",
      consistency: "strong",
    });
    const total = current?.data?.total ?? 0;
    if (!Number.isSafeInteger(total) || total < 0 || total >= Number.MAX_SAFE_INTEGER) {
      throw new Error("Invalid stored counter");
    }
    const timestamp = new Date().toISOString();
    const next = {
      total: total + 1,
      metric: "Download Catalogue button clicks (not confirmed saved files)",
      startedAt: current?.data?.startedAt ?? timestamp,
      updatedAt: timestamp,
    };
    const result = await store.setJSON(COUNTER_KEY, next, {
      ...(current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }),
      metadata: { total: next.total, metric: "Download button clicks" },
    });
    if (result.modified) return;
    await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 30));
  }
  throw new Error("Counter busy");
}

export function createHandler(getStore) {
  return async (request) => {
    // No public read or reset endpoint. View totals in the authenticated Netlify UI.
    if (request.method !== "POST") return respond(405);
    if (
      new URL(request.url).origin !== PRODUCTION_ORIGIN ||
      request.headers.get("origin") !== PRODUCTION_ORIGIN ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) return respond(403);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "text/plain") {
      return respond(415);
    }
    try {
      if (!(await isDownloadBody(request))) return respond(400);
      await incrementCounter(getStore(STORE_NAME));
      return respond(204);
    } catch {
      // Log no request data, count, IP address or visitor identifier.
      console.error("Catalogue click counter unavailable");
      return respond(503);
    }
  };
}
