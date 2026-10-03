import { createCipheriv, createDecipheriv, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { stable } from './contracts';
import { atomicWrite } from './durable-files';

const secretSchema = z.strictObject({ keyId: z.uuid(), nonce: z.string(), tag: z.string(), ciphertext: z.string() });
export type Ciphertext = z.infer<typeof secretSchema>;
const metadataSchema = z.strictObject({ format: z.literal(1), installation: z.string(), rootVersion: z.string(), generation: z.number().int().positive(), createdAt: z.number(), keyIds: z.array(z.uuid()).min(1) });
const ringSchema = z.strictObject({ active: z.uuid(), keys: z.array(z.strictObject({ id: z.uuid(), material: z.string() })).min(1) });
type Ring = z.infer<typeof ringSchema> & { metadata: z.infer<typeof metadataSchema> };
type Envelope = { metadata: Ring['metadata']; nonce: string; tag: string; ciphertext: string };
export type RingConfig = { directory: string; backupDirectory: string; rootKey: Buffer; installation: string; rootVersion: string };

function seal(key: Buffer, plaintext: string, binding: unknown) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(stable(binding)));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}
function unseal(key: Buffer, encrypted: { nonce: string; tag: string; ciphertext: string }, binding: unknown) {
  const nonce = Buffer.from(encrypted.nonce, 'base64'), tag = Buffer.from(encrypted.tag, 'base64');
  if (nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid authenticated encryption metadata');
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(stable(binding))); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
export class KeyRing {
  private readonly file: string;
  constructor(private readonly config: RingConfig) {
    if (config.rootKey.length !== 32 || !/^[a-zA-Z0-9_-]{1,128}$/.test(config.installation) || !config.rootVersion) throw new Error('Recovery configuration invalid');
    if (!isAbsolute(config.directory) || !isAbsolute(config.backupDirectory)) throw new Error('Recovery directories must be absolute');
    const rel = relative(resolve(config.directory), resolve(config.backupDirectory));
    if (!rel || !rel.startsWith('..') && !isAbsolute(rel)) throw new Error('Recovery backup must be outside the active ring directory');
    this.file = join(config.directory, 'ring.json');
  }
  private decode(content: string): Ring {
    try {
      const envelope = JSON.parse(content) as Envelope;
      const metadata = metadataSchema.parse(envelope.metadata);
      if (metadata.installation !== this.config.installation || metadata.rootVersion !== this.config.rootVersion) throw new Error('Wrong installation or root version');
      const ring = ringSchema.parse(JSON.parse(unseal(this.config.rootKey, envelope, metadata)));
      if (stable(ring.keys.map(k => k.id)) !== stable(metadata.keyIds) || !ring.keys.some(k => k.id === ring.active) || new Set(metadata.keyIds).size !== metadata.keyIds.length || ring.keys.some(k => Buffer.from(k.material, 'base64').length !== 32)) throw new Error('Invalid key coverage');
      return { ...ring, metadata };
    } catch { throw new Error('Recovery error: corrupted, missing, incompatible or incorrectly protected key ring'); }
  }
  private async load(): Promise<Ring> {
    try { return this.decode(await readFile(this.file, 'utf8')); }
    catch { throw new Error('Recovery error: cannot open the required key ring; explicit setup or restore is required'); }
  }
  private encode(ring: Ring) {
    return JSON.stringify({ metadata: ring.metadata, ...seal(this.config.rootKey, JSON.stringify({ active: ring.active, keys: ring.keys }), ring.metadata) });
  }
  private async writer<T>(action: () => Promise<T>) {
    await mkdir(this.config.directory, { recursive: true, mode: 0o700 });
    const lock = join(this.config.directory, 'writer.lock');
    const writer = await open(lock, 'wx', 0o600).catch(() => { throw new Error('Key-ring writer already held; operator must resolve stale locks while processes are stopped'); });
    try { await writer.writeFile(String(process.pid)); await writer.sync(); return await action(); }
    finally { try { await writer.close(); } finally { await unlink(lock); } }
  }
  private async backup(ring: Ring, content = this.encode(ring)) {
    await mkdir(this.config.backupDirectory, { recursive: true, mode: 0o700 });
    const destination = join(this.config.backupDirectory, `${this.config.installation}-g${ring.metadata.generation}-${randomUUID()}.json`);
    await atomicWrite(destination, content);
    const verified = this.decode(await readFile(destination, 'utf8'));
    const expected = Buffer.from(stable(ring)), actual = Buffer.from(stable(verified));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Recovery backup verification failed');
    return destination;
  }
  async setup(requiredKeys: string[] = []) {
    return this.writer(async () => {
      if (requiredKeys.length) throw new Error('Recovery error: stored secrets require existing keys; setup is forbidden');
      const existing = await readFile(this.file).catch(error => { if (error.code !== 'ENOENT') throw error; return undefined; });
      if (existing) throw new Error('Recovery error: key ring already exists');
      const id = randomUUID();
      const ring: Ring = { active: id, keys: [{ id, material: randomBytes(32).toString('base64') }], metadata: { format: 1, installation: this.config.installation, rootVersion: this.config.rootVersion, generation: 1, createdAt: Date.now(), keyIds: [id] } };
      await this.backup(ring);
      await atomicWrite(this.file, this.encode(ring));
      return ring.metadata;
    });
  }
  async rotate() {
    return this.writer(async () => {
      const old = await this.load();
      const id = randomUUID();
      const ring: Ring = { active: id, keys: [...old.keys, { id, material: randomBytes(32).toString('base64') }], metadata: { ...old.metadata, generation: old.metadata.generation + 1, createdAt: Date.now(), keyIds: [...old.metadata.keyIds, id] } };
      await this.backup(ring);
      await atomicWrite(this.file, this.encode(ring));
      return ring.metadata;
    });
  }
  async export() { return this.writer(async () => this.backup(await this.load(), await readFile(this.file, 'utf8'))); }
  async verify(requiredKeys: string[]) {
    const ring = await this.load();
    if (requiredKeys.some(id => !ring.metadata.keyIds.includes(id))) throw new Error('Recovery error: key ring does not cover stored secrets');
    return ring.metadata;
  }
  async restore(backup: string, requiredKeys: string[]) {
    return this.writer(async () => {
      const ring = this.decode(await readFile(backup, 'utf8').catch(() => { throw new Error('Recovery error: missing backup'); }));
      if (requiredKeys.some(id => !ring.metadata.keyIds.includes(id))) throw new Error('Recovery error: backup does not cover required keys');
      await this.backup(ring);
      await atomicWrite(this.file, this.encode(ring));
      return ring.metadata;
    });
  }
  async encrypt(organization: string, purpose: string, value: string): Promise<Ciphertext> {
    const ring = await this.load();
    const key = ring.keys.find(k => k.id === ring.active)!;
    return { keyId: key.id, ...seal(Buffer.from(key.material, 'base64'), value, { installation: this.config.installation, organization, purpose, keyId: key.id }) };
  }
  async decrypt(organization: string, purpose: string, raw: Ciphertext) {
    try {
      const encrypted = secretSchema.parse(raw);
      const ring = await this.load(); const key = ring.keys.find(k => k.id === encrypted.keyId);
      if (!key) throw new Error('Missing key');
      return unseal(Buffer.from(key.material, 'base64'), encrypted, { installation: this.config.installation, organization, purpose, keyId: key.id });
    } catch { throw new Error('Recovery error: secret decryption or key coverage failed'); }
  }
}
