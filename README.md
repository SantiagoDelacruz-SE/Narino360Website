# Observatorio de Paz, Seguridad y Convivencia · Nariño 360

Aplicación independiente en Next.js, React y TypeScript para la Subsecretaría de
Seguridad Ciudadana de la Gobernación de Nariño. No importa código ni datos de
Streamlit. Inicia sin registros operativos ni credenciales predefinidas.

## Iniciar

Requisitos: Node.js 24 LTS y npm 11. El almacenamiento requiere un proceso Node.js
con disco persistente; no es una aplicación para exportar como HTML estático.

```bash
npm ci
npm run user:create -- administrador "Nombre del administrador" Administrador
npm run dev
```

El comando de creación solicita y confirma una contraseña de al menos 12 caracteres
sin mostrarla en la terminal. No la incluyas en argumentos, archivos versionados ni
mensajes. Crea la primera cuenta una sola vez. Después, el administrador puede
crear funcionarios desde **Mi cuenta y acceso → Gestionar cuentas institucionales**.
Para agregar un editor desde terminal:

```bash
npm run user:create -- editor "Nombre del funcionario" Editor
```

Los invitados ingresan por `/acceso` registrando nombre, apellido, entidad y cargo.
No pueden modificar información. Las cuentas institucionales ingresan como
**Funcionario**, con estos roles:

| Rol           | Permisos                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consulta      | Ver tablero, mapa, jornadas, evidencias, presentación y publicaciones; filtrar, exportar y descargar. Cuenta con credenciales para el gobernador, secretarios y otros funcionarios que solo necesitan consultar. |
| Editor        | Consultar y gestionar jornadas y archivos.                                                                                                                                                                       |
| Administrador | Gestión completa, creación de cuentas, auditoría y eliminación de jornadas.                                                                                                                                      |

Solo el administrador puede crear cuentas desde **Mi cuenta y acceso → Gestionar
cuentas institucionales**, seleccionando **Consulta (solo lectura)** cuando
corresponda. También puedes crear una cuenta de consulta desde terminal:

```bash
npm run user:create -- gobernador "Nombre del gobernador" Consulta
```

Las cuentas Consulta pueden cambiar su propia contraseña. Sus accesos quedan en
la auditoría y el servidor rechaza las modificaciones de contenidos, incluso si
se intentan fuera de la interfaz. El esquema de usuarios se actualiza al abrir la
base de datos por primera vez tras el despliegue, preservando IDs, hashes,
roles anteriores y sesiones. Esta actualización no cambia los archivos cargados.
Los cambios de contraseña revocan las demás sesiones del funcionario.

Para editar una cuenta existente, ingresa como administrador a **Mi cuenta y
acceso → Gestionar cuentas institucionales → Editar acceso**, junto al usuario.
Puedes cambiar el nombre completo, seleccionar Administrador, Editor o Consulta,
y marcar o desmarcar **Cuenta activa**. Pulsa **Guardar cambios** para aplicar.
El nombre de usuario y la contraseña se conservan. Una cuenta inactiva no puede
iniciar sesión. Los cambios de rol o estado revocan todas las sesiones de esa
cuenta, incluso al reactivarla; tendrá que ingresar de nuevo. Si modificas tu
propio acceso, volverás a la pantalla de ingreso. El servidor conserva al menos
un administrador activo y registra los cambios en auditoría con sus valores
anteriores y nuevos.

## Funcionalidades

- Vista general con cobertura y recurrencia municipal. Contadores separados de
  actividades (incluidas ferias) y operativos. Filtros por componente, tipo de
  registro, municipio y fechas; exportación CSV con el tipo de registro.
  El selector **Mapa de acciones / Mapa de calor** comparte filtros y referencias
  municipales. Acciones muestra cobertura, total municipal y componentes; el
  listado permite abrir cada actividad, operativo o feria individualmente.
  Calor representa recurrencia: cada acción cuenta una vez, sin ponderar por
  beneficiarios. La escala fija es 0, 1, 2–4, 5–9 y 10 o más acciones.
  Ambos mapas usan el municipio declarado; las coordenadas se conservan como
  referencias opcionales, sin desplazamientos visuales ni sitios exactos.
  Los 64 límites municipales y su procedencia están documentados en
  [Cartografía](docs/cartografia/README.md).

- Actividades de Banco de Alimentos con uno o varios municipios. Cada actividad
  se cuenta una vez en el total general y aparece en cada destino del mapa. Los
  resultados compartidos no se distribuyen al aplicar un filtro municipal.
- Entregas e impactos consolidados: informes con líneas, período pendiente o
  confirmado y PDF privado; actas con varios destinos, productos y vínculos a
  jornadas existentes. Los totales de informes se muestran aparte, sin repartir
  personas ni duplicar eventos. Las jornadas permiten dejar personas en blanco
  como «Sin desagregar». Consulta [la guía de registro](docs/entregas-impactos.md).
- FONSET registra proyectos con nombre, objetivo, costo en pesos colombianos y
  estado libre. Incluye búsqueda, filtro por estado, detalle y exportación CSV.
  Administrador y Editor crean y editan; solo Administrador elimina. Consulta e
  Invitado pueden leer. El total corresponde al costo de los proyectos de la
  consulta, sin acreditar ejecución presupuestal. Consulta [la guía FONSET](docs/fonset.md).
- Componentes: Observatorio, PISCC, Banco de Alimentos, Cultivos para la Paz y
  Acción Unificada. Cada uno permite consultar resumen, actividades, operativos,
  ferias, noticias y documentos. Los enlaces de cada componente se conservan al
  recargar. El enlace antiguo `#territorio` abre Vista general y `#observatorio`
  abre los documentos del componente Observatorio.
- Catálogo de los 64 municipios. Jornadas con referencias decimales opcionales
  y metas PISCC. Los registros individuales siempre se pueden abrir desde el
  listado del mapa, aunque compartan municipio o coordenadas.
  Las teselas provienen de
  `tile.openstreetmap.org` y requieren acceso desde el navegador. Si no están
  disponibles, se conserva la consulta de coordenadas en los registros. Se envía
  únicamente el origen de la aplicación mediante
  `Referrer-Policy: strict-origin-when-cross-origin`, manteniendo la caché HTTP.
  El estado HTTP de cada imagen se comprueba antes de mostrarla: un 403 u otro
  fallo detiene la capa base, muestra un aviso y permite reintentar manualmente.
  Los límites, los totales municipales y sus registros siguen disponibles; no se usan servidores alternos
  para eludir bloqueos del proveedor.
- Registro y edición manual, importación JSON de hasta 200 jornadas por operación
  y extracción asistida de boletines de WhatsApp. La importación valida todas las
  filas antes de escribir; no sustituye ni deduplica registros existentes.
- Extracción por patrones de fecha (AAAA-MM-DD o DD/MM/AAAA), municipio, programa,
  personas, familias, armas y coordenadas explícitas. Requiere revisión humana.
- Mural HD con selector de 2 a 4 columnas en escritorio, vista ampliada y descarga.
  En pantallas pequeñas se adapta a dos columnas. Carga de JPG, PNG o WebP: hasta
  20 imágenes por operación (100 en el carrusel), 15 MB y 40 megapíxeles por archivo. Conversión WebP de
  hasta 4096 px con eliminación de metadatos. El mural y el carrusel utilizan
  miniaturas de hasta 640 px y carga diferida; el visor y la descarga conservan
  la imagen HD. Las miniaturas antiguas se generan al consultarlas sin cambiar
  los originales. Los PDF y las imágenes se sirven por streaming, con caché
  privada que revalida la sesión antes de reutilizar los archivos.
  Las transformaciones de imágenes se procesan de una en una para limitar memoria.
- Carrusel panorámico 16:9: imágenes oficiales cargadas por funcionarios, títulos,
  descripciones, miniaturas, orden editable, eliminación, teclado y pantalla
  completa cuando el navegador la permite. Avance manual. Sin archivos muestra
  plantillas expresamente identificadas, que no son material oficial.
- Observatorio de publicaciones: boletines diarios, semanales, mensuales, de
  investigación, temáticos y otros productos institucionales. Carga de PDF con
  título, descripción, categoría y fecha de publicación; búsqueda, filtros por
  categoría y fechas, orden cronológico, previsualización y descarga autenticada.
  El visor PDF permite cambiar de página y ajustar el zoom, se ejecuta en el
  navegador y utiliza recursos de la propia aplicación. Las descargas mantienen
  la autenticación y sus encabezados de seguridad. Administrador y Editor cargan
  y eliminan; Consulta e Invitado consultan, previsualizan y descargan.
- Paleta institucional: amarillo `#FFD500` y verde `#10A13B`, con azul claro
  `#80BEFF`, azul `#0071AC`, café `#896633`, rojo `#DA1C24`, negro y blanco
  como colores secundarios.
- Auditoría administrativa de accesos y cambios, y registro de procedencia de
  invitados. Consulta de los últimos 500 eventos, con exportación CSV de auditoría.

### Carga de información

Ingresa como funcionario y usa **Nueva jornada**. El formulario incluye la carga
asistida y el archivo JSON. `public/plantilla-jornadas.json` es una estructura con
valores pendientes; no pasa la validación hasta completar los campos obligatorios,
como fecha, municipio, objetivo y resumen. No incluye datos de demostración
importables por accidente.

Selecciona **Tipo de registro** (Actividad, Operativo, Feria o Noticia) y el
componente. También puedes entrar desde **Componentes** y usar **Registrar
operativo**, **Registrar feria** o **Publicar noticia** para completar esos campos
automáticamente. Las noticias se consultan en su componente y en el registro, y
no suman intervenciones ni beneficiarios al tablero. Todos los tipos permiten
dejar ambas coordenadas vacías: el mapa utiliza el municipio declarado. Si se
conserva una referencia decimal, se deben completar las dos coordenadas.
Los registros anteriores sin tipo se muestran como Actividad. Un editor puede
reclasificarlos sin duplicarlos, conservando sus datos y archivos asociados.

En **Mural de evidencias** carga fotos o PDF y, opcionalmente, asócialos a una
jornada, municipio y componente. Los filtros de fecha de archivos usan la fecha de
carga; los de jornadas usan la fecha de ejecución.

En **Componentes → Observatorio → Documentos → Cargar publicación** sube el PDF, elige uno de los seis tipos
e indica la fecha de publicación. Los filtros usan esa fecha, independientemente
del día en que se cargó el archivo. El selector **Componente del archivo** permite
publicarlo en cualquiera de los cinco componentes. Los boletines anteriores sin
componente siguen en Observatorio. Los PDF del mural conservan ese acceso y,
cuando están asociados a un componente o a una jornada suya, también aparecen en
sus documentos. **Componentes → Todos los PDF** permite consultar incluso los
soportes sin componente. Usa **Previsualizar PDF** para abrir el visor; también
está disponible desde el mural y los soportes del detalle de una jornada.

El proceso de compilación prepara el worker y las fuentes de PDF.js en
`public/pdfjs/`; son recursos generados desde la dependencia, no datos cargados.
El despliegue en Render debe seguir ejecutando `npm ci --include=dev && npm run
build`. No requiere modificar el disco persistente ni volver a cargar documentos.

En **Presentación estratégica → Cargar diapositivas** sube imágenes, preferiblemente
16:9. Si tu presentación está en PowerPoint o PDF, exporta primero sus páginas a
imágenes. Puedes seleccionar las 54 diapositivas de una presentación en una sola
operación (máximo 100). Nómbralas `01_portada.jpg`, `02_contexto.jpg`, etc.; el
carrusel las carga en orden numérico de nombre, de una en una. Antes del envío,
el navegador reduce las dimensiones hasta 4096 px y prepara la imagen en WebP;
los archivos originales del computador no se modifican.

Si se pierde la respuesta de una subida, el navegador comprueba una vez si esa
carga quedó registrada mediante su identificador único. Solo continúa si el
servidor confirma su existencia. No reenvía automáticamente el archivo; si no
puede confirmar el resultado, mantiene los archivos y el progreso en el formulario.
Pulsa **Reanudar pendientes** cuando vuelva la conexión: comprueba el archivo
pendiente antes de reenviarlo y conserva su identificador para evitar duplicados,
incluso si el intento anterior termina tarde. No cierres el formulario ni recargues
la página: la cola se conserva solo mientras esa ventana está abierta. **Elegir
otros archivos** descarta la cola pendiente; no elimina los archivos ya guardados.

Las referencias aportadas de 39 municipios, 31.325 personas, 5.755 familias y 194
armas se muestran separadas de los resultados calculados. No se usan como datos
operativos. Personas y familias son acumulados por jornada y pueden incluir
participantes recurrentes. La validación geográfica usa un rango aproximado del
entorno de Nariño; no certifica pertenencia a límites municipales.

## Persistencia y despliegue

Para obtener una URL pública desde el navegador, sigue la
[guía de despliegue en Render](docs/despliegue-render.md). El repositorio incluye
un Blueprint con disco persistente; crear ese servicio requiere revisar y aceptar
el costo en Render. La configuración por sí sola no realiza el despliegue.

```bash
npm run build
npm start
```

Configura `DATA_DIR` para una carpeta persistente fuera de `public/` (por defecto,
`./data`). Usa el mismo directorio para crear usuarios y ejecutar el servidor.
Incluye:

- `observatorio.sqlite`, con usuarios, sesiones, jornadas, intentos y las tablas
  `registro_accesos_usuarios` y `registro_invitados`, además de `impactos_informes`
  `donacion_entregas`, `donacion_entrega_jornadas` y `fonset_proyectos`.
- `media.json` y `media/`, con el catálogo de archivos y sus contenidos. La galería
  no requiere tablas de imágenes ni enlaces externos para almacenar sus archivos.

El servidor de producción requiere HTTPS para las cookies seguras. Detrás de un
proxy configura `APP_ORIGIN` con el origen público exacto (esquema y dominio, sin
barra final), por ejemplo `https://observatorio.example.gov.co`. Las mutaciones
verifican el origen. Conserva los permisos del directorio; realiza respaldos
consistentes de SQLite (incluidos WAL/SHM si está en uso) y de los archivos.

Esta versión está diseñada para **una instancia Node.js con volumen persistente**.
El catálogo JSON no coordina escrituras entre múltiples instancias. Para escalar,
se debe migrar el almacenamiento de archivos y su catálogo a un servicio compartido.
No se ha realizado despliegue público ni migración de datos institucionales.

## Validación

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:ui
```

`npm test` ejecuta pruebas de integración HTTP sobre la compilación de producción
en el puerto 3138, usando una base temporal y credenciales solo de prueba. Verifica
permisos, CSRF, validación/importación, persistencia, imágenes privadas, cambio de
contraseña y auditoría.

Las pruebas de navegador usan el puerto 3139, un directorio temporal independiente
y Chromium. Usa `CHROMIUM_PATH` si tu ejecutable está en otra ubicación o instala
el navegador de Playwright con `npx playwright install chromium`. Los registros y
archivos de prueba se eliminan al terminar; las capturas quedan en `test-results/`
y están excluidas de Git. No se crean credenciales de prueba en el almacén real.
