"use client";
import { useId, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Utensils,
  Sprout,
  Users,
  CalendarDays,
  FileText,
  Plus,
} from "lucide-react";
import {
  COMPONENTS,
  assetComponent,
  recordTypeOf,
  type Activity,
  type Asset,
  type Component,
  type RecordType,
} from "@/lib/domain";
import Publications from "./publications";
import { number } from "./api";
import ImpactWorkspace from "./impact-workspace";

const icons = [BookOpen, ShieldCheck, Utensils, Sprout, Users];
const sections = [
  "Resumen",
  "Actividades",
  "Operativos",
  "Ferias",
  "Noticias",
  "Documentos",
  "Entregas e impactos",
] as const;
type Section = (typeof sections)[number];
export default function ComponentsHub({
  component,
  onSelect,
  activities,
  assets,
  canEdit,
  isAdmin,
  initialImpacts,
  onCreate,
  onOpen,
  onUpload,
  onPreview,
  onRefresh,
  onError,
}: {
  component: Component | null;
  onSelect: (component: Component | null) => void;
  activities: Activity[];
  assets: Asset[];
  canEdit: boolean;
  isAdmin: boolean;
  initialImpacts: boolean;
  onCreate: (type: RecordType, component: Component) => void;
  onOpen: (activity: Activity) => void;
  onUpload: (component?: Component) => void;
  onPreview: (asset: Asset) => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [section, setSection] = useState<Section>(
    initialImpacts
      ? "Entregas e impactos"
      : component === "Observatorio"
        ? "Documentos"
        : "Resumen",
  );
  const [library, setLibrary] = useState(false);
  const tabId = useId();
  if (!component)
    return (
      <section className="components-hub">
        <div className="section-heading">
          <div>
            <h2>Cinco componentes, una estrategia</h2>
            <p>
              Entra a cada componente para explorar sus intervenciones,
              novedades y documentos.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => setLibrary(!library)}
          >
            <FileText size={17} />
            {library ? "Ocultar biblioteca" : "Todos los PDF"}
          </button>
        </div>
        <div className="component-grid">
          {COMPONENTS.map((name, index) => {
            const Icon = icons[index];
            const rows = activities.filter((a) => a.program === name);
            const pdfs = assets.filter(
              (a) =>
                assetComponent(a, activities) === name &&
                (a.kind === "publicacion" || a.kind === "documento"),
            );
            return (
              <button
                key={name}
                className={"component-card component-" + index}
                onClick={() => onSelect(name)}
                aria-label={"Abrir componente " + name}
              >
                <span className="component-card-icon">
                  <Icon size={27} />
                </span>
                <h3>{name}</h3>
                <p>
                  {name === "Observatorio"
                    ? "Boletines, investigación y conocimiento para las decisiones."
                    : name === "PISCC"
                      ? "Planeación y acciones de seguridad y convivencia ciudadana."
                      : name === "Banco de Alimentos"
                        ? "Atención comunitaria y seguridad alimentaria."
                        : name === "Cultivos para la Paz"
                          ? "Desarrollo territorial y construcción de paz."
                          : "Articulación institucional y presencia en el territorio."}
                </p>
                <div className="component-card-counts">
                  <span>
                    <strong>
                      {number(
                        rows.filter((a) => recordTypeOf(a) === "Operativo")
                          .length,
                      )}
                    </strong>{" "}
                    operativos
                  </span>
                  <span>
                    <strong>
                      {number(
                        rows.filter((a) =>
                          ["Actividad", "Feria"].includes(recordTypeOf(a)),
                        ).length,
                      )}
                    </strong>{" "}
                    actividades
                  </span>
                  <span>
                    <strong>{number(pdfs.length)}</strong> PDF
                  </span>
                </div>
                <span className="component-enter">
                  Explorar componente <ArrowRight size={17} />
                </span>
              </button>
            );
          })}
        </div>
        {library && (
          <Publications
            assets={assets}
            canEdit={canEdit}
            onUpload={() => onUpload()}
            onPreview={onPreview}
            onRefresh={onRefresh}
            onError={onError}
          />
        )}
      </section>
    );

  const records = activities
    .filter((a) => a.program === component)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const documents = assets.filter(
    (asset) => assetComponent(asset, activities) === component,
  );
  const matches = (a: Activity) =>
    section === "Resumen" ||
    (section === "Actividades" &&
      ["Actividad", "Feria"].includes(recordTypeOf(a))) ||
    (section === "Operativos" && recordTypeOf(a) === "Operativo") ||
    (section === "Ferias" && recordTypeOf(a) === "Feria") ||
    (section === "Noticias" && recordTypeOf(a) === "Noticia");
  const rows = records.filter(matches);
  const newType: RecordType =
    section === "Operativos"
      ? "Operativo"
      : section === "Ferias"
        ? "Feria"
        : section === "Noticias"
          ? "Noticia"
          : "Actividad";
  return (
    <section className="components-hub">
      <button className="text-link" onClick={() => onSelect(null)}>
        <ArrowLeft size={16} />
        Todos los componentes
      </button>
      <div className="component-detail-heading">
        <div>
          <span className="overline">ESTRATEGIA NARIÑO 360</span>
          <h2>{component}</h2>
          <p>
            Resultados, presencia institucional y conocimiento de este
            componente.
          </p>
        </div>
      </div>
      <div
        className="component-tabs"
        role="tablist"
        aria-label={"Secciones de " + component}
      >
        {sections.map((name, index) => (
          <button
            role="tab"
            key={name}
            id={tabId + "-" + index}
            aria-controls={tabId + "-panel"}
            tabIndex={section === name ? 0 : -1}
            aria-selected={section === name}
            onClick={() => setSection(name)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight")
                next = (index + 1) % sections.length;
              else if (event.key === "ArrowLeft")
                next = (index + sections.length - 1) % sections.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = sections.length - 1;
              else return;
              event.preventDefault();
              setSection(sections[next]);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next].focus();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={tabId + "-panel"}
        aria-labelledby={tabId + "-" + sections.indexOf(section)}
      >
        {section === "Entregas e impactos" ? (
          <ImpactWorkspace
            component={component}
            activities={activities}
            assets={assets}
            canEdit={canEdit}
            isAdmin={isAdmin}
            onPreview={onPreview}
            onOpen={onOpen}
            onRefresh={onRefresh}
          />
        ) : section === "Documentos" ? (
          <Publications
            component={component}
            assets={documents}
            canEdit={canEdit}
            onUpload={() => onUpload(component)}
            onPreview={onPreview}
            onRefresh={onRefresh}
            onError={onError}
          />
        ) : (
          <div>
            {section === "Resumen" && (
              <div className="component-summary">
                {[
                  [
                    "Actividades y ferias",
                    records.filter((a) =>
                      ["Actividad", "Feria"].includes(recordTypeOf(a)),
                    ).length,
                  ],
                  [
                    "Operativos",
                    records.filter((a) => recordTypeOf(a) === "Operativo")
                      .length,
                  ],
                  [
                    "Noticias",
                    records.filter((a) => recordTypeOf(a) === "Noticia").length,
                  ],
                  [
                    "Documentos PDF",
                    documents.filter(
                      (a) => a.kind === "documento" || a.kind === "publicacion",
                    ).length,
                  ],
                ].map(([name, count]) => (
                  <article key={name}>
                    <span>{name}</span>
                    <strong>{number(Number(count))}</strong>
                  </article>
                ))}
              </div>
            )}
            <div className="section-heading">
              <div>
                <h3>{section === "Resumen" ? "Lo más reciente" : section}</h3>
                <p>
                  {rows.length} registros disponibles
                  {section === "Resumen" && rows.length > 6
                    ? " · mostrando los 6 más recientes"
                    : ""}
                </p>
              </div>
              {canEdit && (
                <button
                  className="button primary"
                  onClick={() => onCreate(newType, component)}
                >
                  <Plus size={16} />
                  {newType === "Noticia"
                    ? "Publicar noticia"
                    : "Registrar " + newType.toLowerCase()}
                </button>
              )}
            </div>
            {rows.length ? (
              <div className="component-records">
                {(section === "Resumen" ? rows.slice(0, 6) : rows).map((a) => (
                  <article key={a.id} className="component-record">
                    <div className="component-record-meta">
                      <span
                        className={
                          "record-type type-" + recordTypeOf(a).toLowerCase()
                        }
                      >
                        {recordTypeOf(a)}
                      </span>
                      <span>
                        <CalendarDays size={14} />
                        {a.date}
                      </span>
                    </div>
                    <h3>{a.title}</h3>
                    <p className="muted">{a.municipality}</p>
                    <p className="component-record-excerpt">{a.summary}</p>
                    <button className="text-link" onClick={() => onOpen(a)}>
                      Ver detalle <ArrowRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="panel">
                <div className="empty-state">
                  <h3>
                    Aún no hay{" "}
                    {section === "Resumen"
                      ? "registros"
                      : section.toLowerCase()}{" "}
                    en este componente
                  </h3>
                  <p>
                    Los contenidos aparecerán aquí cuando se registren. Puedes
                    explorar las otras secciones.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
