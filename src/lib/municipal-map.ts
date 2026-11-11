import {
  COMPONENTS,
  recordTypeOf,
  activityMunicipalities,
  type Activity,
  type Component,
} from "./domain";
import cartography from "./narino-municipalities.json";

export { cartography };
export const COMPONENT_COLORS: Record<Component, string> = {
  Observatorio: "#0071AC",
  PISCC: "#10A13B",
  "Banco de Alimentos": "#FFD500",
  "Cultivos para la Paz": "#896633",
  "Acción Unificada": "#DA1C24",
};
export const RECURRENCE_SCALE = [
  { label: "0", min: 0, color: "#FFFFFF" },
  { label: "1", min: 1, color: "#80BEFF" },
  { label: "2–4", min: 2, color: "#10A13B" },
  { label: "5–9", min: 5, color: "#FFD500" },
  { label: "10 o más", min: 10, color: "#DA1C24" },
] as const;
export function recurrenceColor(count: number) {
  return [...RECURRENCE_SCALE].reverse().find((band) => count >= band.min)!
    .color;
}
export type MunicipalSummary = {
  code: string;
  name: string;
  anchor: number[];
  records: Activity[];
  components: { name: Component; count: number; color: string }[];
};

// All geographic views use the declared municipality. Legacy coordinates are
// municipal references, not execution sites; never jitter or rewrite them.
export function summarizeMunicipalities(
  activities: readonly Activity[],
  municipality = "",
) {
  return cartography.features.map(({ properties }): MunicipalSummary => {
    const records = activities.filter(
      (a) =>
        (!municipality || properties.name === municipality) &&
        activityMunicipalities(a).includes(properties.name) &&
        recordTypeOf(a) !== "Noticia",
    );
    return {
      ...properties,
      records,
      components: COMPONENTS.map((name) => ({
        name,
        count: records.filter((a) => a.program === name).length,
        color: COMPONENT_COLORS[name],
      })).filter((component) => component.count > 0),
    };
  });
}

export function componentRing(summary: MunicipalSummary) {
  let start = 0;
  return (
    "conic-gradient(" +
    summary.components
      .map((component) => {
        const end = start + (component.count / summary.records.length) * 100;
        const segment = `${component.color} ${start}% ${end}%`;
        start = end;
        return segment;
      })
      .join(",") +
    ")"
  );
}
