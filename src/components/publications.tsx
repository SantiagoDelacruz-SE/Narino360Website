"use client";
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  CalendarDays,
  FileText,
  Filter,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PUBLICATION_TYPES, normalize, type Asset } from "@/lib/domain";
import { api, number } from "./api";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
export default function Publications({
  assets,
  canEdit,
  onUpload,
  onRefresh,
  onError,
}: {
  assets: Asset[];
  canEdit: boolean;
  onUpload: () => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [type, setType] = useState(""),
    [query, setQuery] = useState(""),
    [since, setSince] = useState(""),
    [until, setUntil] = useState(""),
    [busy, setBusy] = useState(false);
  const publications = useMemo(
    () => assets.filter((a) => a.kind === "publicacion"),
    [assets],
  );
  const results = useMemo(
    () =>
      publications
        .filter(
          (a) =>
            (!type || a.publicationType === type) &&
            (!query ||
              normalize(a.title + " " + a.caption).includes(
                normalize(query),
              )) &&
            (!since ||
              (a.publicationDate || a.createdAt.slice(0, 10)) >= since) &&
            (!until ||
              (a.publicationDate || a.createdAt.slice(0, 10)) <= until),
        )
        .sort(
          (a, b) =>
            (b.publicationDate || b.createdAt).localeCompare(
              a.publicationDate || a.createdAt,
            ) || b.createdAt.localeCompare(a.createdAt),
        ),
    [publications, type, query, since, until],
  );
  const active = Boolean(type || query || since || until);
  async function remove(asset: Asset) {
    if (
      !window.confirm(
        '¿Eliminar la publicación "' +
          asset.title +
          '"? El archivo también se eliminará.',
      )
    )
      return;
    setBusy(true);
    try {
      await api("/api/media", {
        method: "DELETE",
        body: JSON.stringify({ id: asset.id }),
      });
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="publications-section">
      <div className="publication-intro">
        <div className="publication-intro-icon">
          <BookOpen size={30} />
        </div>
        <div>
          <div className="overline">CONOCIMIENTO PARA EL TERRITORIO</div>
          <h2>Boletines y productos del observatorio</h2>
          <p>
            Consulta los análisis y publicaciones de paz, seguridad y
            convivencia de Nariño.
          </p>
        </div>
        <div className="publication-total">
          <strong>{number(publications.length)}</strong>
          <span>publicaciones cargadas</span>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>Explora nuestras publicaciones</h2>
          <p>
            Boletines periódicos, investigaciones, análisis temáticos y otros
            productos institucionales.
          </p>
        </div>
        {canEdit && (
          <button className="button primary" onClick={onUpload}>
            <Plus size={17} />
            Cargar publicación
          </button>
        )}
      </div>
      <div
        className="publication-categories"
        role="group"
        aria-label="Categorías de publicaciones"
      >
        {PUBLICATION_TYPES.map((category, i) => (
          <button
            key={category}
            className={
              "publication-category category-" +
              i +
              (type === category ? " active" : "")
            }
            onClick={() => setType(type === category ? "" : category)}
            aria-pressed={type === category}
          >
            <FileText size={19} />
            <span>{category}</span>
            <strong>
              {
                publications.filter((a) => a.publicationType === category)
                  .length
              }
            </strong>
          </button>
        ))}
      </div>
      <div
        className="publication-filters"
        aria-label="Filtros de publicaciones"
      >
        <label className="search-box">
          <span className="sr-only">Buscar publicación</span>
          <Search size={16} />
          <input
            aria-label="Buscar publicación"
            placeholder="Buscar por título o descripción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Tipo de publicación</span>
          <select
            aria-label="Filtrar tipo de publicación"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {PUBLICATION_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            aria-label="Publicaciones desde"
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            aria-label="Publicaciones hasta"
            min={since}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <button
          className="text-button"
          disabled={!active}
          onClick={() => {
            setType("");
            setQuery("");
            setSince("");
            setUntil("");
          }}
        >
          Restablecer
        </button>
      </div>
      {since && until && since > until ? (
        <div className="notice error" role="alert">
          La fecha inicial debe ser anterior o igual a la fecha final.
        </div>
      ) : (
        <p className="publication-results">
          <Filter size={14} />
          {number(results.length)}{" "}
          {results.length === 1
            ? "publicación encontrada"
            : "publicaciones encontradas"}
          <span>Ordenadas por fecha de publicación</span>
        </p>
      )}
      {results.length ? (
        <div className="publication-grid">
          {results.map((asset) => (
            <article className="publication-card" key={asset.id}>
              <div className="publication-card-top">
                <span className="publication-file-icon">
                  <FileText size={26} />
                </span>
                <span className="publication-type">
                  {asset.publicationType || "Otros productos"}
                </span>
                <span className="pdf-badge">PDF</span>
              </div>
              <div className="publication-card-body">
                <p className="publication-date">
                  <CalendarDays size={14} />
                  {dateLabel(asset.publicationDate || asset.createdAt)}
                </p>
                <h3>{asset.title}</h3>
                <p className="publication-description">
                  {asset.caption ||
                    "Publicación institucional del Observatorio de Paz, Seguridad y Convivencia."}
                </p>
              </div>
              <footer>
                <a
                  className="button secondary"
                  href={"/api/media/" + asset.id}
                  download
                >
                  <ArrowDownToLine size={16} />
                  Descargar PDF
                </a>
                {canEdit && (
                  <button
                    className="icon-button publication-delete"
                    disabled={busy}
                    onClick={() => void remove(asset)}
                    aria-label={"Eliminar publicación " + asset.title}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <div className="empty-state">
            <div className="empty-icon">
              <BookOpen size={26} />
            </div>
            <h3>
              {active
                ? "No hay publicaciones con estos filtros"
                : "El conocimiento comienza aquí"}
            </h3>
            <p>
              {active
                ? "Prueba otra búsqueda, categoría o rango de fechas."
                : "Los boletines y productos institucionales aparecerán aquí cuando los funcionarios los carguen."}
            </p>
            {canEdit && !active && (
              <button className="button secondary" onClick={onUpload}>
                <Plus size={16} />
                Cargar primera publicación
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
