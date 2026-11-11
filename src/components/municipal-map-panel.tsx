"use client";
import { useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  COMPONENTS,
  recordTypeOf,
  activityMunicipalities,
  type Activity,
} from "@/lib/domain";
import {
  COMPONENT_COLORS,
  RECURRENCE_SCALE,
  summarizeMunicipalities,
} from "@/lib/municipal-map";
import { number } from "./api";

const TerritoryMap = dynamic(() => import("./territory-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">Preparando cartografía municipal…</div>
  ),
});

export default function MunicipalMapPanel({
  activities,
  onOpen,
  municipality = "",
}: {
  activities: Activity[];
  onOpen: (activity: Activity) => void;
  municipality?: string;
}) {
  const [heat, setHeat] = useState(false);
  const [selected, setSelected] = useState("");
  const municipalitySelectId = useId();
  const summaries = useMemo(
    () => summarizeMunicipalities(activities, municipality),
    [activities, municipality],
  );
  const active = summaries.filter((s) => s.records.length > 0);
  const located = new Set(summaries.flatMap((s) => s.records.map((a) => a.id)));
  const territorialRecords = activities.filter(
    (a) => recordTypeOf(a) !== "Noticia",
  );
  const unassigned = territorialRecords.filter(
    (a) => !located.has(a.id),
  ).length;
  const chosen = municipality || selected;
  const current = summaries.find((s) => s.name === chosen);
  const records = [...(current ? current.records : territorialRecords)].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  );
  return (
    <section className="panel map-panel municipal-map-panel">
      <div className="panel-heading">
        <div>
          <h2>Presencia en el territorio</h2>
          <p>
            {heat
              ? "Recurrencia de acciones por municipio"
              : "Cobertura municipal y componentes de Nariño 360"}
          </p>
        </div>
        <div className="map-view-controls">
          <div className="segmented" role="group" aria-label="Vista del mapa">
            <button
              className={!heat ? "selected" : ""}
              aria-pressed={!heat}
              onClick={() => setHeat(false)}
            >
              Mapa de acciones
            </button>
            <button
              className={heat ? "selected" : ""}
              aria-pressed={heat}
              onClick={() => setHeat(true)}
            >
              Mapa de calor
            </button>
          </div>
          <span className="map-record-count" role="status">
            {number(territorialRecords.length)}{" "}
            {territorialRecords.length === 1 ? "acción" : "acciones"} ·{" "}
            {active.length} de 64 municipios
          </span>
        </div>
      </div>
      <div className="municipal-map-layout">
        <div className="municipal-cartography">
          <TerritoryMap
            summaries={summaries}
            heat={heat}
            selectedMunicipality={chosen}
            onSelect={setSelected}
          />
          <div className="municipal-legend" aria-label="Leyenda del mapa">
            <strong>
              {heat
                ? "Acciones por municipio"
                : "Componentes · anillo por participación"}
            </strong>
            {heat
              ? RECURRENCE_SCALE.map((band) => (
                  <span key={band.min}>
                    <i style={{ background: band.color }} />
                    {band.label}
                  </span>
                ))
              : COMPONENTS.map((component) => (
                  <span key={component}>
                    <i style={{ background: COMPONENT_COLORS[component] }} />
                    {component}
                  </span>
                ))}
            {!heat && (
              <span className="coverage-key">
                <i style={{ background: "#b5ddb9" }} />
                Municipio con acciones
              </span>
            )}
          </div>
        </div>
        <aside
          className="municipal-records"
          aria-label="Detalle de acciones del mapa"
        >
          <div className="municipal-selector">
            <label htmlFor={municipalitySelectId}>Explorar municipio</label>
            <select
              id={municipalitySelectId}
              value={chosen}
              disabled={Boolean(municipality)}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Todos los municipios</option>
              {[...summaries]
                .sort((a, b) => a.name.localeCompare(b.name, "es"))
                .map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.name} ({s.records.length})
                  </option>
                ))}
            </select>
          </div>
          <div className="municipal-list-heading">
            <h3>{current ? current.name : "Todas las acciones"}</h3>
            <span role="status">
              {number(records.length)}{" "}
              {records.length === 1 ? "registro" : "registros"}
            </span>
            {selected && !municipality && (
              <button
                className="municipal-reset"
                onClick={() => setSelected("")}
              >
                Ver todos
              </button>
            )}
          </div>
          {current && (
            <div className="municipal-component-summary">
              {current.components.map((c) => (
                <span key={c.name}>
                  <i style={{ background: c.color }} />
                  {c.name}: {c.count}
                </span>
              ))}
            </div>
          )}
          {records.length > 3 && (
            <p className="municipal-list-hint">
              Listado completo · desplázate para ver más
            </p>
          )}
          <div className="map-record-list">
            {records.map((a) => (
              <button
                key={a.id}
                className="map-record"
                data-activity-id={a.id}
                onClick={() => onOpen(a)}
              >
                <span className="map-record-type">
                  <i style={{ background: COMPONENT_COLORS[a.program] }} />
                  {recordTypeOf(a)} · {a.program}
                </span>
                <strong>{a.title}</strong>
                <span>
                  {activityMunicipalities(a).join(", ")} ·{" "}
                  {a.date.split("-").reverse().join("/")}
                </span>
                <span className="map-record-open">Ver registro →</span>
              </button>
            ))}
            {!records.length && (
              <p className="municipal-empty">
                No hay acciones registradas para esta selección.
              </p>
            )}
          </div>
        </aside>
      </div>
      <p className="map-point-note">
        {heat
          ? "Cada actividad, operativo o feria cuenta como una acción. El color indica cuántas se registraron en el municipio dentro de los filtros actuales; no mide beneficiarios."
          : "El número indica el total de acciones del municipio; el anillo muestra sus componentes. Selecciona un municipio para consultar cada registro."}{" "}
        Las ubicaciones son referencias municipales, no sitios exactos de
        ejecución. Las noticias se consultan en Componentes. Una actividad
        compartida aparece en cada municipio seleccionado, pero se cuenta una
        sola vez en el total de acciones.
      </p>
      {unassigned > 0 && (
        <p className="map-point-note" role="status">
          {unassigned} registros no se pudieron asociar a un municipio. Revisa
          el campo Municipio en Jornadas y actividades.
        </p>
      )}
      <p className="cartography-source">
        Límites municipales: DANE, MGN 2018 · geometría generalizada,
        geoColombia. Referencias situadas dentro de cada municipio.
      </p>
    </section>
  );
}
