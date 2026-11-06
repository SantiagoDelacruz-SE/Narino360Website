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
No pueden modificar información. Los editores cargan y editan jornadas y archivos.
El administrador también crea usuarios, consulta la auditoría y elimina jornadas.
Los cambios de contraseña revocan las demás sesiones del funcionario.

## Funcionalidades

- Tablero con filtros por programa, municipio y fechas; exportación CSV de jornadas.
- Catálogo de los 64 municipios. Jornadas con coordenadas decimales y metas PISCC.
- Mapa Leaflet (equivalente web de la cartografía Folium), agrupación de marcadores,
  popups y calor ponderado por personas reportadas. Las teselas provienen de
  `*.tile.openstreetmap.org` y requieren acceso desde el navegador. Si no están
  disponibles, se conserva la consulta de coordenadas en los registros.
- Registro y edición manual, importación JSON de hasta 200 jornadas por operación
  y extracción asistida de boletines de WhatsApp. La importación valida todas las
  filas antes de escribir; no sustituye ni deduplica registros existentes.
- Extracción por patrones de fecha (AAAA-MM-DD o DD/MM/AAAA), municipio, programa,
  personas, familias, armas y coordenadas explícitas. Requiere revisión humana.
- Mural HD con selector de 2 a 4 columnas en escritorio, vista ampliada y descarga.
  En pantallas pequeñas se adapta a dos columnas. Carga de JPG, PNG o WebP: hasta
  20 imágenes por operación, 15 MB y 40 megapíxeles por archivo. Conversión WebP de
  hasta 4096 px con eliminación de metadatos. Los PDF se sirven como descarga.
- Carrusel panorámico 16:9: imágenes oficiales cargadas por funcionarios, títulos,
  descripciones, miniaturas, orden editable, eliminación, teclado y pantalla
  completa cuando el navegador la permite. Avance manual. Sin archivos muestra
  plantillas expresamente identificadas, que no son material oficial.
- Observatorio de publicaciones: boletines diarios, semanales, mensuales, de
  investigación, temáticos y otros productos institucionales. Carga de PDF con
  título, descripción, categoría y fecha de publicación; búsqueda, filtros por
  categoría y fechas, orden cronológico y descarga autenticada. Los funcionarios
  cargan y eliminan; los invitados consultan y descargan.
- Paleta institucional: amarillo `#FFD500` y verde `#10A13B`, con azul claro
  `#80BEFF`, azul `#0071AC`, café `#896633`, rojo `#DA1C24`, negro y blanco
  como colores secundarios.
- Auditoría administrativa de accesos y cambios, y registro de procedencia de
  invitados. Consulta de los últimos 500 eventos, con exportación CSV de auditoría.

### Carga de información

Ingresa como funcionario y usa **Nueva jornada**. El formulario incluye la carga
asistida y el archivo JSON. `public/plantilla-jornadas.json` es una estructura con
valores pendientes; no pasa la validación hasta completar fecha, municipio y
coordenadas reales. No incluye datos de demostración importables por accidente.

En **Mural de evidencias** carga fotos o PDF y, opcionalmente, asócialos a una
jornada, municipio y programa. Los filtros de fecha de archivos usan la fecha de
carga; los de jornadas usan la fecha de ejecución.

En **Observatorio → Cargar publicación** sube el PDF, elige uno de los seis tipos
e indica la fecha de publicación. Los filtros usan esa fecha, independientemente
del día en que se cargó el archivo. Los soportes del mural y las diapositivas
conservan sus módulos y no se mezclan con el catálogo de publicaciones.

En **Presentación estratégica → Cargar diapositivas** sube imágenes, preferiblemente
16:9. Si tu presentación está en PowerPoint o PDF, exporta primero sus páginas a
imágenes. Las cargas se realizan archivo por archivo; ante un error se informa
cuántos archivos quedaron guardados y se pueden conservar o eliminar.

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
  `registro_accesos_usuarios` y `registro_invitados`.
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
