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
```

3. Crea las tablas (solo la primera vez): `npm install` y luego `npm run db:push`.

## 2. Iniciar

| Cómo | Qué hace |
|---|---|
| Doble clic en **`LabTrace.bat`** (Windows) | Instala/compila si hace falta, inicia el servidor y abre el navegador en http://localhost:3000. Cierra la ventana negra para detenerlo. |
| `npm start` (cualquier sistema) | Lo mismo que el `.bat`. |
| `npm run dev` | Modo desarrollo con recarga automática: API en :3000, web en http://127.0.0.1:5173 (se abre sola). |

Requisito: Node.js 18 o superior.

## 3. API (prefijo `/api`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/cases?search=texto` | Busca por código, título, cliente, documento o ID |
| GET | `/api/cases/stats` | Totales del dashboard |
| GET | `/api/cases/:id` | Caso con su línea de tiempo |
| POST | `/api/cases` | `multipart/form-data`: `clienteNombre`, `documentoIdentidad?`, `titulo`, `descripcion`, `fotos[]?` |
| POST | `/api/cases/:id/seguimiento` | `multipart/form-data`: `descripcion`, `tipo?`, `estado?`, `fotos[]?` |

## 4. Estructura

```
LabTrace.bat · scripts/start.mjs   Lanzador local
backend/src/{cases,prisma,supabase} API
frontend/src/{services,controllers,views}   Servicio → controlador (hook) → vista
```
