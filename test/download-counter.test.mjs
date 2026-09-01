import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import vm from "node:vm";
import { createHandler, incrementCounter, COUNTER_KEY } from "../lib/download-counter.mjs";

const origin = "https://eggercatalogue2026.netlify.app";

function memoryStore() {
  let value = null;
  let version = 0;
  return {
    async getWithMetadata(key, options) {
      assert.equal(key, COUNTER_KEY);
      assert.equal(options.consistency, "strong");
      return value ? { data: structuredClone(value), etag: String(version) } : null;
    },
    async setJSON(key, data, options) {
      assert.equal(key, COUNTER_KEY);
      if ((options.onlyIfNew && value) ||
          (options.onlyIfMatch !== undefined && options.onlyIfMatch !== String(version))) {
        return { modified: false };
      }
      assert.equal(options.metadata.total, data.total);
      value = structuredClone(data);
      version += 1;
      return { modified: true, etag: String(version) };
    },
    read() { return value; },
  };
}

function request({ method = "POST", body = "download", headers = {}, url = origin } = {}) {
  return new Request(`${url}/.netlify/functions/track-download`, {
    method,
    headers: { origin, "content-type": "text/plain", ...headers },
    ...(!["GET", "HEAD"].includes(method) ? { body } : {}),
  });
}

test("creates a private aggregate count, returns no count or cookies", async () => {
  const store = memoryStore();
  const handler = createHandler(() => store);
  for (let i = 0; i < 2; i++) {
    const result = await handler(request());
    assert.equal(result.status, 204);
    assert.equal(await result.text(), "");
    assert.equal(result.headers.get("set-cookie"), null);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
  assert.equal(store.read().total, 2);
  assert.deepEqual(Object.keys(store.read()).sort(), ["metric", "startedAt", "total", "updatedAt"]);
});

test("concurrent clicks are not lost", async () => {
  const store = memoryStore();
  await Promise.all(Array.from({ length: 20 }, () => incrementCounter(store)));
  assert.equal(store.read().total, 20);
});

test("GET, HEAD and reset attempts cannot read or change totals", async () => {
  const handler = createHandler(() => { throw new Error("Must not access storage"); });
  for (const method of ["GET", "HEAD", "DELETE", "PUT", "OPTIONS"]) {
    const result = await handler(request({ method }));
    assert.equal(result.status, 405);
    assert.equal(await result.text(), "");
  }
});

test("rejects cross-site, missing origin, preview and malformed events before storage", async () => {
  const handler = createHandler(() => { throw new Error("Must not access storage"); });
  const cases = [
    [{ headers: { origin: "https://other.example" } }, 403],
    [{ headers: { origin: "null" } }, 403],
    [{ headers: { "sec-fetch-site": "cross-site" } }, 403],
    [{ url: "https://preview.netlify.app" }, 403],
    [{ headers: { "content-type": "application/json" } }, 415],
    [{ body: "view" }, 400],
    [{ body: "" }, 400],
    [{ body: "x".repeat(1024) }, 400],
  ];
  for (const [options, status] of cases) {
    assert.equal((await handler(request(options))).status, status);
  }
  const missingOrigin = request();
  missingOrigin.headers.delete("origin");
  assert.equal((await handler(missingOrigin)).status, 403);
});

test("storage failure returns a generic error, never a count", async () => {
  const handler = createHandler(() => { throw new Error("sensitive storage details"); });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal(await response.text(), "");
});

test("invalid stored data is not silently overwritten", async () => {
  let writes = 0;
  const store = {
    getWithMetadata: async () => ({ data: { total: -1 }, etag: "1" }),
    setJSON: async () => { writes++; },
  };
  await assert.rejects(incrementCounter(store), /Invalid stored counter/);
  assert.equal(writes, 0);
});

test("compare-and-swap conflicts retry without unconditional writes", async () => {
  let attempts = 0;
  const store = {
    getWithMetadata: async () => ({ data: { total: 4 }, etag: "v4" }),
    setJSON: async (_key, data, options) => {
      assert.equal(data.total, 5);
      assert.equal(options.onlyIfMatch, "v4");
      attempts++;
      return { modified: attempts === 3 };
    },
  };
  await incrementCounter(store);
  assert.equal(attempts, 3);
});

test("frontend only counts download clicks and never interferes with navigation", async () => {
  const source = await readFile(new URL("../download-tracking.js", import.meta.url), "utf8");
  let onClick;
  let clock = 1000;
  const calls = [];
  vm.runInNewContext(source, {
    document: {
      querySelector(selector) {
        assert.equal(selector, ".button-download");
        return { addEventListener(event, handler) {
          assert.equal(event, "click");
          onClick = handler;
        } };
      },
    },
    Date: { now: () => clock },
    fetch: (...args) => { calls.push(args); return Promise.reject(new Error("offline")); },
  });
  assert.equal(calls.length, 0);
  assert.doesNotThrow(() => onClick());
  onClick();
  assert.equal(calls.length, 1);
  clock += 1100;
  onClick();
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "/.netlify/functions/track-download");
  assert.equal(calls[0][1].body, "download");
  assert.equal(calls[0][1].keepalive, true);
  assert.equal(calls[0][1].credentials, "omit");
  assert.equal(calls[0][1].referrerPolicy, "no-referrer");
  await new Promise((resolve) => setImmediate(resolve));
});

test("frontend tolerates missing buttons and unavailable fetch", async () => {
  const source = await readFile(new URL("../download-tracking.js", import.meta.url), "utf8");
  assert.doesNotThrow(() => vm.runInNewContext(source, {
    document: { querySelector: () => null },
  }));
  let click;
  vm.runInNewContext(source, {
    document: { querySelector: () => ({ addEventListener: (_event, fn) => { click = fn; } }) },
  });
  assert.doesNotThrow(() => click());
});

test("page contains one tracker and all PDF links reference the existing file", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal((html.match(/src="download-tracking\.js"/g) || []).length, 1);
  const links = [...html.matchAll(/(?:href|src)="([^"]+\.pdf)"/g)];
  assert.equal(links.length, 3);
  for (const [, href] of links) {
    await access(new URL(`../${decodeURIComponent(href)}`, import.meta.url));
  }
});

test("redesign preserves the download button and has valid images and section links", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal((html.match(/class="button button-download"/g) || []).length, 1);
  assert.match(html, /<html lang="sq">/);
  const images = [...html.matchAll(/<img\s[^>]*src="([^"]+)"[^>]*>/g)];
  assert.equal(images.length, 5);
  for (const [tag, src] of images) {
    assert.match(tag, /alt="[^"]+"/);
    await access(new URL(`../${src}`, import.meta.url));
  }
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes(`id="${anchor}"`), `Missing section: ${anchor}`);
  }
});
