"use client";
import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  cartography,
  componentRing,
  recurrenceColor,
  type MunicipalSummary,
} from "@/lib/municipal-map";
import { createOsmLayer } from "./osm-layer";
import "leaflet/dist/leaflet.css";

type Props = {
  summaries: MunicipalSummary[];
  onSelect: (municipality: string) => void;
  selectedMunicipality: string;
  heat: boolean;
};
export default function TerritoryMap({
  summaries,
  onSelect,
  selectedMunicipality,
  heat,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  const selected = useRef(selectedMunicipality);
  const updateSelection = useRef<() => void>(() => {});
  const [tileError, setTileError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    selected.current = selectedMunicipality;
    updateSelection.current();
  }, [selectedMunicipality]);
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !element.current) return;
      const map = L.map(element.current, {
        scrollWheelZoom: false,
        minZoom: 6,
        maxZoom: 18,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      });
      cleanup = () => {
        map.stop();
        map.remove();
      };
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
      basemap.layer.addTo(map);
      const byName = new Map(summaries.map((s) => [s.name, s]));
      const geometry = L.geoJSON(cartography as FeatureCollection, {
        style: (feature) => {
          const summary = byName.get(feature!.properties.name)!;
          return {
            color: "#355246",
            weight: 1.1,
            opacity: 1,
            fillColor: heat
              ? recurrenceColor(summary.records.length)
              : summary.records.length
                ? "#b5ddb9"
                : "#FFFFFF",
            fillOpacity: heat ? 0.88 : 0.78,
          };
        },
        onEachFeature: (feature, layer) => {
          const summary = byName.get(feature.properties.name)!;
          const tooltip = document.createElement("div");
          const heading = document.createElement("strong");
          heading.textContent =
            summary.name + " · " + summary.records.length + " acciones";
          tooltip.appendChild(heading);
          summary.components.forEach((component) => {
            const line = document.createElement("div");
            line.textContent = component.name + ": " + component.count;
            tooltip.appendChild(line);
          });
          layer.bindTooltip(tooltip, { sticky: true });
          layer.on("click", () => select.current(summary.name));
          layer.on("add", () => {
            const path = (layer as import("leaflet").Path).getElement();
            if (!path) return;
            path.setAttribute("data-municipality", summary.name);
            path.setAttribute(
              "data-action-count",
              String(summary.records.length),
            );
            path.setAttribute(
              "aria-label",
              summary.name + ": " + summary.records.length + " acciones",
            );
            // The native municipality selector provides keyboard access to all
            // polygons, including very small or empty municipalities.
          });
        },
      }).addTo(map);
      // Initialize the view before adding markers so their elements exist when
      // assigning accessible names and selection/keyboard behavior.
      const bounds = geometry.getBounds();
      map.fitBounds(bounds, { padding: [18, 18], animate: false });
      const markers: { marker: import("leaflet").Marker; name: string }[] = [];
      if (!heat)
        summaries
          .filter((s) => s.records.length)
          .forEach((summary) => {
            const ring = document.createElement("div");
            ring.className = "municipal-ring";
            ring.style.background = componentRing(summary);
            const total = document.createElement("strong");
            total.textContent = String(summary.records.length);
            ring.appendChild(total);
            const marker = L.marker([summary.anchor[1], summary.anchor[0]], {
              icon: L.divIcon({
                className: "territory-marker municipal-marker",
                html: ring,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              }),
              title:
                summary.name +
                ": " +
                summary.records.length +
                " acciones · referencia municipal",
              keyboard: true,
            })
              .on("click", () => select.current(summary.name))
              .addTo(map);
            const icon = marker.getElement();
            icon?.setAttribute(
              "aria-label",
              summary.name +
                ": " +
                summary.records.length +
                " acciones. Referencia municipal, no sitio exacto.",
            );
            icon?.setAttribute("data-municipality", summary.name);
            icon?.setAttribute("data-anchor", summary.anchor.join(","));
            icon?.addEventListener("keydown", (event) => {
              if (event.key !== " ") return;
              event.preventDefault();
              select.current(summary.name);
            });
            markers.push({ marker, name: summary.name });
          });
      updateSelection.current = () => {
        geometry.eachLayer((layer) => {
          const shape = layer as import("leaflet").Polygon;
          const isSelected =
            shape.feature?.properties.name === selected.current;
          shape.setStyle({
            weight: isSelected ? 3 : 1.1,
            color: isSelected ? "#000000" : "#355246",
          });
          if (isSelected) shape.bringToFront();
        });
        markers.forEach(({ marker, name }) =>
          marker
            .getElement()
            ?.classList.toggle(
              "municipal-marker-selected",
              name === selected.current,
            ),
        );
      };
      updateSelection.current();
      map.setMaxBounds(bounds.pad(0.6));
      map.attributionControl.addAttribution(
        "Límites: DANE MGN 2018 / geoColombia",
      );
      const observer = new ResizeObserver(() => {
        map.invalidateSize({ pan: false });
        map.fitBounds(bounds, { padding: [18, 18], animate: false });
      });
      observer.observe(element.current);
      cleanup = () => {
        observer.disconnect();
        updateSelection.current = () => {};
        basemap.dispose();
        map.stop();
        map.remove();
      };
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
  }, [summaries, heat, attempt]);
  return (
    <div
      className={"municipal-map-frame " + (heat ? "heat-mode" : "actions-mode")}
    >
      <div className={"map-container " + (heat ? "heat-view" : "action-map")}>
        <div
          ref={element}
          className="leaflet-map"
          aria-label={
            heat
              ? "Mapa de calor: cantidad de acciones por municipio de Nariño"
              : "Mapa de acciones y cobertura de los 64 municipios de Nariño"
          }
        />
        <div className="map-location">
          NARIÑO <span>COLOMBIA</span>
        </div>
      </div>
      {tileError && (
        <div className="map-feedback" role="status">
          <strong>Mapa base no disponible</strong>
          <p>
            {tileError} Los límites municipales, las acciones y sus detalles
            siguen disponibles.
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
    </div>
  );
}
