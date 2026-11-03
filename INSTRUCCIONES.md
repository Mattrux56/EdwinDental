# LabTrace - Instalacion (una sola vez)

1. Doble clic en **LabTrace-Setup-1.0.0.exe**. No hace falta instalar nada mas.
   - Si Windows muestra «Windows protegio su PC»: clic en **Mas informacion** > **Ejecutar de todas formas** (el instalador no esta firmado).
   - Se instala solo, crea el icono **LabTrace** en el escritorio y en el menu Inicio, y abre la aplicacion.
2. La primera vez aparece la pantalla **Conectar LabTrace con Supabase**: pega las 4 claves, o usa **Importar archivo .env** si ya tienes el `backend\.env` de una instalacion anterior. Clic en **Guardar y abrir LabTrace**.
3. Para usarlo otro dia: doble clic en el icono **LabTrace**. Al cerrar la ventana, el programa se apaga solo.

Necesita internet (la base de datos y las fotos estan en Supabase).

- Cambiar las claves: menu **Archivo > Configurar conexion**.
- Actualizar: es automatico y **ya no usa un instalador nuevo**. Si hay una version nueva, al abrir LabTrace aparece un aviso con **Actualizar ahora** (descarga un paquete pequeño de unos 2 MB, tarda segundos y LabTrace se reinicia solo) y **En otro momento** (vuelve a preguntar la proxima vez). No hay que volver a abrirlo. Como no se ejecuta ningun .exe nuevo, Windows SmartScreen no interviene. Si la nueva version no llega a abrir bien, LabTrace vuelve solo a la anterior. Solo cuando cambia algo de fondo (Electron o la base de datos de Prisma) hace falta el instalador completo, y entonces se ve la barra de progreso del instalador. Las claves se conservan (estan en `%APPDATA%\LabTrace\.env`).
- Al abrir, primero aparece una ventanita «Abriendo LabTrace…»; es normal que tarde unos segundos. Un clic extra en el icono solo la trae al frente.
- Para que instalar y abrir sea mas rapido (opcional, requiere administrador): en Seguridad de Windows > Proteccion antivirus > Administrar configuracion > Exclusiones, agregar la carpeta `%LOCALAPPDATA%\Programs\LabTrace`.
- Desinstalar: Configuracion de Windows > Aplicaciones > LabTrace.
- Si algo falla al abrir: menu **Archivo > Abrir carpeta de registros** (`labtrace.log`).

## Primera instalacion de la 1.1.2 (una sola vez por PC)
Las versiones anteriores (1.0.x y 1.1.x) solo sabian actualizarse con un instalador, y Windows SmartScreen lo bloquea porque no esta firmado. **Por unica vez** hay que instalar a mano `LabTrace-Setup-1.1.2.exe` (o mas nuevo) en cada PC, desde https://github.com/Mattrux56/EdwinDental/releases. A partir de ahi las actualizaciones normales llegan solas, sin instalador. Si SmartScreen lo bloquea:
1. Clic derecho al `.exe` > **Propiedades** > marcar **Desbloquear** > Aceptar, y abrirlo de nuevo.
2. En el aviso azul: **Mas informacion** > **Ejecutar de todas formas**.
3. Si no aparece ese boton, es **Smart App Control** de Windows 11, que bloquea programas sin firma sin dejar ejecutarlos: Seguridad de Windows > Control de aplicaciones y del navegador > Smart App Control > **Desactivado**.
4. Sin ninguna alerta: pasar el instalador por USB o red local.

## Si Windows bloquea la descarga o la instalacion
El instalador no esta firmado (la firma cuesta dinero), asi que Edge/Windows lo marcan como «peligroso». No es un virus; solo pasa con la primera descarga desde el navegador (las actualizaciones que baja la propia app no lo muestran).
1. **Edge** al descargar: en Descargas, menu **...** del archivo > **Conservar** > **Mostrar mas** > **Conservar de todos modos**.
2. **Chrome**: menu **...** del archivo > **Conservar**.
3. Al abrir el instalador: **Mas informacion** > **Ejecutar de todas formas**.
4. Si no aparece ese boton: clic derecho al `.exe` > **Propiedades** > marcar **Desbloquear** > Aceptar, y volver a abrirlo.
5. Sin ninguna alerta: pasar el instalador por USB o red local (no lleva la marca de «descargado de Internet»).
6. Opcional: enviar el `.exe` en https://www.microsoft.com/wdsi/filesubmission como «falso positivo» para que Defender lo reconozca.

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
