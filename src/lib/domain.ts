export const PROGRAMS = [
  "PISCC",
  "Cultivos para la Paz",
  "Banco de Alimentos",
  "Acción Unificada",
] as const;
export const COMPONENTS = [
  "Observatorio",
  "PISCC",
  "Banco de Alimentos",
  "Cultivos para la Paz",
  "Acción Unificada",
] as const;
export type Component = (typeof COMPONENTS)[number];
export type Program = Component;
export const RECORD_TYPES = [
  "Actividad",
  "Operativo",
  "Feria",
  "Noticia",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];
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
export const ACCOUNT_ROLES = ["Administrador", "Editor", "Consulta"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type Role = AccountRole | "Invitado";
export function isAccountRole(value: unknown): value is AccountRole {
  return ACCOUNT_ROLES.some((role) => role === value);
}
export function canEditContent(role: Role) {
  return role === "Administrador" || role === "Editor";
}
export type Identity = {
  id: number;
  name: string;
  role: Role;
  username?: string;
};
export type ActivityInput = {
  recordType?: RecordType;
  title: string;
  date: string;
  municipality: string;
  program: Program;
  latitude: number | null;
  longitude: number | null;
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
export const PUBLICATION_TYPES = [
  "Boletín diario",
  "Boletín semanal",
  "Boletín mensual",
  "Boletín de investigación",
  "Boletín temático",
  "Otros productos",
] as const;
export type PublicationType = (typeof PUBLICATION_TYPES)[number];
export type Asset = {
  id: string;
  kind: "evidencia" | "diapositiva" | "documento" | "publicacion";
  title: string;
  caption: string;
  municipality: string;
  program: string;
  activityId: number | null;
  filename: string;
  createdAt: string;
  uploadId?: string;
  publicationType?: PublicationType;
  publicationDate?: string;
};
export const recordTypeOf = (
  activity: Pick<ActivityInput, "recordType">,
): RecordType => activity.recordType ?? "Actividad";
export function hasLocation(
  activity: Activity,
): activity is Activity & { latitude: number; longitude: number } {
  return (
    typeof activity.latitude === "number" &&
    Number.isFinite(activity.latitude) &&
    typeof activity.longitude === "number" &&
    Number.isFinite(activity.longitude)
  );
}
export function assetComponent(
  asset: Asset,
  activities: readonly Pick<Activity, "id" | "program">[] = [],
): Component | null {
  if (COMPONENTS.some((component) => component === asset.program))
    return asset.program as Component;
  const linked = activities.find(
    (activity) => activity.id === asset.activityId,
  );
  if (linked) return linked.program;
  // The existing bulletin library belonged to Observatorio before components.
  return asset.kind === "publicacion" ? "Observatorio" : null;
}
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
  const recordType = a.recordType === undefined ? "Actividad" : a.recordType;
  if (!RECORD_TYPES.some((type) => type === recordType))
    throw new AppError("Tipo de registro no válido.");
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
  if (!COMPONENTS.includes(program))
    throw new AppError("Componente no válido.");
  const newsWithoutLocation =
    recordType === "Noticia" && a.latitude == null && a.longitude == null;
  if (
    !newsWithoutLocation &&
    (typeof a.latitude !== "number" ||
      typeof a.longitude !== "number" ||
      !Number.isFinite(a.latitude) ||
      !Number.isFinite(a.longitude) ||
      a.latitude < 0 ||
      a.latitude > 3.5 ||
      a.longitude < -79.5 ||
      a.longitude > -75.5)
  )
    throw new AppError(
      "Las coordenadas deben estar en el entorno geográfico de Nariño (latitud 0 a 3,5; longitud −79,5 a −75,5). Verifica su ubicación en el mapa.",
    );
  // Legacy values remain readable; new journeys no longer require budget fields.
  const budgetApproved =
      a.budgetApproved === undefined ? 0 : num("budgetApproved", 1e14, false),
    budgetExecuted =
      a.budgetExecuted === undefined ? 0 : num("budgetExecuted", 1e14, false);
  if (budgetExecuted > budgetApproved)
    throw new AppError(
      "La ejecución no puede superar el presupuesto aprobado.",
    );
  return {
    recordType: recordType as RecordType,
    title: textField(a.title, "Título", 200),
    date,
    municipality,
    program,
    latitude: newsWithoutLocation ? null : (a.latitude as number),
    longitude: newsWithoutLocation ? null : (a.longitude as number),
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

export function publicationMetadata(value: {
  publicationType: unknown;
  publicationDate: unknown;
}) {
  const publicationType = textField(
    value.publicationType,
    "Tipo de publicación",
    80,
  ) as PublicationType;
  if (!PUBLICATION_TYPES.includes(publicationType))
    throw new AppError("Tipo de publicación no válido.");
  const publicationDate = textField(
    value.publicationDate,
    "Fecha de publicación",
    10,
  );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(publicationDate) ||
    !Number.isFinite(Date.parse(publicationDate)) ||
    new Date(publicationDate).toISOString().slice(0, 10) !== publicationDate
  )
    throw new AppError("Fecha de publicación no válida.");
  return { publicationType, publicationDate };
}
