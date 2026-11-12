"use strict";

const CACHE_NAME = "mc-rangers-hike-guide-offline-v1";
const GUIDE_ROOT = new URL(self.registration.scope);

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

function validateURLs(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error("No guide files were supplied.");
  }

  return [...new Set(paths.map(path => {
    const url = new URL(path, GUIDE_ROOT);

    if (
      url.origin !== GUIDE_ROOT.origin ||
      !url.pathname.startsWith(GUIDE_ROOT.pathname)
    ) {
      throw new Error("A file is outside this photo guide.");
    }

    url.search = "";
    url.hash = "";

    return url.href;
  }))];
}

self.addEventListener("message", event => {
  const port = event.ports[0];

  if (!port) return;

  event.waitUntil((async () => {
    try {
      const urls = validateURLs(event.data.urls);
      const cache = await caches.open(CACHE_NAME);

      const ready = await sendRequest("CHECK_GUIDE");

button.disabled = false;

if (!ready && navigator.onLine) {
  button.click();
}
        for (const url of urls) {
          if (!(await cache.match(url))) {
            complete = false;
            break;
          }
        }

        port.postMessage({
          type: "STATUS",
          ready: complete
        });

        return;
      }

      if (event.data.type !== "SAVE_GUIDE") {
        throw new Error("Unknown offline request.");
      }

      let completed = 0;

      for (const url of urls) {
        const controller = new AbortController();

        const timeout = setTimeout(
          () => controller.abort(),
          60000
        );

        try {
          const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal
          });

          if (!response.ok) {
            throw new Error(
              `Could not download ${new URL(url).pathname}`
            );
          }

          const isPhoto = /\.(jpe?g|png|webp|avif)$/i.test(
            new URL(url).pathname
          );

          const contentType =
            response.headers.get("content-type") || "";

          if (isPhoto && !contentType.startsWith("image/")) {
            throw new Error("A checkpoint photo was unavailable.");
          }

          await cache.put(url, response);
        } finally {
          clearTimeout(timeout);
        }

        completed += 1;

        port.postMessage({
          type: "PROGRESS",
          completed,
          total: urls.length
        });
      }

      for (const url of urls) {
        if (!(await cache.match(url))) {
          throw new Error("Some guide files were not saved.");
        }
      }

      port.postMessage({ type: "DONE" });
    } catch (error) {
      port.postMessage({
        type: "ERROR",
        message: error.message || "Download failed."
      });
    }
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== GUIDE_ROOT.origin ||
    !url.pathname.startsWith(GUIDE_ROOT.pathname)
  ) {
    return;
  }

  const indexURL = new URL("index.html", GUIDE_ROOT).href;

  const isGuidePage =
    request.mode === "navigate" &&
    (
      url.pathname === GUIDE_ROOT.pathname ||
      url.pathname === new URL(indexURL).pathname
    );

  if (isGuidePage) {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const saved = await cache.match(indexURL);

        return saved || new Response(
          "This guide has not been saved for offline use. Connect to the internet and save it first.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })());

    return;
  }

  if (url.pathname.includes("/photos/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      url.search = "";
      url.hash = "";

      const saved = await cache.match(url.href);

      return saved || fetch(request);
    })());
  }
});
