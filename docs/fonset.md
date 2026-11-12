# Proyectos FONSET

En **FONSET → Nuevo proyecto**, registra:

- **Nombre del proyecto**: hasta 200 caracteres.
- **Objetivo del proyecto**: hasta 8.000 caracteres; el detalle conserva el texto completo.
- **Costo del proyecto (COP)**: pesos colombianos, sin separadores de miles y con hasta dos decimales. Por ejemplo, `125000000.50`. Se admite cero; el valor es obligatorio.
- **Estado del proyecto**: texto libre de hasta 100 caracteres. Puedes reutilizar los estados registrados o escribir otro según el proceso de tu equipo.

Pulsa **Guardar proyecto**. Puedes buscar por nombre, objetivo o estado, filtrar por estado y abrir **Ver proyecto** para consultar el objetivo completo. Los contadores y el costo total corresponden a los proyectos que cumplen los filtros. **Exportar proyectos CSV** descarga esa misma consulta con los cuatro campos.

El costo registrado representa el costo del proyecto. Su suma no acredita apropiación, compromiso, pago ni ejecución presupuestal, y el estado no calcula un porcentaje de ejecución.

## Permisos

| Rol           | Consultar y exportar | Crear y editar | Eliminar             |
| ------------- | -------------------- | -------------- | -------------------- |
| Administrador | Sí                   | Sí             | Sí, con confirmación |
| Editor        | Sí                   | Sí             | No                   |
| Consulta      | Sí                   | No             | No                   |
| Invitado      | Sí                   | No             | No                   |

Los permisos se verifican también en el servidor. Las creaciones, modificaciones y eliminaciones quedan registradas en la auditoría. Reintentar el mismo envío desde el formulario después de un fallo de conexión evita duplicar el proyecto si ya se había guardado. Si cambias sus datos después de un envío incierto, consulta primero la lista.

## Persistencia y despliegue

Los proyectos se guardan en la tabla `fonset_proyectos` de `observatorio.sqlite`, dentro de `DATA_DIR`. El servidor crea esta tabla al iniciar sin reemplazar las jornadas, usuarios, informes ni archivos existentes. No se incorporan proyectos de ejemplo.

En Render, conserva el disco montado en `/var/data` y `DATA_DIR=/var/data/narino360`. Utiliza una sola instancia y respalda la base de datos con el resto del directorio persistente. Después de desplegar, crea un proyecto, recarga la página y comprueba que una cuenta Consulta puede abrirlo sin controles de edición.
