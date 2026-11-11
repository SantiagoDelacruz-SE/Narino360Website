# Jornadas, entregas e impactos consolidados

En **Componentes → Banco de Alimentos → Entregas e impactos** se registran los
informes de donaciones. La misma sección está disponible en los demás componentes.
Las líneas de un informe no crean componentes nuevos ni duplican jornadas.

## Registro y revisión

1. Crear un informe o seleccionar **Importar informe JSON**. El archivo se valida
   completo y se presenta para revisar antes de guardar. La estructura vacía se
   puede descargar desde la sección.
2. Revisar las líneas y las cifras consolidadas, el alcance (directo, indirecto,
   ambos o no especificado), el documento fuente y el período. Si hay fechas
   contradictorias, conservar el estado **Pendiente** y explicar el motivo.
3. Adjuntar el PDF (hasta 15 MB) o seleccionar uno existente. Se almacena en el
   catálogo privado y se previsualiza con el mismo visor de publicaciones.
4. Revisar cada entrega: referencia opcional de acta, fecha literal, fechas confirmadas, uno o
   varios municipios, otros destinos, productos, cantidades, unidades y páginas.
   Los destinos fuera de Nariño y los lugares sin municipio confirmado se guardan
   como texto; nunca se asignan por defecto a Pasto ni a otro municipio del mapa.
5. Vincular una o varias jornadas ya registradas, de cualquier componente. Una
   jornada puede recibir varias entregas y una acta puede respaldar varias jornadas,
   sin duplicar ninguno de esos registros. Las noticias no se
   pueden vincular como intervenciones. Una entrega no crea ni modifica jornadas.
6. Para marcar una entrega **Revisada**, completar fechas, destinos y productos.
   Las entregas revisadas deben estar dentro del período confirmado del informe;
   las discrepancias pueden conservarse como pendientes hasta aclararlas.

## Lectura de indicadores

- Las actas son referencias de entregas; no equivalen automáticamente a eventos.
  Un acta puede agrupar varias fechas o destinos.
- El impacto del informe es la suma de sus líneas, no una distribución entre las
  entregas. No se suma automáticamente a los beneficiarios por jornada ni a otros
  informes que podrían cubrir la misma población.
- El tablero identifica cada fuente y presenta su consolidado aparte. Si se filtra
  por municipio, fechas, tipo de registro o búsqueda, se indica que no hay desglose
  para esos filtros, sin atribuirles el total completo o una parte inventada.
- Las jornadas aceptan `people: null`: la interfaz muestra **Sin desagregar**, sin
  equipararlo a cero. El cero sigue significando una cifra registrada de cero.
  Los registros históricos no se reinterpretan ni se reescriben.
- El mapa de acciones y el de recurrencia siguen usando exclusivamente jornadas,
  ferias y operativos, independientemente de sus cifras de personas. Los destinos
  de una entrega no cambian la ubicación municipal declarada de una jornada.
- Las cantidades de productos conservan sus unidades; no se convierten en personas.

## Persistencia y permisos

Se añaden las tablas SQLite `impactos_informes`, `donacion_entregas` y
`donacion_entrega_jornadas` al mismo
`DATA_DIR` persistente. La creación es aditiva y repetible; no cambia tablas ni
cargas anteriores. No hay una carga automática de informes al iniciar el servidor.

Administrador y Editor crean y editan. Consulta e Invitado solo leen y descargan.
Solo el Administrador elimina informes o entregas. Eliminar un informe borra sus
entregas, conservando las jornadas. Eliminar una jornada quita ese vínculo de sus
entregas y conserva las demás asociaciones. Un PDF usado como soporte no se puede eliminar hasta desvincularlo o
reemplazarlo en el informe. Las operaciones quedan registradas en auditoría.

La importación de hasta 500 entregas usa una transacción: si falla cualquier
registro, se revierte el lote completo. `sourceKey` identifica la fuente para
impedir la reimportación accidental. Los números de acta son únicos dentro de cada
informe cuando están informados; `1` y `001` representan la misma acta. Las
entregas sin referencia de acta pueden guardarse e importarse sin adjuntar archivos. Los identificadores de jornadas no
se importan desde otro servidor: se seleccionan después de revisar el inventario.

Los archivos institucionales aportados en el chat, sus PDF y los inventarios de
trabajo no forman parte del repositorio ni de los recursos públicos. La carga de
esos datos se hace desde la sesión autenticada de la aplicación.

No se solicita la carga de archivos de actas individuales. El PDF del informe
general es opcional; las entregas y sus vínculos se pueden registrar sin él.

## Una actividad con varios municipios

En el formulario de actividades de Banco de Alimentos, **Municipios de la
actividad** permite marcar uno o varios destinos y buscarlos por nombre. La
asistencia desde boletín también reconoce listas explícitas del tipo
«municipios de Linares, Guaitarilla…». Las coordenadas siguen siendo opcionales.

Una actividad compartida conserva un solo identificador y una sola fecha, fuente
y cifra de resultados. Aparece una vez en cada municipio seleccionado en ambos
mapas, pero una sola vez en el contador general y en la exportación CSV. Por ello,
los conteos de municipios no se suman para obtener el número de actividades únicas.

Al filtrar un municipio se incluyen las actividades que lo tengan entre sus
destinos, aunque no sea el primero. El mapa se limita a ese municipio. Los totales
compartidos de personas, familias y armas no se atribuyen al municipio filtrado:
se indica **Sin desglose municipal** si no hay cifras de actividades exclusivamente
municipales. Cuando hay cifras locales, se muestran como parciales y se informa
cuántas actividades compartidas carecen de desglose. Al quitar el filtro, el total
de cada actividad se cuenta una vez.

La importación de jornadas acepta `municipalities` como una lista de 1 a 64 nombres
del catálogo. Repetir un nombre no duplica la presencia. El campo histórico
`municipality` sigue siendo válido para registros de un solo municipio y, en
registros nuevos con lista, conserva el primer nombre por compatibilidad. No es
un municipio principal ni limita la cobertura de la actividad. No hay una
reescritura de los registros históricos.

Las ediciones de clientes antiguos que omitan la lista conservan todos los destinos
si mantienen la referencia individual anterior. Cambiar ubicaciones de una
actividad compartida exige enviar la lista completa, evitando perder municipios
por usar un formulario desactualizado.
