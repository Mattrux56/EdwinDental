// Publica una versión nueva de LabTrace:
//   npm run release 1.0.2
// Cambia la versión, hace el commit (con los cambios pendientes), crea la etiqueta v1.0.2 y lo sube.
// GitHub compila el instalador y lo publica; las apps instaladas lo ofrecen al abrirse.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/Mattrux56/EdwinDental';

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const run = (cmd, args) => {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: cmd === 'npm' });
  if (res.status !== 0) fail(`Falló: ${cmd} ${args.join(' ')}`);
};
const partes = (version) => version.split('.').map(Number);
const mayor = (a, b) => {
  const [x, y] = [partes(a), partes(b)];
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

const nueva = (process.argv[2] ?? '').replace(/^v/, '');
const actual = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(nueva)) fail(`Indica la versión, por ejemplo: npm run release 1.0.2 (la actual es ${actual}).`);
if (!mayor(nueva, actual)) fail(`La versión ${nueva} debe ser mayor que la actual (${actual}).`);
if (git('tag', '--list', `v${nueva}`).stdout.trim()) fail(`La etiqueta v${nueva} ya existe.`);

const rama = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
if (rama !== 'main') console.log(`Aviso: estás en la rama «${rama}», no en main.`);

console.log(`▶ Versión ${actual} → ${nueva}`);
run('npm', ['version', nueva, '--no-git-tag-version']);
run('git', ['add', '-A']);
run('git', ['commit', '-m', `Versión ${nueva}`]);
run('git', ['tag', `v${nueva}`]);
console.log('▶ Subiendo a GitHub…');
run('git', ['push', 'origin', rama]);
run('git', ['push', 'origin', `v${nueva}`]);

console.log(`\n✔ Versión ${nueva} enviada. GitHub está compilando el instalador (5–10 minutos):
  Progreso:  ${REPO}/actions
  Resultado: ${REPO}/releases/tag/v${nueva}
Cuando termine, LabTrace ofrecerá la actualización al abrirse.\n`);
