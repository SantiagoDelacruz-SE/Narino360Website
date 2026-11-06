"use client";
import { useEffect, useRef } from "react";
import type { Activity } from "@/lib/domain";
import { number } from "./api";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
type Props = { activities: Activity[]; heat: boolean; large?: boolean };
export default function TerritoryMap({ activities, heat, large }: Props) {
  const element = useRef<HTMLDivElement>(null);
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
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView([1.55, -77.65], 7);
      cleanup = () => {
        map.stop();
        map.remove();
      };
      const tiles = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 18,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      ).addTo(map);
      const status = L.control
        .attribution({ prefix: false, position: "bottomleft" })
        .addTo(map);
      tiles.on("tileerror", () =>
        status.setPrefix(
          "Cartografía no disponible. Consulta las coordenadas en los registros.",
        ),
      );
      if (heat) {
        const max = Math.max(1, ...activities.map((a) => a.people));
        L.heatLayer(
          activities.map(
            (a) =>
              [a.latitude, a.longitude, Math.max(0.15, a.people / max)] as [
                number,
                number,
                number,
              ],
          ),
          {
            radius: 35,
            blur: 25,
            minOpacity: 0.35,
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
        const groups = new Map<string, Activity[]>();
        activities.forEach((a) => {
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
      if (activities.length)
        map.fitBounds(
          L.latLngBounds(activities.map((a) => [a.latitude, a.longitude])),
          { padding: [45, 45], maxZoom: 11, animate: false },
        );
      setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 100);
    }
    void init();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [activities, heat]);
  return (
    <div className={"map-container " + (large ? "large" : "")}>
      <div
        ref={element}
        className="leaflet-map"
        aria-label="Mapa de jornadas registradas en Nariño"
      />
      {!activities.length && (
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
