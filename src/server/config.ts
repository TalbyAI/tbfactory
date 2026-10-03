import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { KeyRing } from './key-ring';
import { type DatabaseConfig } from './store';

function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing deployment setting: ${name}`); return value; }
export function databaseConfig(): DatabaseConfig {
  return { url: required('FACTORY_DATABASE_URL'), namespace: required('FACTORY_DATABASE_NAMESPACE'), database: required('FACTORY_DATABASE_NAME'), username: required('FACTORY_DATABASE_USER'), password: required('FACTORY_DATABASE_PASSWORD') };
}
export async function configuredRing() {
  return new KeyRing({ directory: required('FACTORY_RING_DIRECTORY'), backupDirectory: required('FACTORY_RING_BACKUP_DIRECTORY'), rootKey: await readFile(required('FACTORY_ROOT_KEY_FILE')), rootVersion: required('FACTORY_ROOT_KEY_VERSION'), installation: required('FACTORY_INSTALLATION') });
}
export function identityConfig() {
  return { issuer: required('FACTORY_OIDC_ISSUER'), clientId: required('FACTORY_OIDC_CLIENT_ID'), clientSecret: required('FACTORY_OIDC_CLIENT_SECRET'), callback: `${applicationOrigin()}/auth/callback`, allowLoopbackHttp: process.env.FACTORY_ALLOW_LOOPBACK_HTTP === 'true', trustVerifiedEmail: process.env.FACTORY_TRUST_VERIFIED_EMAIL === 'true' };
}
export function applicationOrigin() {
  const value = required('FACTORY_ORIGIN'); const url = new URL(value);
  if (url.origin !== value) throw new Error('FACTORY_ORIGIN must be a URL origin');
  return value;
}
export function lifetimeSettings() {
  return { credentialMaximumDays: z.coerce.number().int().min(1).max(90).parse(process.env.FACTORY_CREDENTIAL_MAXIMUM_DAYS ?? 90), invitationDays: z.coerce.number().int().min(1).max(365).parse(process.env.FACTORY_INVITATION_DAYS ?? 7) };
}
