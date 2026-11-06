import Database from 'better-sqlite3';
import { chmod, mkdir, open } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function backupDatabase(source: string, destination: string) {
  if (resolve(source) === resolve(destination))
    throw new Error('El destino debe ser diferente del origen');
  await mkdir(dirname(destination), { recursive: true });
  const reservation = await open(destination, 'wx', 0o600);
  await reservation.close();
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destination);
    const copy = new Database(destination, { readonly: true, fileMustExist: true });
    try {
      if (copy.pragma('integrity_check', { simple: true }) !== 'ok')
        throw new Error('La copia no supera la comprobación de integridad');
    } finally {
      copy.close();
    }
    await chmod(destination, 0o600);
  } finally {
    db.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const source = resolve(process.env.PLATFORM_DB ?? 'server/data/platform.sqlite');
  const destination = resolve(
    process.argv[2] ??
      'server/data/backups/platform-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite',
  );
  backupDatabase(source, destination)
    .then(() => console.log('Copia verificada: ' + destination))
    .catch((e: Error) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
