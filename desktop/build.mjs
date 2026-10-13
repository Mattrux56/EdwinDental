// Empaqueta LabTrace como aplicación de escritorio:
//   node desktop/build.mjs         -> genera el instalador en desktop/release/
//   node desktop/build.mjs --dev   -> compila y abre la app contra este repositorio
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DESKTOP = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DESKTOP, '..');
// Se arma fuera del proyecto: dentro de OneDrive, miles de archivos temporales se sincronizan y se bloquean
const WORK = join(tmpdir(), 'labtrace-build');
const STAGE = join(WORK, 'stage');
const OUT = join(WORK, 'out');
const RELEASE = join(DESKTOP, 'release');

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const run = (cmd, args, cwd = ROOT) => {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`\n✖ Falló: ${cmd} ${args.join(' ')}\n`);
    process.exit(1);
  }
};

if (!existsSync(join(ROOT, 'node_modules'))) {
  console.log('▶ Instalando dependencias del proyecto…');
  run('npm', ['install']);
}
if (!existsSync(join(DESKTOP, 'node_modules', 'electron'))) {
  console.log('▶ Instalando Electron (solo la primera vez)…');
  run('npm', ['install'], DESKTOP);
}

console.log('▶ Compilando backend y frontend…');
run('npm', ['run', 'build']);

if (process.argv.includes('--dev')) {
  run('npm', ['start'], DESKTOP);
  process.exit(0);
}

console.log('▶ Preparando los archivos de la aplicación…');
rmSync(WORK, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
// Misma disposición que el repositorio: las rutas relativas del backend siguen funcionando sin cambios
cpSync(join(ROOT, 'backend', 'dist'), join(STAGE, 'backend', 'dist'), { recursive: true });
cpSync(join(ROOT, 'backend', 'templates'), join(STAGE, 'backend', 'templates'), { recursive: true });
cpSync(join(ROOT, 'backend', 'prisma', 'schema.prisma'), join(STAGE, 'backend', 'prisma', 'schema.prisma'));
cpSync(join(ROOT, 'frontend', 'dist'), join(STAGE, 'frontend', 'dist'), { recursive: true });
for (const file of ['main.cjs', 'updater.cjs', 'preload.cjs', 'setup.html', 'update.html', 'LabTrace.ico']) {
  cpSync(join(DESKTOP, file), join(STAGE, 'electron', file));
}

// LABTRACE_VERSION permite generar una copia de prueba con otra versión (p. ej. para ver el aviso de actualización)
const version = process.env.LABTRACE_VERSION || json(join(ROOT, 'package.json')).version;
// En GitHub Actions la etiqueta que disparó la compilación debe ser la versión de package.json
if (/^v\d/.test(process.env.GITHUB_REF_NAME ?? '') && process.env.GITHUB_REF_NAME !== `v${version}`) {
  console.error(`\n✖ La etiqueta ${process.env.GITHUB_REF_NAME} no coincide con la versión ${version} de package.json\n`);
  process.exit(1);
}
// Dependencias de producción del backend, en la versión exacta instalada (la misma con la que se probó),
// más las propias de la app de escritorio (el actualizador)
const dependencies = {
  ...Object.fromEntries(
    Object.keys(json(join(ROOT, 'backend', 'package.json')).dependencies).map((name) => {
      const local = join(ROOT, 'backend', 'node_modules', name, 'package.json');
      return [name, json(existsSync(local) ? local : join(ROOT, 'node_modules', name, 'package.json')).version];
    }),
  ),
  ...json(join(DESKTOP, 'package.json')).dependencies,
};
writeFileSync(
  join(STAGE, 'package.json'),
  `${JSON.stringify({
    name: 'labtrace',
    productName: 'LabTrace',
    version,
    private: true,
    description: 'LabTrace: seguimiento y trazabilidad de casos de laboratorio',
    author: 'LabTrace',
    main: 'electron/main.cjs',
    dependencies,
  }, null, 2)}\n`,
);

console.log('▶ Instalando dependencias de producción…');
run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], STAGE);
console.log('▶ Generando el cliente de base de datos…');
run('node', [`"${join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')}"`, 'generate', '--schema', '"backend/prisma/schema.prisma"'], STAGE);

console.log('▶ Creando el instalador…');
const { build, Platform, Arch } = await import(pathToFileURL(join(DESKTOP, 'node_modules', 'electron-builder', 'out', 'index.js')).href);
await build({
  targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
  projectDir: DESKTOP,
  publish: 'never', // los archivos los sube el flujo de GitHub Actions (.github/workflows/release.yml)
  config: {
    // De aquí lee la app instalada dónde buscar versiones nuevas (Releases del repositorio)
    publish: { provider: 'github', owner: 'Mattrux56', repo: 'EdwinDental', releaseType: 'release' },
    appId: 'com.labtrace.app',
    productName: 'LabTrace',
    electronVersion: json(join(DESKTOP, 'node_modules', 'electron', 'package.json')).version,
    directories: { app: STAGE, output: OUT },
    asar: false, // el motor nativo de Prisma y los archivos estáticos se leen directo del disco
    npmRebuild: false,
    // electron-builder solo copia paquetes declarados; el cliente generado de Prisma vive en node_modules/.prisma
    extraResources: [{ from: join(STAGE, 'node_modules', '.prisma'), to: 'app/node_modules/.prisma' }],
    win: { icon: join(DESKTOP, 'LabTrace.ico') },
    nsis: {
      oneClick: true,
      perMachine: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'LabTrace',
      installerLanguages: ['es_ES'],
      language: '3082',
      artifactName: 'LabTrace-Setup-${version}.${ext}',
    },
  },
});

const instalador = readdirSync(OUT).find((name) => /^LabTrace-Setup-.*\.exe$/.test(name));
if (!instalador) {
  console.error(`\n✖ No se encontró el instalador en ${OUT}\n`);
  process.exit(1);
}
// El instalador y lo que el actualizador necesita junto a él (latest.yml y el mapa de bloques)
rmSync(RELEASE, { recursive: true, force: true });
mkdirSync(RELEASE, { recursive: true });
for (const file of [instalador, `${instalador}.blockmap`, 'latest.yml']) cpSync(join(OUT, file), join(RELEASE, file));
console.log(`\n✔ Instalador listo: ${join(RELEASE, instalador)}\n  Versión sin instalar para pruebas: ${join(OUT, 'win-unpacked', 'LabTrace.exe')}\n`);
