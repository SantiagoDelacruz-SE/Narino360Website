"use client";
import { useEffect, useState } from "react";
import { reportTotal, type ImpactReport } from "@/lib/impact-domain";
import type { Component } from "@/lib/domain";
import { api, number } from "./api";
export default function ImpactOverview({
  component,
  limited,
  onExplore,
}: {
  component: string;
  limited: boolean;
  onExplore: (component: Component) => void;
}) {
  const [reports, setReports] = useState<ImpactReport[]>([]),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ reports: ImpactReport[] }>("/api/impactos", {
      signal: controller.signal,
    })
      .then((r) => {
        setReports(r.reports);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      });
    return () => controller.abort();
  }, [retry]);
  const visible = reports.filter(
    (r) => !component || r.component === component,
  );
  if (error)
    return (
      <div className="notice" role="status">
        No se pudieron consultar los informes consolidados.{" "}
        <button className="text-link" onClick={() => setRetry(retry + 1)}>
          Reintentar
        </button>
      </div>
    );
  if (!visible.length) return null;
  return (
    <section
      className="panel impact-overview"
      aria-label="Impactos consolidados de informes"
    >
      <div className="section-heading">
        <div>
          <h2>Impacto reportado en informes</h2>
          <p>
            Se presenta por documento y separado de las cifras por jornada, sin
            sumarlos entre sí.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => onExplore(visible[0].component)}
        >
          Consultar informes
        </button>
      </div>
      <div className="impact-overview-grid">
        {visible.map((r) => (
          <article key={r.id}>
            <span className="program-tag">{r.component}</span>
            <h3>{r.title}</h3>
            <strong className="impact-value">
              {limited
                ? "Sin desglose para estos filtros"
                : number(reportTotal(r)) + " personas reportadas"}
            </strong>
            <p>
              {r.audience} ·{" "}
              {r.periodStatus === "Pendiente"
                ? "Período pendiente de aclarar"
                : r.periodStart + " — " + r.periodEnd}
            </p>
            <p>
              {limited
                ? "El documento no distribuye su total entre los municipios, fechas o tipos de jornada seleccionados."
                : "El consolidado no acredita personas únicas ni se reparte entre las entregas."}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
