/* eslint-disable @next/next/no-img-element -- private HD evidence uses authenticated original URLs */
"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity as ActivityIcon,
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileText,
  Filter,
  Images,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Presentation as PresentationIcon,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sprout,
  Trash2,
  Users,
  Utensils,
  X,
  Pencil,
  KeyRound,
} from "lucide-react";
import {
  MUNICIPALITIES,
  PROGRAMS,
  REFERENCES,
  normalize,
  type Activity,
  type Asset,
  type Identity,
} from "@/lib/domain";
import { api, number, csvDownload, SESSION_EXPIRED_EVENT } from "./api";
import Modal from "./modal";
import ActivityForm from "./activity-form";
import MediaUpload from "./media-upload";
import Presentation from "./presentation";
import Publications from "./publications";
const TerritoryMap = dynamic(() => import("./territory-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Preparando cartografía…</div>,
});
const navigation = [
  { id: "resumen", label: "Vista general", icon: LayoutDashboard },
  { id: "territorio", label: "Mapa territorial", icon: MapPin },
  { id: "jornadas", label: "Jornadas y actividades", icon: ClipboardList },
  { id: "evidencias", label: "Mural de evidencias", icon: Images },
  {
    id: "presentacion",
    label: "Presentación estratégica",
    icon: PresentationIcon,
  },
  { id: "observatorio", label: "Observatorio", icon: FileText },
];
type Tab = (typeof navigation)[number]["id"] | "auditoria";
type ModalState =
  | { type: "activity"; activity?: Activity }
  | { type: "detail"; activity: Activity }
  | { type: "upload"; kind: Asset["kind"] }
  | { type: "image"; asset: Asset }
  | { type: "account" }
  | null;
const programIcons = [ShieldCheck, Sprout, Utensils, Users];
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
export default function Observatory({
  user,
  initialActivities,
  initialAssets,
}: {
  user: Identity;
  initialActivities: Activity[];
  initialAssets: Asset[];
}) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities),
    [assets, setAssets] = useState(initialAssets),
    [tab, setTab] = useState<Tab>("resumen"),
    [menu, setMenu] = useState(false);
  const [program, setProgram] = useState(""),
    [municipality, setMunicipality] = useState(""),
    [search, setSearch] = useState(""),
    [since, setSince] = useState(""),
    [until, setUntil] = useState("");
  const [heat, setHeat] = useState(false),
    [columns, setColumns] = useState(3),
    [modal, setModal] = useState<ModalState>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const canEdit = user.role !== "Invitado";
  useEffect(() => {
    const update = () => {
      const value = window.location.hash.slice(1);
      if (
        navigation.some((n) => n.id === value) ||
        (value === "auditoria" && user.role === "Administrador")
      )
        setTab(value);
    };
    update();
    window.addEventListener("hashchange", update);
    const expire = () => setSessionExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
    };
  }, [user.role]);
  const filtered = useMemo(
    () =>
      activities.filter(
        (a) =>
          (!program || a.program === program) &&
          (!municipality || a.municipality === municipality) &&
          (!since || a.date >= since) &&
          (!until || a.date <= until) &&
          (!search ||
            normalize(
              a.title + " " + a.summary + " " + a.municipality,
            ).includes(normalize(search))),
      ),
    [activities, program, municipality, since, until, search],
  );
  const selectedAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          (!program || a.program === program) &&
          (!municipality || a.municipality === municipality) &&
          (!since || a.createdAt.slice(0, 10) >= since) &&
          (!until || a.createdAt.slice(0, 10) <= until) &&
          (!search ||
            normalize(a.title + " " + a.caption).includes(normalize(search))),
      ),
    [assets, program, municipality, since, until, search],
  );
  const totals = useMemo(
    () =>
      filtered.reduce(
        (t, a) => ({
          people: t.people + a.people,
          families: t.families + a.families,
          weapons: t.weapons + a.weaponsSeized + a.weaponsVoluntary,
        }),
        { people: 0, families: 0, weapons: 0 },
      ),
    [filtered],
  );
  const covered = new Set(filtered.map((a) => a.municipality)).size;
  const title =
    tab === "auditoria"
      ? "Auditoría de accesos"
      : navigation.find((n) => n.id === tab)?.label || "Vista general";
  function navigate(id: Tab) {
    setTab(id);
    setMenu(false);
    window.history.pushState(null, "", "#" + id);
  }
  async function refresh() {
    const [a, m] = await Promise.all([
      api<{ activities: Activity[] }>("/api/jornadas"),
      api<{ assets: Asset[] }>("/api/media"),
    ]);
    setActivities(a.activities);
    setAssets(m.assets);
  }
  async function saved() {
    await refresh();
    setModal(null);
    setToast("Información guardada correctamente.");
  }
  function reset() {
    setProgram("");
    setMunicipality("");
    setSearch("");
    setSince("");
    setUntil("");
  }
  const filtersActive = Boolean(
    program || municipality || search || since || until,
  );
  function exportRows() {
    if (!filtered.length) {
      setToast("No hay jornadas para exportar con estos filtros.");
      return;
    }
    csvDownload(
      filtered.map((a) => ({
        ID: a.id,
        Fecha: a.date,
        Titulo: a.title,
        Municipio: a.municipality,
        Programa: a.program,
        Latitud: a.latitude,
        Longitud: a.longitude,
        Personas: a.people,
        Familias: a.families,
        Armas_incautadas: a.weaponsSeized,
        Armas_voluntarias: a.weaponsVoluntary,
        Meta_PISCC: a.pisccGoal,
        Objetivo: a.objective,
        Resumen: a.summary,
        Autor: a.author,
        Creacion: a.createdAt,
        Actualizacion: a.updatedAt,
      })),
      "narino360-jornadas.csv",
    );
  }
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Cerrar navegación"
        />
      )}
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Link className="sidebar-brand" href="/">
          <div className="brand-symbol">
            N<span>360</span>
          </div>
          <div>
            <strong>
              Nariño<span>360</span>
            </strong>
            <small>OBSERVATORIO DEPARTAMENTAL</small>
          </div>
        </Link>
        <div className="sidebar-department">
          <Building2 size={16} />
          <span>
            Subsecretaría de
            <br />
            <strong>Seguridad Ciudadana</strong>
          </span>
        </div>
        <div className="nav-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={tab === item.id ? "active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {tab === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Shield size={20} />
            <p>
              Información para construir
              <br />
              <strong>un territorio en paz.</strong>
            </p>
          </div>
          {user.role === "Administrador" && (
            <button
              className={
                "side-utility " + (tab === "auditoria" ? "active" : "")
              }
              onClick={() => navigate("auditoria")}
            >
              <ShieldCheck size={17} />
              Auditoría de accesos
            </button>
          )}
          <button
            className="side-utility"
            onClick={() => setModal({ type: "account" })}
          >
            <Settings size={17} />
            Mi cuenta y acceso
          </button>
          <div className="sidebar-institution">
            GOBERNACIÓN DE NARIÑO<small>Paz · Seguridad · Convivencia</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir navegación"
            onClick={() => setMenu(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Observatorio <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-badge">
              <span className="status-dot" />
              {activities.length
                ? "Registros cargados"
                : "Sin datos operativos"}
            </span>
            <button
              className="account-chip"
              onClick={() => setModal({ type: "account" })}
            >
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </span>
            </button>
            <button
              className="icon-button"
              aria-label="Cerrar sesión"
              onClick={async () => {
                try {
                  await api("/api/auth", {
                    method: "POST",
                    body: JSON.stringify({ action: "logout" }),
                  });
                  router.replace("/acceso");
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="overline">ESTRATEGIA NARIÑO 360</div>
              <h1>
                {tab === "resumen"
                  ? "Observatorio de Paz, Seguridad y Convivencia"
                  : title}
              </h1>
              <p>
                {tab === "resumen"
                  ? "Una mirada integral a la gestión, los resultados y el impacto en nuestro territorio."
                  : "Información territorial para acompañar la gestión institucional."}
              </p>
            </div>
            <div className="heading-actions" hidden={tab === "observatorio"}>
              <button className="button secondary" onClick={exportRows}>
                <ArrowDownToLine size={16} />
                Exportar datos
              </button>
              {canEdit && (
                <button
                  className="button primary"
                  onClick={() => setModal({ type: "activity" })}
                >
                  <Plus size={17} />
                  Nueva jornada
                </button>
              )}
            </div>
          </div>
          {sessionExpired && (
            <div className="notice error" role="alert">
              <span>Tu sesión expiró. Vuelve a ingresar para continuar.</span>
              <Link className="button secondary" href="/acceso">
                Volver a ingresar
              </Link>
            </div>
          )}
          {toast && (
            <div className="notice success" role="status">
              <Check size={18} />
              {toast}
              <button
                className="icon-button"
                onClick={() => setToast("")}
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Cerrar error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab !== "presentacion" &&
            tab !== "auditoria" &&
            tab !== "observatorio" && (
              <section
                className="filter-bar"
                aria-label="Filtros de información"
              >
                <div className="filter-label">
                  <Filter size={16} />
                  <span>Filtrar por</span>
                </div>
                <label>
                  <span className="sr-only">Programa</span>
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                  >
                    <option value="">Todos los programas</option>
                    {PROGRAMS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Municipio</span>
                  <select
                    value={municipality}
                    onChange={(e) => setMunicipality(e.target.value)}
                  >
                    <option value="">Todos los municipios</option>
                    {MUNICIPALITIES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="date-filter">
                  <CalendarDays size={15} />
                  <span className="sr-only">Desde</span>
                  <input
                    type="date"
                    title="Desde"
                    value={since}
                    onChange={(e) => setSince(e.target.value)}
                    aria-label="Fecha inicial"
                  />
                </label>
                <span className="date-divider">—</span>
                <label className="date-filter">
                  <span className="sr-only">Hasta</span>
                  <input
                    type="date"
                    title="Hasta"
                    min={since}
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                    aria-label="Fecha final"
                  />
                </label>
                <button
                  className="text-button"
                  onClick={reset}
                  disabled={!filtersActive}
                >
                  Restablecer
                </button>
              </section>
            )}
          {tab !== "observatorio" && since && until && since > until && (
            <div className="notice error">
              La fecha inicial es posterior a la fecha final. Ajusta el rango de
              consulta.
            </div>
          )}
          {tab === "resumen" && (
            <>
              <section className="strategy-banner">
                <div>
                  <div className="overline light">
                    <span className="status-dot" /> SEGURIDAD QUE SE CONSTRUYE
                    EN COMUNIDAD
                  </div>
                  <h2>
                    Conocer el territorio.
                    <br />
                    <em>Transformar realidades.</em>
                  </h2>
                  <p>
                    Conectamos información, gestión y acción institucional
                    <br className="desktop-break" /> para fortalecer la paz y la
                    convivencia en Nariño.
                  </p>
                  <button
                    className="banner-link"
                    onClick={() => navigate("presentacion")}
                  >
                    Conoce la estrategia <ArrowRight size={17} />
                  </button>
                </div>
                <div className="banner-graphic" aria-hidden="true">
                  <div className="banner-ring ring-a" />
                  <div className="banner-ring ring-b" />
                  <div className="banner-ring ring-c" />
                  <span className="banner-number">
                    360<span>°</span>
                  </span>
                  <span className="banner-territory">NARIÑO · COLOMBIA</span>
                </div>
                <div className="banner-corner">
                  PAZ + SEGURIDAD + CONVIVENCIA
                </div>
              </section>
              <div className="section-heading compact">
                <div>
                  <h2>La gestión, en cifras</h2>
                  <p>Resultados calculados a partir de las jornadas cargadas</p>
                </div>
                <span className="subtle-tag">CORTE DE LA CONSULTA</span>
              </div>
              <div className="kpi-grid">
                <Kpi
                  icon={ActivityIcon}
                  label="Jornadas ejecutadas"
                  value={number(filtered.length)}
                  note="Actividades registradas"
                  color="green"
                />
                <Kpi
                  icon={MapPin}
                  label="Municipios con registros"
                  value={number(covered)}
                  suffix="/ 64"
                  note="Referencia de intervención: 39"
                  color="blue"
                />
                <Kpi
                  icon={Users}
                  label="Personas beneficiadas"
                  value={number(totals.people)}
                  note={"Meta de referencia: " + number(REFERENCES.people)}
                  color="amber"
                />
                <Kpi
                  icon={Building2}
                  label="Familias beneficiadas"
                  value={number(totals.families)}
                  note={"Meta de referencia: " + number(REFERENCES.families)}
                  color="purple"
                />
                <Kpi
                  icon={ShieldCheck}
                  label="Armas registradas"
                  value={number(totals.weapons)}
                  note="Incautadas + entregadas · Ref. 194"
                  color="rose"
                />
              </div>
              <div className="territory-grid">
                <MapPanel activities={filtered} heat={heat} setHeat={setHeat} />
                <aside className="panel coverage-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Cobertura territorial</h2>
                      <p>Alcance en el departamento</p>
                    </div>
                  </div>
                  <div
                    className="coverage-ring"
                    style={{
                      background:
                        "conic-gradient(var(--green) " +
                        (covered / 64) * 100 +
                        "%, var(--border) 0)",
                    }}
                  >
                    <div>
                      <strong>
                        {((covered / 64) * 100).toFixed(1).replace(".", ",")}%
                      </strong>
                      <span>de Nariño</span>
                    </div>
                  </div>
                  <div className="coverage-summary">
                    <span>
                      <i className="legend-dot" />
                      Con jornadas
                    </span>
                    <strong>{covered}</strong>
                  </div>
                  <div className="coverage-summary">
                    <span>
                      <i className="legend-dot gray" />
                      Sin registros en la consulta
                    </span>
                    <strong>{64 - covered}</strong>
                  </div>
                  <p className="coverage-note">
                    La referencia institucional de 39 municipios se compara con
                    los registros cargados; no acredita ejecución.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => navigate("territorio")}
                  >
                    Explorar el territorio
                    <ArrowRight size={15} />
                  </button>
                </aside>
              </div>
              <section className="program-grid">
                {PROGRAMS.map((p, i) => {
                  const Icon = programIcons[i],
                    rows = filtered.filter((a) => a.program === p);
                  return (
                    <button
                      className={"program-card pc-" + i}
                      key={p}
                      onClick={() => {
                        setProgram(p);
                        navigate("jornadas");
                      }}
                    >
                      <span className="program-icon">
                        <Icon size={21} />
                      </span>
                      <h3>{p}</h3>
                      <p>
                        {number(rows.length)} jornadas <span>·</span>{" "}
                        {new Set(rows.map((a) => a.municipality)).size}{" "}
                        municipios
                      </p>
                      <ArrowRight size={16} className="program-arrow" />
                    </button>
                  );
                })}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Últimas jornadas registradas</h2>
                    <p>Seguimiento a las acciones en el territorio</p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => navigate("jornadas")}
                  >
                    Ver todas
                    <ArrowRight size={15} />
                  </button>
                </div>
                <ActivityTable
                  rows={filtered.slice(0, 5)}
                  compact
                  canEdit={canEdit}
                  filtersActive={filtersActive}
                  onModal={setModal}
                />
              </section>
              <div className="data-note">
                <CircleHelp size={15} />
                <p>
                  Las cifras institucionales son referencias aportadas, no
                  resultados verificados. Personas y familias se acumulan por
                  jornada y pueden incluir participantes recurrentes.
                </p>
              </div>
            </>
          )}
          {tab === "territorio" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>64 municipios, una mirada territorial</h2>
                  <p>
                    {filtered.length} jornadas · {covered} municipios con
                    registros en esta consulta
                  </p>
                </div>
              </div>
              <MapPanel
                activities={filtered}
                heat={heat}
                setHeat={setHeat}
                large
              />
              <section className="panel">
                <div className="panel-heading">
                  <h2>Registros georreferenciados</h2>
                </div>
                <ActivityTable
                  rows={filtered}
                  canEdit={canEdit}
                  filtersActive={filtersActive}
                  onModal={setModal}
                />
              </section>
            </>
          )}
          {tab === "jornadas" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Registro de jornadas</h2>
                  <p>{number(filtered.length)} actividades en la consulta</p>
                </div>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Buscar jornada o resultado…"
                    aria-label="Buscar jornada"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <ActivityTable
                rows={filtered}
                canEdit={canEdit}
                filtersActive={filtersActive}
                onModal={setModal}
              />
            </section>
          )}
          {tab === "evidencias" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>El territorio, en imágenes</h2>
                  <p>Memoria visual y soportes de la gestión institucional.</p>
                </div>
                <div className="inline-actions">
                  <label className="columns-picker">
                    Columnas
                    <select
                      value={columns}
                      onChange={(e) => setColumns(Number(e.target.value))}
                    >
                      {[2, 3, 4].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  {canEdit && (
                    <button
                      className="button primary"
                      onClick={() =>
                        setModal({ type: "upload", kind: "evidencia" })
                      }
                    >
                      <Plus size={16} />
                      Cargar fotografías
                    </button>
                  )}
                </div>
              </div>
              {selectedAssets.filter((a) => a.kind === "evidencia").length ? (
                <div
                  className="gallery"
                  style={{ "--columns": columns } as React.CSSProperties}
                >
                  {selectedAssets
                    .filter((a) => a.kind === "evidencia")
                    .map((a) => (
                      <article className="evidence-card" key={a.id}>
                        <button
                          className="evidence-image"
                          onClick={() => setModal({ type: "image", asset: a })}
                        >
                          <img
                            src={"/api/media/" + a.id}
                            alt={a.title}
                            loading="lazy"
                          />
                          <span>
                            Ver en alta definición
                            <ArrowRight size={15} />
                          </span>
                        </button>
                        <div>
                          <span className="eyebrow">
                            {a.municipality || "REGISTRO TERRITORIAL"}
                          </span>
                          <h3>{a.title}</h3>
                          <p>
                            {a.caption || a.program || "Evidencia de gestión"}
                          </p>
                          <small>{formatDate(a.createdAt)}</small>
                          {canEdit && (
                            <button
                              className="icon-button delete-asset"
                              aria-label={"Eliminar " + a.title}
                              onClick={() => void deleteAsset(a)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={Images}
                    title="La memoria visual comienza aquí"
                    text={
                      filtersActive
                        ? "No hay fotografías con estos filtros."
                        : "Carga fotografías de las jornadas y conserva sus fuentes y contexto."
                    }
                  />
                </section>
              )}
              <section className="panel documents-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Soportes documentales</h2>
                    <p>Documentos PDF asociados a la gestión</p>
                  </div>
                  {canEdit && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        setModal({ type: "upload", kind: "documento" })
                      }
                    >
                      <Plus size={16} />
                      Cargar PDF
                    </button>
                  )}
                </div>
                {selectedAssets
                  .filter((a) => a.kind === "documento")
                  .map((a) => (
                    <div className="document-row" key={a.id}>
                      <FileText size={22} />
                      <div>
                        <strong>{a.title}</strong>
                        <small>
                          {a.caption}{" "}
                          {a.activityId ? "· Jornada #" + a.activityId : ""}
                        </small>
                      </div>
                      <a
                        href={"/api/media/" + a.id}
                        className="button secondary"
                        download
                      >
                        <ArrowDownToLine size={16} />
                        Descargar
                      </a>
                      {canEdit && (
                        <button
                          className="icon-button"
                          aria-label={"Eliminar " + a.title}
                          onClick={() => void deleteAsset(a)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                {!selectedAssets.some((a) => a.kind === "documento") && (
                  <p className="empty-inline">
                    No hay soportes documentales en esta consulta.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "presentacion" && (
            <Presentation
              slides={assets.filter((a) => a.kind === "diapositiva")}
              canEdit={canEdit}
              onUpload={() => setModal({ type: "upload", kind: "diapositiva" })}
              onRefresh={refresh}
              onError={setError}
            />
          )}
          {tab === "observatorio" && (
            <Publications
              assets={assets}
              canEdit={canEdit}
              onUpload={() => setModal({ type: "upload", kind: "publicacion" })}
              onRefresh={refresh}
              onError={setError}
            />
          )}
          {tab === "auditoria" && user.role === "Administrador" && <Audit />}
          <footer className="workspace-footer">
            <span>Observatorio de Paz, Seguridad y Convivencia</span>
            <span>
              Subsecretaría de Seguridad Ciudadana · Gobernación de Nariño
            </span>
          </footer>
        </main>
      </div>
      {modal?.type === "activity" && (
        <Modal
          title={modal.activity ? "Editar jornada" : "Registrar nueva jornada"}
          onClose={() => setModal(null)}
          wide
        >
          <ActivityForm activity={modal.activity} onSaved={saved} />
        </Modal>
      )}
      {modal?.type === "upload" && (
        <Modal
          title={
            modal.kind === "publicacion"
              ? "Cargar publicación del observatorio"
              : modal.kind === "diapositiva"
                ? "Cargar diapositivas"
                : modal.kind === "documento"
                  ? "Cargar soportes documentales"
                  : "Cargar evidencias fotográficas"
          }
          onClose={() => setModal(null)}
        >
          <MediaUpload
            kind={modal.kind}
            activities={activities}
            onSaved={saved}
            onRefresh={refresh}
          />
        </Modal>
      )}
      {modal?.type === "detail" && (
        <Modal title={modal.activity.title} onClose={() => setModal(null)} wide>
          <ActivityDetail activity={modal.activity} />
          {assets
            .filter((a) => a.activityId === modal.activity.id)
            .map((a) => (
              <a
                key={a.id}
                href={"/api/media/" + a.id}
                target="_blank"
                rel="noreferrer"
                className="document-row"
              >
                <FileText size={18} />
                {a.title}
                <ArrowRight size={16} />
              </a>
            ))}
          {canEdit && (
            <div className="inline-actions">
              <button
                className="button primary"
                onClick={() =>
                  setModal({ type: "activity", activity: modal.activity })
                }
              >
                <Pencil size={16} />
                Editar jornada
              </button>
              {user.role === "Administrador" && (
                <button
                  className="button danger"
                  onClick={async () => {
                    if (
                      !confirm(
                        "¿Eliminar la jornada? Los archivos de soporte se conservarán.",
                      )
                    )
                      return;
                    try {
                      await api("/api/jornadas", {
                        method: "DELETE",
                        body: JSON.stringify({ id: modal.activity.id }),
                      });
                      await saved();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
      {modal?.type === "image" && (
        <Modal title={modal.asset.title} onClose={() => setModal(null)} wide>
          <img
            className="lightbox-image"
            src={"/api/media/" + modal.asset.id}
            alt={modal.asset.title}
          />
          <p className="muted">{modal.asset.caption}</p>
          <a
            href={"/api/media/" + modal.asset.id}
            download={modal.asset.filename}
            className="button secondary"
          >
            <ArrowDownToLine size={16} />
            Descargar imagen HD
          </a>
        </Modal>
      )}
      {modal?.type === "account" && (
        <Modal title="Mi cuenta y acceso" onClose={() => setModal(null)}>
          <Account user={user} />
        </Modal>
      )}
    </div>
  );
  async function deleteAsset(a: Asset) {
    if (!confirm("¿Eliminar este archivo? Esta acción no se puede deshacer."))
      return;
    try {
      await api("/api/media", {
        method: "DELETE",
        body: JSON.stringify({ id: a.id }),
      });
      await refresh();
      setToast("Archivo eliminado.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
}
type IconType = typeof Users;
function Kpi({
  icon: Icon,
  label,
  value,
  note,
  color,
  suffix,
}: {
  icon: IconType;
  label: string;
  value: string;
  note: string;
  color: string;
  suffix?: string;
}) {
  return (
    <article className="kpi-card">
      <div className="kpi-top">
        <span className={"kpi-icon " + color}>
          <Icon size={19} />
        </span>
      </div>
      <p>{label}</p>
      <strong className="kpi-value">
        {value}
        <small>{suffix}</small>
      </strong>
      <div className="kpi-note">{note}</div>
    </article>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: IconType;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function ActivityDetail({ activity: a }: { activity: Activity }) {
  return (
    <div className="activity-detail">
      <span className="program-tag">{a.program}</span>
      <div className="detail-meta">
        <span>
          <MapPin size={15} />
          {a.municipality}
        </span>
        <span>
          <CalendarDays size={15} />
          {formatDate(a.date)}
        </span>
        <span>
          {a.latitude}, {a.longitude}
        </span>
      </div>
      <h3>Objetivo</h3>
      <p>{a.objective}</p>
      <h3>Resumen y resultados</h3>
      <p>{a.summary}</p>
      {a.pisccGoal && (
        <>
          <h3>Meta PISCC</h3>
          <p>{a.pisccGoal}</p>
        </>
      )}
      <div className="detail-stats">
        {[
          ["Personas", a.people],
          ["Familias", a.families],
          ["Armas incautadas", a.weaponsSeized],
          ["Armas entregadas", a.weaponsVoluntary],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{number(Number(value))}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="form-help">
        Registrado por {a.author}. Última actualización: {a.updatedAt} UTC.
      </p>
    </div>
  );
}
function Account({ user }: { user: Identity }) {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="form-stack">
      <div className="account-summary">
        <span className="avatar">{user.name[0]}</span>
        <div>
          <strong>{user.name}</strong>
          <p>
            {user.role}
            {user.username ? " · " + user.username : ""}
          </p>
        </div>
      </div>
      {user.role === "Invitado" ? (
        <div className="notice">
          Tu acceso permite consultar el observatorio. Solicita una cuenta
          institucional al administrador para registrar o editar información.
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              data = Object.fromEntries(new FormData(form));
            setError("");
            setSuccess("");
            if (data.next !== data.confirm) {
              setError("Las contraseñas nuevas no coinciden.");
              return;
            }
            setBusy(true);
            try {
              await api("/api/auth", {
                method: "POST",
                body: JSON.stringify({ action: "password", ...data }),
              });
              setSuccess(
                "Contraseña actualizada. Las demás sesiones se cerraron.",
              );
              form.reset();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Cambiar mi contraseña</h3>
          <label>
            Contraseña actual
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            Nueva contraseña
            <input
              name="next"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <label>
            Confirmar nueva contraseña
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <p className="form-help">
            Usa al menos 12 caracteres. El cambio cierra tus otras sesiones.
          </p>
          <button className="button primary" disabled={busy}>
            <KeyRound size={16} />
            {busy ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </form>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice success" role="status">
          {success}
        </div>
      )}
      {user.role === "Administrador" && <UserManagement />}
    </div>
  );
}
function UserManagement() {
  const [users, setUsers] = useState<
      { id: number; username: string; name: string; role: string }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(""),
    [expanded, setExpanded] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    api<{ users: typeof users }>("/api/usuarios", { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setUsers(r.users);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [expanded]);
  return (
    <details
      className="import-panel"
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setExpanded(open);
        if (open) {
          setLoading(true);
          setError("");
        }
      }}
    >
      <summary>
        <Users size={16} />
        Gestionar cuentas institucionales
      </summary>
      <div className="form-stack">
        <div className="user-list">
          {loading && <p role="status">Cargando cuentas…</p>}
          {users.map((u) => (
            <div key={u.id}>
              <strong>{u.name}</strong>
              <small>
                {u.username} · {u.role}
              </small>
            </div>
          ))}
        </div>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setError("");
            setSuccess("");
            try {
              await api("/api/usuarios", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
              });
              const r = await api<{ users: typeof users }>("/api/usuarios");
              setUsers(r.users);
              form.reset();
              setSuccess("Cuenta creada.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Crear funcionario</h3>
          <label>
            Nombre completo
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Usuario
            <input
              name="username"
              required
              pattern={"[a-z0-9._\\-]{3,60}"}
              autoComplete="off"
            />
          </label>
          <label>
            Rol
            <select name="role">
              <option>Editor</option>
              <option>Administrador</option>
            </select>
          </label>
          <label>
            Contraseña inicial
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button className="button primary" disabled={busy || loading}>
            <Plus size={16} />
            Crear cuenta
          </button>
        </form>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="notice success">
            {success}
          </div>
        )}
      </div>
    </details>
  );
}
function Audit() {
  const [data, setData] = useState<{
      events: {
        id: number;
        actor: string;
        role: string;
        event: string;
        detail: string;
        created_at: string;
      }[];
      guests: {
        id: number;
        nombre: string;
        apellido: string;
        entidad: string;
        cargo: string;
        created_at: string;
      }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<NonNullable<typeof data>>("/api/auditoria")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="form-stack">
      {error && <div className="notice error">{error}</div>}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Trazabilidad de usuarios y operaciones</h2>
            <p>Últimos 500 eventos · fechas en UTC</p>
          </div>
          <button
            className="button secondary"
            disabled={!data?.events.length}
            onClick={() => csvDownload(data!.events, "narino360-auditoria.csv")}
          >
            <ArrowDownToLine size={16} />
            Exportar
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha UTC</th>
                <th>Actor</th>
                <th>Rol</th>
                <th>Evento</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {data?.events.map((e) => (
                <tr key={e.id}>
                  <td>{e.created_at}</td>
                  <td>{e.actor}</td>
                  <td>{e.role}</td>
                  <td>{e.event}</td>
                  <td>{e.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && (
            <p className="empty-inline">
              {error
                ? "No se pudo cargar la auditoría."
                : "Cargando auditoría…"}
            </p>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Registro de procedencia de invitados</h2>
            <p>Información de acceso · últimos 500 registros</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Entidad</th>
                <th>Cargo</th>
                <th>Fecha UTC</th>
              </tr>
            </thead>
            <tbody>
              {data?.guests.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.nombre} {g.apellido}
                  </td>
                  <td>{g.entidad}</td>
                  <td>{g.cargo}</td>
                  <td>{g.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MapPanel({
  activities,
  heat,
  setHeat,
  large = false,
}: {
  activities: Activity[];
  heat: boolean;
  setHeat: (v: boolean) => void;
  large?: boolean;
}) {
  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <h2>Presencia en el territorio</h2>
          <p>Distribución geográfica de las jornadas registradas</p>
        </div>
        <div className="segmented">
          <button
            className={!heat ? "selected" : ""}
            onClick={() => setHeat(false)}
          >
            Marcadores
          </button>
          <button
            className={heat ? "selected" : ""}
            onClick={() => setHeat(true)}
          >
            Mapa de calor
          </button>
        </div>
      </div>
      <TerritoryMap activities={activities} heat={heat} large={large} />
      <div className="map-legend">
        <span>
          <i className="legend-dot" />
          Jornadas registradas
        </span>
        <span>
          {heat
            ? "Intensidad relativa según personas reportadas"
            : "Marcadores agrupados · selecciona para ver resultados"}
        </span>
      </div>
    </section>
  );
}
function ActivityTable({
  rows,
  compact = false,
  canEdit,
  filtersActive,
  onModal,
}: {
  rows: Activity[];
  compact?: boolean;
  canEdit: boolean;
  filtersActive: boolean;
  onModal: (v: ModalState) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Jornada / actividad</th>
            <th>Municipio</th>
            <th>Programa</th>
            <th>Personas</th>
            {!compact && <th>Fecha</th>}
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <button
                  className="table-title"
                  onClick={() => onModal({ type: "detail", activity: a })}
                >
                  {a.title}
                </button>
                <small>
                  {compact
                    ? formatDate(a.date)
                    : a.pisccGoal || "Sin meta PISCC asociada"}
                </small>
              </td>
              <td>{a.municipality}</td>
              <td>
                <span
                  className={
                    "program-tag program-" + PROGRAMS.indexOf(a.program)
                  }
                >
                  {a.program}
                </span>
              </td>
              <td>{number(a.people)}</td>
              {!compact && <td>{formatDate(a.date)}</td>}
              <td>
                {canEdit ? (
                  <button
                    className="icon-button"
                    aria-label={"Editar " + a.title}
                    onClick={() => onModal({ type: "activity", activity: a })}
                  >
                    <Pencil size={15} />
                  </button>
                ) : (
                  <button
                    className="icon-button"
                    aria-label={"Ver " + a.title}
                    onClick={() => onModal({ type: "detail", activity: a })}
                  >
                    <ChevronRight size={17} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty
          icon={ClipboardList}
          title="Aún no hay jornadas en esta vista"
          text={
            filtersActive
              ? "Prueba con otros filtros o restablece la consulta."
              : "Los registros aparecerán aquí al incorporar las primeras jornadas."
          }
          action={
            canEdit ? (
              <button
                className="button secondary"
                onClick={() => onModal({ type: "activity" })}
              >
                <Plus size={16} />
                Registrar primera jornada
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
