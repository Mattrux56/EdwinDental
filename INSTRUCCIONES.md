# LabTrace - Instalacion (una sola vez)

1. Doble clic en **LabTrace-Setup-1.0.0.exe**. No hace falta instalar nada mas.
   - Si Windows muestra «Windows protegio su PC»: clic en **Mas informacion** > **Ejecutar de todas formas** (el instalador no esta firmado).
   - Se instala solo, crea el icono **LabTrace** en el escritorio y en el menu Inicio, y abre la aplicacion.
2. La primera vez aparece la pantalla **Conectar LabTrace con Supabase**: pega las 4 claves, o usa **Importar archivo .env** si ya tienes el `backend\.env` de una instalacion anterior. Clic en **Guardar y abrir LabTrace**.
3. Para usarlo otro dia: doble clic en el icono **LabTrace**. Al cerrar la ventana, el programa se apaga solo.

Necesita internet (la base de datos y las fotos estan en Supabase).

- Cambiar las claves: menu **Archivo > Configurar conexion**.
- Actualizar: es automatico. Si hay una version nueva, al abrir LabTrace aparece un aviso con **Actualizar ahora** (descarga, instala y vuelve a abrir) y **En otro momento** (vuelve a preguntar la proxima vez). Las claves se conservan (estan en `%APPDATA%\LabTrace\.env`).
- Desinstalar: Configuracion de Windows > Aplicaciones > LabTrace.
- Si algo falla al abrir: menu **Archivo > Abrir carpeta de registros** (`labtrace.log`).

## Base de datos (quien configura, una vez)
1. Crear cuenta y proyecto en https://supabase.com
2. Base nueva y vacia: pegar `backend/prisma/actualizar-base-de-datos.sql` en SQL Editor y ejecutar. Base LabTrace existente: pegar `backend/prisma/migrar-remisiones-electronicas.sql` (se puede ejecutar mas de una vez).
3. Copiar las claves: Project Settings > Database (pooler 6543 y directa 5432) y Project Settings > API (URL y anon key).

## Publicar un parche (desarrollador)
Desde la carpeta del proyecto: `npm run release 1.0.2` (el numero debe ser mayor que el actual). Sube la version a GitHub, que compila el instalador y lo publica en 5-10 minutos en https://github.com/Mattrux56/EdwinDental/releases. Desde ese momento las apps instaladas ofrecen actualizarse al abrirse.
- Si el parche cambia la base de datos, hay que ejecutar su SQL en Supabase aparte.
- El instalador para un equipo nuevo se descarga de esa misma pagina de Releases.

## Probar sin publicar (desarrollador)
`npm run desktop:dev` abre la app sin empaquetar. `npm run desktop:build` genera el instalador en `desktop\release\` sin publicarlo.

## Avisos
- Supabase gratis pausa el proyecto tras 1 semana sin uso (se reactiva desde su panel) y no hace copias: usar el respaldo Excel de la app.
