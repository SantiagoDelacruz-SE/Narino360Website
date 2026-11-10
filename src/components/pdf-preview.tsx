"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
import type { Asset } from "@/lib/domain";
import { SESSION_EXPIRED_EVENT } from "./api";

export default function PdfPreview({ asset }: { asset: Asset }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1);
  const [error, setError] = useState(""),
    [rendering, setRendering] = useState(false);
  const [width, setWidth] = useState(640);
  const container = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    async function load() {
      const response = await fetch("/api/media/" + asset.id, {
        signal: controller.signal,
      });
      if (response.status === 401)
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      if (!response.ok)
        throw new Error(
          "No se pudo abrir el PDF (HTTP " + response.status + ").",
        );
      const data = new Uint8Array(await response.arrayBuffer());
      if (controller.signal.aborted) return;
      const library = await import("pdfjs-dist");
      if (controller.signal.aborted) return;
      library.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      task = library.getDocument({
        data,
        enableXfa: false,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        wasmUrl: "/pdfjs/wasm/",
      });
      const document = await task.promise;
      if (!controller.signal.aborted) setPdf(document);
    }
    void load().catch((error) => {
      if (!controller.signal.aborted)
        setError(
          error instanceof TypeError
            ? "No se pudo conectar para abrir el PDF. Comprueba tu conexión."
            : "No se pudo previsualizar este PDF. Puedes descargarlo para revisarlo.",
        );
    });
    return () => {
      controller.abort();
      void task?.destroy();
    };
  }, [asset.id]);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, entry.contentRect.width - 24)),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    async function render() {
      const documentPage = await pdf!.getPage(page);
      if (cancelled || !canvas.current) return;
      setRendering(true);
      const base = documentPage.getViewport({ scale: 1 });
      const viewport = documentPage.getViewport({
        scale: Math.min(width / base.width, 2) * zoom,
      });
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(8000000 / (viewport.width * viewport.height)),
      );
      const element = canvas.current;
      element.width = Math.ceil(viewport.width * ratio);
      element.height = Math.ceil(viewport.height * ratio);
      element.style.width = viewport.width + "px";
      element.style.height = viewport.height + "px";
      task = documentPage.render({
        canvas: element,
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      await task.promise;
      if (!cancelled) setRendering(false);
    }
    void render().catch(() => {
      if (!cancelled) {
        setRendering(false);
        setError(
          "No se pudo mostrar esta página. Prueba otra página o descarga el PDF.",
        );
      }
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, zoom, width]);
  return (
    <div className="pdf-preview">
      <div className="pdf-toolbar" aria-label="Controles de PDF">
        <button
          className="button secondary"
          aria-label="Página anterior"
          disabled={!pdf || page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span role="status">
          {pdf ? "Página " + page + " de " + pdf.numPages : "Abriendo PDF…"}
        </span>
        <button
          className="button secondary"
          aria-label="Página siguiente"
          disabled={!pdf || page >= pdf.numPages}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight size={16} />
        </button>
        <label>
          Zoom
          <select
            aria-label="Zoom del PDF"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[0.75, 1, 1.25, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {Math.round(value * 100)}%
              </option>
            ))}
          </select>
        </label>
        <a
          className="button secondary"
          href={"/api/media/" + asset.id}
          download
        >
          <ArrowDownToLine size={16} />
          Descargar PDF
        </a>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div
        ref={container}
        className="pdf-canvas-wrap"
        aria-busy={!pdf || rendering}
      >
        <canvas
          ref={canvas}
          aria-label={"Página " + page + " de " + asset.title}
        />
      </div>
      <p className="form-help">{asset.caption}</p>
    </div>
  );
}
