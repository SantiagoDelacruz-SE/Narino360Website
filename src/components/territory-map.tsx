"use client";
import { useEffect, useRef, useState } from "react";
import { hasLocation, recordTypeOf, type Activity } from "@/lib/domain";
import { MAP_COLORS, pointColor, separatePoints } from "@/lib/map-points";
import { createOsmLayer } from "./osm-layer";
import "leaflet/dist/leaflet.css";

type Props = {
  activities: Activity[];
  onOpen: (activity: Activity) => void;
  heat?: boolean;
  large?: boolean;
};
export default function TerritoryMap({
  activities,
  onOpen,
  heat = false,
  large,
}: Props) {
  const element = useRef<HTMLDivElement>(null),
    open = useRef(onOpen);
  const [tileError, setTileError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    open.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    async function init() {
      const L = (await import("leaflet")).default;
      if (heat) await import("leaflet.heat");
      if (cancelled || !element.current) return;
      const map = L.map(element.current, {
        scrollWheelZoom: false,
        minZoom: 3,
        maxZoom: 18,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView([1.55, -77.65], 7);
      const basemap = createOsmLayer(
        L,
        (status) => {
          if (!cancelled)
            setTileError(
              status
                ? "El proveedor del mapa base respondió HTTP " + status + "."
                : "No se pudo conectar con el proveedor del mapa base.",
            );
        },
        () => {
          if (!cancelled) setTileError(null);
        },
      );
      cleanup = () => {
        basemap.dispose();
        map.stop();
        map.remove();
      };
      basemap.layer.addTo(map);
      const located = activities
        .filter((a) => recordTypeOf(a) !== "Noticia")
        .filter(hasLocation)
        .sort((a, b) => a.id - b.id);
      const maximum = Math.max(0, ...located.map((a) => a.people));
      if (heat) {
        // Heat always uses the original coordinates, not the display offsets
        // that make coincident markers independently selectable.
        L.heatLayer(
          located.map(
            (activity) =>
              [
                activity.latitude,
                activity.longitude,
                Math.max(0.2, maximum > 0 ? activity.people / maximum : 0.2),
              ] as [number, number, number],
          ),
          {
            radius: 28,
            blur: 20,
            minOpacity: 0.4,
            maxZoom: 12,
            gradient: {
              0.2: MAP_COLORS[0],
              0.5: MAP_COLORS[1],
              0.8: MAP_COLORS[2],
              1: MAP_COLORS[3],
            },
          },
        ).addTo(map);
      }
      const links = L.layerGroup().addTo(map);
      const markers = (heat ? [] : located).map((activity) => {
        const dot = document.createElement("span");
        dot.style.backgroundColor = pointColor(activity.people, maximum);
        dot.setAttribute("aria-hidden", "true");
        const marker = L.marker([activity.latitude, activity.longitude], {
          icon: L.divIcon({
            className: "territory-marker",
            html: dot,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          title: recordTypeOf(activity) + ": " + activity.title,
          keyboard: true,
        })
          .on("click", () => open.current(activity))
          .addTo(map);
        marker
          .getElement()
          ?.setAttribute(
            "aria-label",
            recordTypeOf(activity) + " #" + activity.id + ": " + activity.title,
          );
        marker
          .getElement()
          ?.setAttribute("data-activity-id", String(activity.id));
        marker.getElement()?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          open.current(activity);
        });
        return marker;
      });
      if (located.length)
        map.fitBounds(
          L.latLngBounds(located.map((a) => [a.latitude, a.longitude])),
          { padding: [60, 60], maxZoom: 11, animate: false },
        );
      const arrange = () => {
        const size = map.getSize();
        const actual = markers.map((marker) =>
          map.latLngToContainerPoint(marker.getLatLng()),
        );
        const symbols = separatePoints(actual, size.x, size.y);
        links.clearLayers();
        markers.forEach((marker, index) => {
          const dx = symbols[index].x - actual[index].x,
            dy = symbols[index].y - actual[index].y;
          const icon = marker.getElement();
          if (icon) {
            icon.style.marginLeft = dx - 11 + "px";
            icon.style.marginTop = dy - 11 + "px";
          }
          if (Math.hypot(dx, dy) > 1)
            L.polyline(
              [
                marker.getLatLng(),
                map.containerPointToLatLng([
                  symbols[index].x,
                  symbols[index].y,
                ]),
              ],
              {
                color: "#0071AC",
                opacity: 0.45,
                weight: 1,
                dashArray: "3 3",
                interactive: false,
              },
            ).addTo(links);
        });
      };
      map.on("zoomend resize", arrange);
      arrange();
      setTimeout(() => {
        if (!cancelled) {
          map.invalidateSize();
          arrange();
        }
      }, 100);
    }
    void init().catch(() => {
      if (!cancelled) {
        cleanup();
        setTileError("No se pudo iniciar el mapa. Vuelve a intentarlo.");
      }
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [activities, attempt, heat]);
  return (
    <div
      className={
        "map-container " +
        (heat ? "heat-view " : "point-map ") +
        (large ? "large" : "")
      }
    >
      <div
        ref={element}
        className="leaflet-map"
        aria-label={
          heat
            ? "Mapa de calor de actividades y operativos en Nariño"
            : "Mapa de actividades y operativos individuales en Nariño"
        }
      />
      {tileError && (
        <div className="map-feedback" role="status">
          <strong>Mapa base no disponible</strong>
          <p>
            {tileError}{" "}
            {heat
              ? "La capa de calor sigue disponible."
              : "Los puntos individuales y sus detalles siguen disponibles."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setTileError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar mapa
          </button>
        </div>
      )}
      {!activities.length && !tileError && (
        <div className="map-empty">
          <span className="status-dot" />
          <strong>El territorio espera sus primeros registros</strong>
          <span>
            Las actividades aparecerán aquí al cargar sus coordenadas.
          </span>
        </div>
      )}
      <div className="map-location">
        NARIÑO <span>COLOMBIA</span>
      </div>
    </div>
  );
}
