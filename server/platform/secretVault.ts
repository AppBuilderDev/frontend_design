import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { fail } from './store.ts';
export class SecretVault {
  private readonly key?: Buffer;
  constructor(value?: string) {
    if (value) {
      const key = Buffer.from(value, 'base64');
      if (key.length !== 32 || key.toString('base64') !== value)
        throw new Error('CONNECTOR_MASTER_KEY debe contener 32 bytes en base64');
      this.key = key;
    }
  }
  get ready() {
    return !!this.key;
  }
  encrypt(value: string, context: string) {
    if (!this.key) fail(503, 'Falta configurar la clave de cifrado de conexiones en el backend');
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return JSON.stringify({
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64'),
    });
  }
  decrypt(value: string, context: string) {
    if (!this.key) fail(503, 'La clave de cifrado de conexiones no está disponible');
    try {
      const envelope = JSON.parse(value);
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(envelope.iv, 'base64'),
        { authTagLength: 16 },
      );
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      fail(
        503,
        'No se pudo abrir la credencial de este ambiente. Revisa la clave de cifrado en el servidor.',
      );
    }
  }
}
