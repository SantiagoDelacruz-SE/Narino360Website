export async function api<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && window.location.pathname !== "/acceso")
      window.location.reload();
    throw new Error(result.error || "No se pudo completar la operación.");
  }
  return result as T;
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
