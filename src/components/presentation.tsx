/* eslint-disable @next/next/no-img-element -- authenticated private images are served without the public image optimizer */
"use client";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Maximize,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Presentation as PresentationIcon,
} from "lucide-react";
import type { Asset } from "@/lib/domain";
import { api } from "./api";
const templates = [
  {
    title: "Datos para comprender.\nAcción para transformar.",
    caption:
      "Observatorio de Paz, Seguridad y Convivencia · Estrategia Nariño 360",
  },
  {
    title: "Paz, seguridad\ny convivencia.",
    caption: "Una mirada integral a la gestión de seguridad del departamento.",
  },
  {
    title: "El territorio,\nen el centro.",
    caption:
      "Seguimiento de jornadas, cobertura municipal y resultados registrados.",
  },
];
export default function Presentation({
  slides,
  canEdit,
  onUpload,
  onRefresh,
  onError,
}: {
  slides: Asset[];
  canEdit: boolean;
  onUpload: () => void;
  onRefresh: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [index, setIndex] = useState(0),
    [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = slides.length || templates.length,
    current = Math.min(index, total - 1),
    slide = slides[current],
    template = templates[current % templates.length];
  const move = (step: number) => setIndex((current + step + total) % total);
  async function reorder(step: number) {
    if (current + step < 0 || current + step >= slides.length) return;
    setBusy(true);
    try {
      const order = slides.map((s) => s.id);
      [order[current], order[current + step]] = [
        order[current + step],
        order[current],
      ];
      await api("/api/media", {
        method: "PUT",
        body: JSON.stringify({ order }),
      });
      await onRefresh();
      setIndex(current + step);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="presentation-section">
      <div className="section-heading">
        <div>
          <h2>La estrategia, en perspectiva</h2>
          <p>Presentación panorámica para comités y consejos de seguridad.</p>
        </div>
        {canEdit && (
          <button className="button primary" onClick={onUpload}>
            <Plus size={16} />
            Cargar diapositivas
          </button>
        )}
      </div>
      {!slides.length && (
        <div className="notice">
          Estas son plantillas de orientación, no diapositivas oficiales.{" "}
          {canEdit
            ? "Carga tu presentación para reemplazarlas."
            : "La presentación oficial aún no ha sido cargada."}
        </div>
      )}
      <div
        className="presentation-viewer"
        ref={ref}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            move(1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            move(-1);
          }
        }}
        aria-roledescription="carrusel"
        aria-label="Presentación de la estrategia"
      >
        <div className="slide-canvas">
          {slide ? (
            <img
              src={"/api/media/" + slide.id}
              alt={slide.title}
              decoding="async"
            />
          ) : (
            <div className="template-slide">
              <div className="overline light">
                ESTRATEGIA NARIÑO 360 <span>· PLANTILLA</span>
              </div>
              <h3>{template.title}</h3>
              <p>{template.caption}</p>
              <div className="slide-ring" aria-hidden="true">
                360°
              </div>
              <footer>
                GOBERNACIÓN DE NARIÑO{" "}
                <span>Subsecretaría de Seguridad Ciudadana</span>
              </footer>
            </div>
          )}
        </div>
        <div className="slide-controls">
          <div>
            <PresentationIcon size={16} />
            <span>{slide?.title || "Plantilla de presentación"}</span>
          </div>
          <div>
            <button
              className="icon-button"
              onClick={() => move(-1)}
              aria-label="Diapositiva anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="slide-counter" aria-live="polite">
              {current + 1} / {total}
            </span>
            <button
              className="icon-button"
              onClick={() => move(1)}
              aria-label="Diapositiva siguiente"
            >
              <ChevronRight size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Pantalla completa"
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else await ref.current?.requestFullscreen();
                } catch {
                  onError(
                    "El navegador no permite pantalla completa en este contexto.",
                  );
                }
              }}
            >
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>
      <p className="form-help">
        Usa las flechas del teclado con la presentación enfocada. El avance es
        manual. {slide?.caption}
      </p>
      {slides.length > 0 && (
        <div className="slide-thumbnails">
          {slides.map((s, i) => (
            <button
              key={s.id}
              className={i === current ? "active" : ""}
              onClick={() => setIndex(i)}
              aria-label={"Ir a diapositiva " + (i + 1)}
            >
              <img
                src={"/api/media/" + s.id + "?size=thumbnail"}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span>
                {i + 1}. {s.title}
              </span>
            </button>
          ))}
        </div>
      )}
      {canEdit && slides.length > 0 && (
        <div className="inline-actions">
          <button
            className="button secondary"
            disabled={busy || current === 0}
            onClick={() => void reorder(-1)}
          >
            <ArrowLeft size={16} />
            Mover antes
          </button>
          <button
            className="button secondary"
            disabled={busy || current === slides.length - 1}
            onClick={() => void reorder(1)}
          >
            Mover después
            <ArrowRight size={16} />
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              if (!confirm("¿Eliminar esta diapositiva?")) return;
              setBusy(true);
              try {
                await api("/api/media", {
                  method: "DELETE",
                  body: JSON.stringify({ id: slide.id }),
                });
                await onRefresh();
                setIndex(0);
              } catch (e) {
                onError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={16} />
            Eliminar diapositiva
          </button>
        </div>
      )}
    </section>
  );
}
