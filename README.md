# LabTrace · Trazabilidad de casos de laboratorio

Monorepo (npm workspaces):

| Carpeta | Stack |
|---|---|
| `backend/` | NestJS · Prisma · Supabase Storage (bucket `casos-fotos`) |
| `frontend/` | React + Vite · CSS Modules |

En uso normal es **un solo proceso en un solo puerto**: Nest sirve la API en `/api` y el frontend compilado en `/`.

## 1. Configurar Supabase (una vez)

1. **Base de datos**: copia las cadenas de conexión a `backend/.env` (usa `backend/.env.example` como plantilla).
2. **Storage**: crea el bucket **`casos-fotos`** como *Public* y añade estas políticas en el SQL Editor:

```sql
create policy "casos-fotos: subir" on storage.objects
  for insert to anon with check (bucket_id = 'casos-fotos');
create policy "casos-fotos: leer" on storage.objects
  for select to anon using (bucket_id = 'casos-fotos');
create policy "casos-fotos: borrar" on storage.objects
  for delete to anon using (bucket_id = 'casos-fotos');
```

3. Crea las tablas ejecutando el SQL en **SQL Editor** de Supabase:
   - Base **ya existente**: pega una sola vez el contenido de `backend/prisma/actualizar-base-de-datos.sql` en Supabase → SQL Editor → Run. Es seguro ejecutarlo más de una vez y conserva los datos.
   - Alternativa para desarrolladores: `npm run db:push`.
4. Administra el catálogo desde la opción **Productos** de la aplicación. El catálogo se almacena en la tabla `Producto`.

## 2. Iniciar

| Cómo | Qué hace |
|---|---|
| Doble clic en **`LabTrace.bat`** (Windows) | Instala/compila si hace falta, inicia el servidor y abre el navegador en http://localhost:3000. El servidor se detiene automáticamente al cerrar la última pestaña de LabTrace (normalmente en unos 15 segundos); cerrar la ventana negra también lo detiene. |
| `npm start` (cualquier sistema) | Lo mismo que el `.bat`. |
| `npm run dev` | Modo desarrollo con recarga automática: API en :3000, web en http://127.0.0.1:5173 (se abre sola). |

Requisito: Node.js 18 o superior.

### Qué hay en el menú

| Opción | Para qué sirve |
|---|---|
| Resumen / Panel de casos | Casos en tarjetas; editar, archivar/restaurar, fotos, remisiones del caso. **Respaldo en Excel** en el Resumen. |
| Alertas de entrega | Casos sin finalizar vencidos, para hoy o que vencen en 3 días (con contador en el menú). |
| Remisiones | Crear, ver el detalle, **corregir** (mismo número) y anular. |
| Cuentas de cobro | Total del mes por cliente (sin remisiones anuladas). Al abrir un cliente se ven sus remisiones: se marca cuáles están pagadas y se guarda con «Confirmar remisiones». Hay filtros por mes, cliente y estado de pago. |
| Clientes | Crear, editar, eliminar (si no tiene casos) y aviso de «posible duplicado». Un caso nuevo con el nombre de un cliente existente reutiliza ese cliente. |
| Productos | Lista de precios con categorías, **Exportar** e **Importar** Excel (Código, Categoría, Descripción, Valor). |

Todas las tablas se desplazan dentro de su propio panel (el encabezado queda fijo): no hay que bajar la página.

## 3. API (prefijo `/api`)

La aplicación es de un solo usuario (el dueño): no hay inicio de sesión. La consulta pública de un caso es `/api/cases/publico/:codigo`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/cases/alertas` | Casos vencidos / para hoy / próximos |
| PATCH | `/api/cases/:id` | Edita título, paciente, cliente y fechas |
| PATCH | `/api/cases/:id/archivar` · `/restaurar` | Archiva o restaura un caso |
| DELETE | `/api/cases/imagenes/:id` | Elimina una foto (registro y archivo) |
| GET/POST/PATCH/DELETE | `/api/clientes` | Gestión de clientes |
| PATCH | `/api/remisiones/:id` | Corrige una remisión sin cambiar su número |
| GET | `/api/cuentas-cobro?anio=&mes=` | Cuentas por cliente · PATCH `/:clienteId/:anio/:mes/pagos` con `{ pagadas: [ids] }` (guarda cuáles remisiones del mes quedan pagadas) |
| GET | `/api/productos/exportar` · POST `/api/productos/importar` | Lista de precios en Excel |
| GET | `/api/respaldo/excel` | Respaldo completo en Excel |
| GET | `/api/cases?search=texto&archivados=1` | Busca por código, título, cliente o ID (los archivados solo con `archivados=1`) |
| GET | `/api/cases/stats` | Totales del dashboard |
| GET | `/api/cases/clientes` | Lista de clientes registrados para reutilizarlos en nuevos casos |
| GET | `/api/cases/publico/:codigo` | Consulta pública de trazabilidad. El `codigo` es el **código público aleatorio** del caso (no el `CASO-2026-001`) |
| GET | `/api/cases/:id/ticket` | Datos de caso y cliente para comprobante |
| GET | `/api/cases/:id` | Caso con su línea de tiempo |
| POST | `/api/cases` | `multipart/form-data`: `codigo`, `clienteId?` o `clienteNombre`, `pacienteNombre`, `doctorNombre`, `numeroFactura?`, `descripcion`, `fechaEntregaEstimada?`, `fotos[]?` |
| POST | `/api/cases/:id/seguimiento` | `multipart/form-data`: `descripcion`, `tipo?`, `estado?`, `fotos[]?` |
| PATCH | `/api/cases/:id/seguimiento/:seguimientoId` | `multipart/form-data`: `tipo?`, `descripcion?`, `fechaEntregaEstimada?` (vacía la quita), `fotos[]?` (se suman). El caso toma el estado y la entrega del seguimiento más reciente |
| DELETE | `/api/cases/:id` | Elimina el caso y sus seguimientos e imágenes asociados en la base de datos |
| GET | `/api/productos` | Lista de precios activa (código, categoría, descripción, valor) |
| GET | `/api/productos/admin` | Catálogo completo, incluidos los productos inactivos |
| POST | `/api/productos` | Crea un producto (`codigo`, `categoria`, `descripcion`, `valor`) |
| PATCH | `/api/productos/:id` | Actualiza un producto o su indicador `activo` |
| GET | `/api/remisiones` | Remisiones emitidas, con caso, cliente, líneas y total |
| GET | `/api/remisiones/siguiente-numero` | Sugiere el número siguiente, o `null` si todavía no hay remisiones |
| GET | `/api/remisiones/:id` | Una remisión |
| POST | `/api/remisiones` | JSON: `numero?`, `casoId`, `fecha?`, `noOrden?`, `items[]` (`productoId`, `cantidad`; máx. 9 productos distintos) |
| GET | `/api/remisiones/:id/excel` | Descarga la remisión en Excel con el formato del laboratorio |
| PATCH | `/api/remisiones/:id/anular` | Anula la remisión sin liberar su número |

Los casos se consultan desde el navegador en `/consulta/:codigoPublico`. Los códigos de caso nuevos tienen el formato `CASO-2026-A7K3Q` (año + 5 letras y números). La tabla `Cliente` existente ya guarda los clientes vinculados a sus casos; el formulario permite seleccionar uno previo o registrar uno nuevo, por lo que no es necesario borrar el campo de documento histórico ni cambiar la estructura de la base. El resumen muestra los últimos tres casos y el Panel de casos ofrece búsqueda, filtro por fecha, página de 9/18/36 casos y eliminación confirmada. El esquema también contiene `fechaEntregaEstimada` en `Caso`; aplica cualquier cambio de esquema con `npm run db:push` desde la raíz.

Al iniciar con `LabTrace.bat`, el lanzador local monitorea las pestañas abiertas mediante heartbeats. Si el navegador se cierra sin enviar el evento de cierre, el servidor espera a que venza la señal (75 segundos) y después se apaga. Si no se abre ninguna página, el lanzador se apaga después de dos minutos.

### Remisiones

La opción **Remisiones** del menú lateral permite elegir un caso existente, indicar la cantidad de cada producto de la lista de precios y generar la remisión en Excel (`backend/templates/remision.xlsx`: logos, firma y formato del laboratorio). El precio de cada línea se toma de la lista y queda guardado en la remisión, por lo que cambios posteriores de precios no alteran las ya emitidas.

- El número de remisión es obligatorio y único. La primera remisión requiere que se indique manualmente; las siguientes sugieren el máximo número registrado más uno. Las remisiones anuladas conservan su número y no se eliminan.
- Una remisión admite hasta 9 productos distintos (las filas del formato).
- «No. de orden» es opcional; si se deja vacío se usa el código del caso.
- El valor en letras se calcula en el servidor (`backend/src/remisiones/numero-letras.ts`).
- Un caso asociado a remisiones, incluidas las anuladas, no se puede eliminar.
- **Corregir** una remisión conserva su número: se pueden cambiar fecha, no. de orden, nombres impresos, productos y cantidades. Los productos que ya estaban conservan su precio original; los nuevos toman el precio vigente. Si el número quedó mal, se anula y se crea otra. Una anulada no se edita.
- La remisión guarda una copia del nombre del doctor y del paciente al emitirse: si después se edita el cliente, las remisiones ya emitidas no cambian.
- Los productos se crean y mantienen desde **Productos**; no se necesita un seed de catálogo.

## 4. Estructura

```
LabTrace.bat · scripts/start.mjs   Lanzador local
backend/src/{cases,clientes,remisiones,cuentas-cobro,productos,respaldo,prisma,supabase} API
frontend/src/{services,controllers,views}   Servicio → controlador (hook) → vista
```

## Instalacion
Ver `INSTRUCCIONES.md`.
