// Собирает dist/kinopoisk-ease-<версия>.zip из папки extension/: npm run build
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionDir = path.join(root, 'extension');

const manifest = JSON.parse(await readFile(path.join(extensionDir, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
    console.error(`Версии не совпадают: manifest.json ${manifest.version}, package.json ${pkg.version}`);
    process.exit(1);
}

async function collect(dir) {
    const files = {};
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) Object.assign(files, await collect(full));
        else files[path.relative(extensionDir, full).split(path.sep).join('/')] = await readFile(full);
    }
    return files;
}

const files = await collect(extensionDir);
const zip = zipSync(files, { level: 9 });
const outDir = path.join(root, 'dist');
const outFile = path.join(outDir, `kinopoisk-ease-${manifest.version}.zip`);
await mkdir(outDir, { recursive: true });
await writeFile(outFile, zip);

console.log(
    `✓ ${path.relative(root, outFile)} — ${Object.keys(files).length} файлов, ${(zip.length / 1024).toFixed(0)} КБ`,
);
