# Cartografía municipal de Nariño

La aplicación incluye los 64 municipios con código DANE de departamento `52`.
La geometría generalizada procede del Marco Geoestadístico Nacional (DANE),
versión 2018 según las propiedades de la fuente. Se utiliza la conversión GeoJSON
publicada por [geoColombia](https://github.com/john-guerra/geoColombia), commit
`193ea4dff6a8aba291fcf33b39d2a83b95a30cb0`, archivo
`data/municipalities.geo.json`. La licencia MIT de esa distribución está en
[LICENSE-geoColombia.txt](LICENSE-geoColombia.txt).

Es cartografía de referencia para visualización departamental; no es una
certificación de linderos ni una fuente de sitios exactos de ejecución. El
mapa base OpenStreetMap es independiente: los límites y los datos del mapa
siguen disponibles si falla el proveedor de teselas.

## Reproducir el archivo local

Descargar el archivo de la revisión indicada y ejecutar:

```sh
python3 scripts/prepare-narino-cartography.py /ruta/municipalities.geo.json
```

El script conserva la geometría, selecciona los 64 municipios de Nariño,
normaliza los nombres Cuaspud Carlosama → Cuaspud y San Andrés de Tumaco →
Tumaco y calcula una referencia interior por municipio para ubicar su etiqueta.
Estas referencias no son cabeceras municipales ni coordenadas de actividades.
No se trasladan ni modifican los registros existentes.

## Lectura de las vistas

- Acciones: verde para los municipios con registros; un símbolo municipal con
  el total y un anillo proporcional a sus componentes. Seleccionar un municipio
  permite abrir **cada** registro del listado, incluidos los coincidentes.
- Calor: mapa coroplético de recurrencia municipal. Cada actividad, operativo o
  feria cuenta una vez; las noticias quedan excluidas. Escala fija: 0 blanco,
  1 azul, 2–4 verde, 5–9 amarillo, 10 o más rojo. No pondera beneficiarios.
- Ambas vistas usan el municipio declarado y los filtros vigentes. Las
  coordenadas históricas se conservan como referencias municipales opcionales;
  no se representan como sitios exactos ni se separan visualmente.

Una misma actividad puede estar asociada a varios municipios. Cada municipio
recibe una presencia de esa actividad, mientras el contador general y su listado
mantienen un único registro. El filtro municipal limita la cobertura visible sin
repartir ni repetir los resultados agregados de la actividad.
