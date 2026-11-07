import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, open, rename, unlink, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ExternalGateway } from './externalGateway.ts';
import { SecretVault } from './secretVault.ts';
export async function setupConnections(file: string, hosts: string[]) {
  const normalized = [...new Set(hosts.map((v) => v.trim().toLowerCase()).filter(Boolean))];
  if (!normalized.length) throw new Error('Indica al menos un dominio HTTPS autorizado');
  const policy = new ExternalGateway({ allowedHosts: normalized });
  for (const host of normalized) policy.origin('https://' + host);
  const lockPath = file + '.connector.lock';
  const lock = await open(lockPath, 'wx', 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') throw new Error('Ya hay una preparación de conexiones en curso');
    throw error;
  });
  const temporary = file + '.connector-' + randomUUID() + '.tmp';
  const read = () =>
    readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
  try {
    const previous = await read(),
      values = parseEnv(previous);
    if (values.CONNECTOR_MASTER_KEY) new SecretVault(values.CONNECTOR_MASTER_KEY);
    const master = values.CONNECTOR_MASTER_KEY || randomBytes(32).toString('base64');
    const allowed = [
      ...new Set([
        ...(values.CONNECTOR_ALLOWED_HOSTS ?? '').split(',').filter(Boolean),
        ...normalized,
      ]),
    ];
    let output = previous;
    for (const [key, value] of Object.entries({
      CONNECTOR_MASTER_KEY: master,
      CONNECTOR_ALLOWED_HOSTS: allowed.join(','),
    })) {
      const pattern = new RegExp('^(?:export\\s+)?' + key + '\\s*=.*$', 'm');
      if (pattern.test(output)) output = output.replace(pattern, key + '=' + value);
      else output += (output && !output.endsWith('\n') ? '\n' : '') + key + '=' + value + '\n';
    }
    const handle = await open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(output, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    if ((await read()) !== previous)
      throw new Error(
        'El archivo de configuración cambió. No se reemplazó; vuelve a ejecutar la preparación.',
      );
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(temporary, file);
        break;
      } catch (error) {
        if (
          attempt >= 4 ||
          !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')
        )
          throw error;
        await delay(15 * 2 ** attempt);
      }
    }
    await chmod(file, 0o600);
    return { domains: allowed, keyCreated: !values.CONNECTOR_MASTER_KEY };
  } finally {
    await unlink(temporary).catch(() => {});
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  setupConnections(resolve('.env'), process.argv.slice(2))
    .then(({ domains, keyCreated }) =>
      console.log(
        'Configuración preparada para ' +
          domains.join(', ') +
          '. ' +
          (keyCreated ? 'Se creó la clave privada en .env. ' : 'Se conservó la clave existente. ') +
          'Reinicia la API. No compartas .env.',
      ),
    )
    .catch((error: Error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
