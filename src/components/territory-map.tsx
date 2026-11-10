"use client";
import { useEffect, useRef, useState } from "react";
import { hasLocation, recordTypeOf, type Activity } from "@/lib/domain";
import { number } from "./api";
import { createOsmLayer } from "./osm-layer";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
type Props = { activities: Activity[]; heat: boolean; large?: boolean };
export default function TerritoryMap({ activities, heat, large }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const [tileError, setTileError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    async function init() {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      await import("leaflet.heat");
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
        .filter(hasLocation);
      if (heat) {
        const max = Math.max(1, ...located.map((a) => a.people));
        L.heatLayer(
          located.map(
            (a) =>
              [a.latitude, a.longitude, Math.max(0.35, a.people / max)] as [
                number,
                number,
                number,
              ],
          ),
          {
            radius: 42,
            blur: 18,
            minOpacity: 0.68,
            maxZoom: 9,
            gradient: {
              0.2: "#80BEFF",
              0.5: "#10A13B",
              0.8: "#FFD500",
              1: "#DA1C24",
            },
          },
        ).addTo(map);
      } else {
        const cluster = L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 45,
        });
        const groups = new Map<
          string,
          (Activity & { latitude: number; longitude: number })[]
        >();
        located.forEach((a) => {
          const key = a.latitude + "," + a.longitude;
          groups.set(key, [...(groups.get(key) || []), a]);
        });
        for (const list of groups.values()) {
          const content = document.createElement("div");
          content.className = "map-popup";
          const heading = document.createElement("strong");
          heading.textContent = list[0].municipality;
          content.append(heading);
          for (const a of list) {
            const item = document.createElement("p");
            item.textContent =
              a.title +
              " · " +
              recordTypeOf(a) +
              " · " +
              a.program +
              " · " +
              a.date +
              " · " +
              number(a.people) +
              " personas. " +
              (a.pisccGoal ? "Meta PISCC: " + a.pisccGoal + ". " : "") +
              a.summary;
            content.append(item);
          }
          const icon = L.divIcon({
            className: "territory-marker",
            html: "<span></span>",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          L.marker([list[0].latitude, list[0].longitude], { icon })
            .bindPopup(content, { maxWidth: 340 })
            .addTo(cluster);
        }
        cluster.addTo(map);
      }
      if (located.length)
        map.fitBounds(
          L.latLngBounds(located.map((a) => [a.latitude, a.longitude])),
          { padding: [45, 45], maxZoom: 11, animate: false },
        );
      setTimeout(() => {
        if (!cancelled) map.invalidateSize();
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
  }, [activities, heat, attempt]);
  return (
    <div
      className={
        "map-container " + (heat ? "heat-view " : "") + (large ? "large" : "")
      }
    >
      <div
        ref={element}
        className="leaflet-map"
        aria-label="Mapa de jornadas registradas en Nariño"
      />
      {tileError && (
        <div className="map-feedback" role="status">
          <strong>Mapa base no disponible</strong>
          <p>
            {tileError} Las jornadas y sus coordenadas siguen disponibles.
            Comprueba el acceso a OpenStreetMap desde tu red.
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
          <span>Las jornadas aparecerán aquí al cargar sus coordenadas.</span>
        </div>
      )}
      <div className="map-location">
        NARIÑO <span>COLOMBIA</span>
      </div>
    </div>
  );
}
