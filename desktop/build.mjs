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
for (const file of ['main.cjs', 'preload.cjs', 'setup.html', 'LabTrace.ico']) cpSync(join(DESKTOP, file), join(STAGE, 'electron', file));

// Dependencias de producción del backend, en la versión exacta instalada (la misma con la que se probó)
const version = json(join(ROOT, 'package.json')).version;
const dependencies = Object.fromEntries(
  Object.keys(json(join(ROOT, 'backend', 'package.json')).dependencies).map((name) => {
    const local = join(ROOT, 'backend', 'node_modules', name, 'package.json');
    return [name, json(existsSync(local) ? local : join(ROOT, 'node_modules', name, 'package.json')).version];
  }),
);
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
  config: {
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

mkdirSync(RELEASE, { recursive: true });
const instalador = readdirSync(OUT).find((name) => /^LabTrace-Setup-.*\.exe$/.test(name));
if (!instalador) {
  console.error(`\n✖ No se encontró el instalador en ${OUT}\n`);
  process.exit(1);
}
cpSync(join(OUT, instalador), join(RELEASE, instalador));
console.log(`\n✔ Instalador listo: ${join(RELEASE, instalador)}\n  Versión sin instalar para pruebas: ${join(OUT, 'win-unpacked', 'LabTrace.exe')}\n`);
