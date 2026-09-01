import { getStore } from "@netlify/blobs";
import { createHandler } from "../../lib/download-counter.mjs";

export default createHandler(getStore);

export const config = {
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["ip", "domain"],
    windowSize: 60,
    windowLimit: 20,
  },
};
