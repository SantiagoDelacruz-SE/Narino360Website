export const PROGRAMS = [
  "PISCC",
  "Cultivos para la Paz",
  "Banco de Alimentos",
  "Acción Unificada",
] as const;
export type Program = (typeof PROGRAMS)[number];
export const MUNICIPALITIES = [
  "Albán",
  "Aldana",
  "Ancuya",
  "Arboleda",
  "Barbacoas",
  "Belén",
  "Buesaco",
  "Chachagüí",
  "Colón",
  "Consacá",
  "Contadero",
  "Córdoba",
  "Cuaspud",
  "Cumbal",
  "Cumbitara",
  "El Charco",
  "El Peñol",
  "El Rosario",
  "El Tablón de Gómez",
  "El Tambo",
  "Francisco Pizarro",
  "Funes",
  "Guachucal",
  "Guaitarilla",
  "Gualmatán",
  "Iles",
  "Imués",
  "Ipiales",
  "La Cruz",
  "La Florida",
  "La Llanada",
  "La Tola",
  "La Unión",
  "Leiva",
  "Linares",
  "Los Andes",
  "Magüí",
  "Mallama",
  "Mosquera",
  "Nariño",
  "Olaya Herrera",
  "Ospina",
  "Policarpa",
  "Potosí",
  "Providencia",
  "Puerres",
  "Pupiales",
  "Ricaurte",
  "Roberto Payán",
  "Samaniego",
  "San Bernardo",
  "San Lorenzo",
  "San Pablo",
  "San Pedro de Cartago",
  "Sandoná",
  "Santa Bárbara",
  "Santacruz",
  "Sapuyes",
  "Taminango",
  "Tangua",
  "Tumaco",
  "Túquerres",
  "Yacuanquer",
  "Pasto",
] as const;
export type Role = "Administrador" | "Editor" | "Invitado";
export type Identity = {
  id: number;
  name: string;
  role: Role;
  username?: string;
};
export type ActivityInput = {
  title: string;
  date: string;
  municipality: string;
  program: Program;
  latitude: number;
  longitude: number;
  people: number;
  families: number;
  weaponsSeized: number;
  weaponsVoluntary: number;
  objective: string;
  summary: string;
  pisccGoal: string;
  budgetApproved: number;
  budgetExecuted: number;
};
export type Activity = ActivityInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
  author: string;
};
export type Asset = {
  id: string;
  kind: "evidencia" | "diapositiva" | "documento";
  title: string;
  caption: string;
  municipality: string;
  program: string;
  activityId: number | null;
  filename: string;
  createdAt: string;
};
export const REFERENCES = {
  municipalities: 64,
  coverage: 39,
  people: 31325,
  families: 5755,
  weapons: 194,
};
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function themes(
  activities: Pick<ActivityInput, "summary" | "objective">[],
) {
  const groups: Record<string, string[]> = {
    Convivencia: [
      "convivencia",
      "dialogo",
      "mediacion",
      "conflicto",
      "comunidad",
    ],
    "Seguridad ciudadana": [
      "seguridad",
      "prevencion",
      "delito",
      "policia",
      "proteccion",
    ],
    "Seguridad alimentaria": [
      "alimento",
      "alimentaria",
      "donacion",
      "hambre",
      "nutricion",
    ],
    "Construcción de paz": ["paz", "reconciliacion", "cultivo", "territorio"],
    Desarme: ["arma", "desarme", "incautacion", "voluntaria"],
    "Niñez y juventud": [
      "joven",
      "juventud",
      "infancia",
      "nino",
      "adolescente",
    ],
  };
  return Object.entries(groups)
    .map(([name, words]) => ({
      name,
      count: activities.filter((a) => {
        const text = normalize(a.summary + " " + a.objective);
        return words.some((w) => text.includes(w));
      }).length,
    }))
    .sort((a, b) => b.count - a.count);
}
export function parseBulletin(text: string): Partial<ActivityInput> {
  const t = normalize(text);
  const result: Partial<ActivityInput> = { summary: text.slice(0, 8000) };
  const municipalities = [...MUNICIPALITIES].sort(
    (a, b) => b.length - a.length,
  );
  const explicit = municipalities.find((m) =>
    new RegExp(
      "(?:municipio(?: de)?|lugar|localidad)[:\\s]+" + normalize(m) + "\\b",
    ).test(t),
  );
  const matches = municipalities.filter((m) =>
    new RegExp("\\b" + normalize(m) + "\\b").test(t),
  );
  const found = explicit || (matches.length === 1 ? matches[0] : undefined);
  if (found) result.municipality = found;
  const program = PROGRAMS.find((p) => t.includes(normalize(p)));
  if (program) result.program = program;
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const local = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (iso) result.date = iso[0];
  else if (local) result.date = local[3] + "-" + local[2] + "-" + local[1];
  const coords = text.match(
    /(?:coordenadas?|ubicacion|ubicación)\s*:?\s*(-?\d{1,2}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)/i,
  );
  if (coords) {
    result.latitude = Number(coords[1]);
    result.longitude = Number(coords[2]);
  }
  for (const [field, pattern] of [
    ["people", /(\d[\d.]*)\s*(?:personas|ciudadanos|beneficiarios)/],
    ["families", /(\d[\d.]*)\s*familias/],
    ["weaponsSeized", /(\d+)\s*armas?\s*incautadas?/],
    ["weaponsVoluntary", /(\d+)\s*armas?\s*(?:entregadas?|voluntarias?)/],
  ] as const) {
    const match = t.match(pattern);
    if (match) result[field] = Number(match[1].replace(/\./g, ""));
  }
  return result;
}
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function textField(
  v: unknown,
  label: string,
  max = 300,
  min = 1,
): string {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    throw new AppError(label + ": longitud no válida.");
  return v.trim();
}
export function validateActivity(value: unknown): ActivityInput {
  if (!value || typeof value !== "object")
    throw new AppError("La jornada no es válida.");
  const a = value as Record<string, unknown>;
  const num = (k: string, max: number, integer = true) => {
    const n = a[k];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > max ||
      (integer && !Number.isSafeInteger(n))
    )
      throw new AppError(k + ": valor no válido.");
    return n;
  };
  const date = textField(a.date, "Fecha", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new AppError("Fecha no válida.");
  const municipality = textField(a.municipality, "Municipio");
  if (!MUNICIPALITIES.some((m) => m === municipality))
    throw new AppError("Selecciona un municipio de Nariño.");
  const program = textField(a.program, "Programa") as Program;
  if (!PROGRAMS.includes(program)) throw new AppError("Programa no válido.");
  if (
    typeof a.latitude !== "number" ||
    typeof a.longitude !== "number" ||
    !Number.isFinite(a.latitude) ||
    !Number.isFinite(a.longitude) ||
    a.latitude < 0 ||
    a.latitude > 3.5 ||
    a.longitude < -79.5 ||
    a.longitude > -75.5
  )
    throw new AppError(
      "Las coordenadas deben estar en el entorno geográfico de Nariño (latitud 0 a 3,5; longitud −79,5 a −75,5). Verifica su ubicación en el mapa.",
    );
  const budgetApproved = num("budgetApproved", 1e14, false),
    budgetExecuted = num("budgetExecuted", 1e14, false);
  if (budgetExecuted > budgetApproved)
    throw new AppError(
      "La ejecución no puede superar el presupuesto aprobado.",
    );
  return {
    title: textField(a.title, "Título", 200),
    date,
    municipality,
    program,
    latitude: a.latitude,
    longitude: a.longitude,
    people: num("people", 1e8),
    families: num("families", 1e8),
    weaponsSeized: num("weaponsSeized", 1e7),
    weaponsVoluntary: num("weaponsVoluntary", 1e7),
    objective: textField(a.objective, "Objetivo", 4000),
    summary: textField(a.summary, "Resumen", 8000),
    pisccGoal: textField(a.pisccGoal ?? "", "Meta PISCC", 1000, 0),
    budgetApproved,
    budgetExecuted,
  };
}

export function passwordField(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 128)
    throw new AppError("Contraseña no válida.");
  return value;
}
