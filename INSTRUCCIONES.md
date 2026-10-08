# LabTrace - Instalacion (una sola vez)

1. Instala **Node.js LTS**: https://nodejs.org (siguiente, siguiente, finalizar).
2. Descomprime esta carpeta donde quieras (ej. `C:\LabTrace`). No la muevas despues.
3. Doble clic en **LabTrace.bat**.
   - La primera vez instala y compila todo (tarda unos minutos, necesita internet).
   - Se abre el Bloc de notas con las claves de Supabase: reemplaza los valores, guarda y cierra.
4. Se abre el navegador con LabTrace. Para usarlo otro dia, doble clic en LabTrace.bat (abre en segundos).
   Al cerrar la pestana del navegador, el programa se apaga solo.

Tip: clic derecho en LabTrace.bat > Enviar a > Escritorio (crear acceso directo).

## Base de datos (quien configura, una vez)
1. Crear cuenta y proyecto en https://supabase.com
2. Para actualizar una base LabTrace existente, pegar `backend/prisma/actualizar-base-de-datos.sql` en SQL Editor y ejecutar.
3. Copiar las claves: Project Settings > Database (pooler 6543 y directa 5432) y Project Settings > API (URL y anon key).

## Avisos
- Supabase gratis pausa el proyecto tras 1 semana sin uso (se reactiva desde su panel) y no hace copias: usar el respaldo Excel de la app.
- Actualizar: reemplazar los archivos por los nuevos conservando `backend\.env`.
