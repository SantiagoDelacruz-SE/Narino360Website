"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Building2,
  UserRound,
  Eye,
  EyeOff,
  MapPin,
} from "lucide-react";
import { api } from "./api";
export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "guest">("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: mode, ...Object.fromEntries(form) }),
      });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-brand">
          <div className="brand-symbol">
            N<span>360</span>
          </div>
          <div>
            GOBERNACIÓN DE NARIÑO
            <small>Subsecretaría de Seguridad Ciudadana</small>
          </div>
        </div>
        <div className="login-narrative">
          <div className="overline light">
            <span className="status-dot" /> ESTRATEGIA NARIÑO 360
          </div>
          <h1>
            El territorio,
            <br />
            en <em>perspectiva.</em>
          </h1>
          <p>
            Información que conecta la gestión institucional con la paz, la
            seguridad y la convivencia de nuestro departamento.
          </p>
          <div className="login-territory">
            <MapPin size={18} />
            <span>64 municipios. Un compromiso compartido.</span>
          </div>
        </div>
        <div className="contour-art" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              style={{
                width: 180 + i * 58,
                height: 250 + i * 45,
                transform: "rotate(-24deg)",
              }}
            />
          ))}
        </div>
        <footer>Observatorio de Paz, Seguridad y Convivencia</footer>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <span className="eyebrow">OBSERVATORIO DEPARTAMENTAL</span>
          <h2>Bienvenido al observatorio</h2>
          <p className="muted">
            Un espacio para comprender el territorio y acompañar la toma de
            decisiones.
          </p>
          <div
            className="segmented access-switch"
            role="group"
            aria-label="Tipo de acceso"
          >
            <button
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              <Building2 size={17} />
              Funcionario
            </button>
            <button
              className={mode === "guest" ? "selected" : ""}
              onClick={() => {
                setMode("guest");
                setError("");
              }}
            >
              <UserRound size={17} />
              Invitado
            </button>
          </div>
          <form key={mode} onSubmit={submit} className="form-stack">
            {mode === "login" ? (
              <>
                <label>
                  Usuario
                  <input
                    name="username"
                    autoComplete="username"
                    required
                    maxLength={60}
                    placeholder="Tu usuario institucional"
                  />
                </label>
                <label>
                  Contraseña
                  <div className="password-wrap">
                    <input
                      name="password"
                      type={visible ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      maxLength={128}
                      placeholder="Ingresa tu contraseña"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={
                        visible ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
              </>
            ) : (
              <>
                <div className="field-grid">
                  <label>
                    Nombre
                    <input
                      name="firstName"
                      autoComplete="given-name"
                      required
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Apellido
                    <input
                      name="lastName"
                      autoComplete="family-name"
                      required
                      maxLength={80}
                    />
                  </label>
                </div>
                <label>
                  Entidad u organización
                  <input
                    name="entity"
                    autoComplete="organization"
                    required
                    maxLength={160}
                  />
                </label>
                <label>
                  Cargo o vínculo
                  <input
                    name="position"
                    autoComplete="organization-title"
                    required
                    maxLength={120}
                  />
                </label>
                <p className="form-help">
                  El acceso de invitados es de consulta. Tu nombre, entidad,
                  cargo y fecha de ingreso se registrarán para la trazabilidad
                  institucional.
                </p>
              </>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary wide" disabled={busy}>
              {busy
                ? "Ingresando…"
                : mode === "login"
                  ? "Ingresar al observatorio"
                  : "Registrar ingreso y continuar"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-security">
            <ShieldCheck size={20} />
            <span>
              Acceso con trazabilidad institucional
              <br />
              <small>Los accesos y cambios quedan registrados.</small>
            </span>
          </div>
          <p className="login-support">
            {mode === "login"
              ? "¿Necesitas acceso? Solicítalo al administrador de la Subsecretaría."
              : "Al continuar, confirmas que tus datos de procedencia son correctos."}
          </p>
        </div>
        <footer>Estrategia Nariño 360 · Gobernación de Nariño</footer>
      </section>
    </main>
  );
}
