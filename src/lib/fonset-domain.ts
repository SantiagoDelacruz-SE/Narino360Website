import { AppError, textField } from "./domain";

export type FonsetInput = {
  name: string;
  objective: string;
  costCents: number;
  status: string;
};
export type FonsetProject = FonsetInput & {
  id: number;
  author: string;
  createdAt: string;
  updatedAt: string;
};

// Monetary values are stored as integer centavos, never added as floats.
export function fonsetCostCents(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number")
    throw new AppError("Indica el costo del proyecto en pesos colombianos.");
  const text = String(value).trim();
  if (!text || text.length > 30 || !/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new AppError(
      "Costo no válido. Usa un valor positivo o cero, con hasta dos decimales y sin separadores de miles.",
    );
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new AppError("El costo supera el valor admitido.");
  return Number(cents);
}
export function fonsetCostInput(cents: number): string {
  const amount = BigInt(cents);
  return (
    (amount / BigInt(100)).toString() +
    "." +
    (amount % BigInt(100)).toString().padStart(2, "0")
  );
}
export function formatFonsetCost(cents: number | bigint): string {
  const amount = BigInt(cents),
    fraction = amount % BigInt(100);
  const whole = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount / BigInt(100));
  return whole + (fraction ? "," + fraction.toString().padStart(2, "0") : "");
}
export function validateFonsetProject(value: unknown): FonsetInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("Proyecto no válido.");
  const input = value as Record<string, unknown>;
  return {
    name: textField(input.name, "Nombre del proyecto", 200).replace(
      /\s+/g,
      " ",
    ),
    objective: textField(input.objective, "Objetivo", 8000),
    costCents: fonsetCostCents(input.cost),
    status: textField(input.status, "Estado del proyecto", 100).replace(
      /\s+/g,
      " ",
    ),
  };
}
export function fonsetSubmissionId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new AppError("Identificador de envío no válido.");
  return value.toLowerCase();
}
