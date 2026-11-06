type ApiOptions = RequestInit & { timeoutMs?: number };
export const SESSION_EXPIRED_EVENT = "narino360:session-expired";
export async function api<T = Record<string, unknown>>(
  url: string,
  options: ApiOptions = {},
): Promise<T> {
  const {
    timeoutMs = !options.method || options.method.toUpperCase() === "GET"
      ? 30000
      : 120000,
    signal,
    ...request
  } = options;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const headers = new Headers(request.headers);
    if (!(request.body instanceof FormData) && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    const response = await fetch(url, {
      ...request,
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let result: unknown = null;
    try {
      result = JSON.parse(text);
    } catch {
      /* Proxies can return an HTML error page. */
    }
    if (!response.ok) {
      if (
        response.status === 401 &&
        typeof window !== "undefined" &&
        window.location.pathname !== "/acceso"
      )
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      const detail =
        result &&
        typeof result === "object" &&
        "error" in result &&
        typeof result.error === "string"
          ? result.error
          : undefined;
      throw new Error(
        detail ||
          (response.status >= 500
            ? "El servidor no está disponible en este momento. Intenta de nuevo más tarde."
            : "No se pudo completar la operación (HTTP " +
              response.status +
              ")."),
      );
    }
    if (!result || typeof result !== "object")
      throw new Error(
        "El servidor devolvió una respuesta no válida. Intenta nuevamente.",
      );
    return result as T;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut)
      throw new Error(
        "El servidor no respondió a tiempo. No se pudo confirmar la operación; verifica la información antes de reenviarla.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "No se pudo conectar con el servidor. Comprueba la conexión e inténtalo nuevamente.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export const number = (v: number) => new Intl.NumberFormat("es-CO").format(v);
export const money = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
export function csvDownload(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const clean = (v: unknown) => {
    let text = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const columns = Object.keys(rows[0]);
  const text =
    "\uFEFF" +
    [
      columns.map(clean).join(","),
      ...rows.map((r) => columns.map((c) => clean(r[c])).join(",")),
    ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
