# Publicar el observatorio en Render

Este procedimiento publica una URL HTTPS accesible desde el navegador. La
configuración de este repositorio no crea servicios por sí sola.

## Cuenta y servicio

1. Crea una cuenta en [Render](https://render.com/) o inicia sesión.
2. Conecta GitHub y autoriza el acceso al repositorio
   `SantiagoDelacruz-SE/Narino360Website`.
3. Crea un **Blueprint**, selecciona ese repositorio y la rama `main`.
   Render leerá `render.yaml`.
4. Revisa el servicio y el disco antes de confirmar: **son recursos de pago**.
   Consulta el precio vigente que muestra Render. El disco persistente es
   necesario para conservar usuarios, jornadas, fotografías y documentos.
5. Confirma la creación y espera a que terminen la instalación y compilación.
6. Abre la URL HTTPS asignada al servicio. La pantalla inicial es `/acceso`.
   Puedes probar primero el ingreso como invitado.

Si no utilizas Blueprint, crea un servicio web Node.js con estos parámetros:

| Campo                              | Valor                                   |
| ---------------------------------- | --------------------------------------- |
| Rama                               | `main`                                  |
| Node.js                            | `24.22.1`                               |
| Build                              | `npm ci --include=dev && npm run build` |
| Start                              | `node scripts/start-production.mjs`     |
| Health check                       | `/acceso`                               |
| Instancias                         | Una                                     |
| Disco persistente                  | Montado en `/var/data`                  |
| Variable `DATA_DIR`                | `/var/data/narino360`                   |
| Variable `NODE_ENV`                | `production`                            |
| Variable `NEXT_TELEMETRY_DISABLED` | `1`                                     |

El script de arranque toma el puerto de `PORT` y el origen público de
`RENDER_EXTERNAL_URL`, que proporciona Render. Esto permite que el inicio de
sesión funcione detrás del proxy HTTPS sin escribir manualmente la URL inicial.
Si añades un dominio propio, configura `APP_ORIGIN` con su URL HTTPS exacta,
sin rutas. Ese dominio será el utilizado para acceder a la aplicación.

## Primer administrador, desde el navegador

Cuando el servicio esté activo, abre la herramienta **Shell** del servicio en
Render. Es la terminal del servidor desplegado; no es la terminal interna de
ChatGPT. Ejecuta:

```bash
npm run user:create -- administrador "Tu nombre completo" Administrador
```

Introduce y confirma una contraseña de al menos 12 caracteres. No se muestra
en pantalla y no debe compartirse por el chat. El comando usa el mismo
`DATA_DIR` del servicio. No vuelvas a crear la misma cuenta en cada despliegue.

Ingresa en la web como **Funcionario**. Desde **Mi cuenta y acceso** podrás crear
cuentas de editores o administradores. Después, carga jornadas, fotografías,
PDF y diapositivas desde los módulos correspondientes.

## Verificación

- La URL HTTPS abre la pantalla de acceso.
- Un invitado puede consultar y no ve controles de escritura.
- El administrador puede iniciar sesión y registrar una jornada.
- Una fotografía cargada aparece en el mural y una diapositiva en el carrusel.
- Después de reiniciar el servicio, la cuenta, la jornada y el archivo siguen
  disponibles. Esta prueba confirma que el disco está montado correctamente.

Las pruebas locales del repositorio no certifican el estado de Render. Verifica
estos puntos en el servicio creado antes de cargar información institucional.

## Actualizaciones y respaldo

El Blueprint desactiva el despliegue automático. Para publicar una versión nueva,
usa el despliegue manual de Render sobre el último commit de `main`. Puedes
activar despliegues automáticos desde su configuración si lo prefieres.

Mantén una única instancia mientras se utilicen SQLite y el catálogo JSON.
Configura respaldos del disco completo y copias consistentes de SQLite. No
restablezcas ni borres `/var/data` al actualizar el código.

## Diagnosticar una carga que falla

La línea `[observatorio]` al iniciar muestra el commit de Render en `revision`.
Comprueba que coincida con el commit que deseas desplegar. Una pestaña abierta
antes de actualizar puede conservar el código anterior: recárgala después de que
el nuevo despliegue esté activo.

Las líneas `[media-upload]` de Logs usan un identificador por solicitud e indican
las etapas `receiving`, `processing` y `persisting`, además de los eventos
`completed` o `failed`. Incluyen tamaño, dimensiones, duración y memoria del
proceso, sin nombres de archivo, títulos, contenido, contraseñas ni cookies.

Si el navegador muestra un error de conexión, busca estas líneas alrededor de la
misma hora y revisa también Events por reinicios. El mensaje del navegador por sí
solo no identifica un fallo de memoria, disco o red. Las imágenes de más de 15 MB
se rechazan en el formulario antes de iniciar la transferencia.
