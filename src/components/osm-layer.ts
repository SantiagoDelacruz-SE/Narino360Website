import type * as Leaflet from "leaflet";

// Keep the provider's normal HTTP cache and browser identity. Do not proxy,
// rotate hosts, prefetch regions or automatically retry blocked requests.
export function createOsmLayer(
  L: typeof Leaflet,
  onUnavailable: (status?: number) => void,
  onReady: () => void,
) {
  type PendingTile = {
    controller: AbortController;
    url?: string;
    active: boolean;
    image: HTMLImageElement;
  };
  const pending = new Map<HTMLElement, PendingTile>();
  let disposed = false;
  let blocked = false;
  let ready = false;
  function release(tile: HTMLElement) {
    const item = pending.get(tile);
    if (!item) return;
    item.active = false;
    item.controller.abort();
    item.image.onload = null;
    item.image.onerror = null;
    if (item.url) URL.revokeObjectURL(item.url);
    pending.delete(tile);
  }
  function fail(status?: number) {
    if (disposed || blocked) return;
    blocked = true;
    layer.setOpacity(0);
    for (const tile of pending.keys()) release(tile);
    onUnavailable(status);
    // Defer removal until Leaflet finishes its current tile callback.
    queueMicrotask(() => {
      if (!disposed) layer.remove();
    });
  }
  class CheckedTiles extends L.GridLayer {
    protected createTile(
      coords: Leaflet.Coords,
      done: Leaflet.DoneCallback,
    ): HTMLElement {
      const image = document.createElement("img");
      image.alt = "";
      image.setAttribute("role", "presentation");
      image.style.visibility = "hidden";
      if (disposed || blocked) {
        queueMicrotask(() => {
          if (!disposed) done(undefined, image);
        });
        return image;
      }
      const item: PendingTile = {
        controller: new AbortController(),
        active: true,
        image,
      };
      pending.set(image, item);
      void (async () => {
        try {
          const response = await fetch(
            `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`,
            {
              signal: item.controller.signal,
              credentials: "omit",
              cache: "default",
              referrerPolicy: "strict-origin-when-cross-origin",
            },
          );
          if (!item.active || disposed || blocked) return;
          if (!response.ok) {
            fail(response.status);
            return;
          }
          if (
            !response.headers
              .get("content-type")
              ?.toLowerCase()
              .startsWith("image/")
          ) {
            fail();
            return;
          }
          const blob = await response.blob();
          if (!item.active || disposed || blocked) return;
          item.url = URL.createObjectURL(blob);
          image.onload = () => {
            if (!item.active || disposed || blocked) return;
            image.style.visibility = "";
            release(image);
            done(undefined, image);
            if (!ready) {
              ready = true;
              onReady();
            }
          };
          image.onerror = () => {
            if (item.active) fail();
          };
          image.src = item.url;
        } catch {
          if (item.active && !disposed && !blocked) fail();
        }
      })();
      return image;
    }
  }
  const layer = new CheckedTiles({
    tileSize: 256,
    maxZoom: 18,
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 1,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  layer.on("tileunload", (event: Leaflet.TileEvent) => release(event.tile));
  return {
    layer,
    dispose() {
      disposed = true;
      for (const tile of pending.keys()) release(tile);
    },
  };
}
