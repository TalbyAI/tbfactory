import { digest, fail, identifier, text } from './contracts';
import { type Store, type Transaction } from './store';
import { KeyRing, type Ciphertext } from './key-ring';

// Server/operator-only. There is deliberately no public secret-management route.
export class OrganizationSecrets {
  constructor(private readonly store: Store, private readonly ring: KeyRing) {}
  async put(organization: string, purpose: string, value: string) {
    return this.store.transaction(tx => this.write(tx, organization, purpose, value));
  }
  async write(tx: Transaction, organization: string, purpose: string, value: string) {
    identifier.parse(organization); text.max(200).parse(purpose); text.parse(value);
    const encrypted = await this.ring.encrypt(organization, purpose, value);
    if (!(await tx.get('organization', organization))) fail(404, 'Organization not found');
    await tx.put('secret', { id: digest(JSON.stringify([organization, purpose])), organization, purpose, ...encrypted });
    return { organization, purpose, keyId: encrypted.keyId };
  }
  async read(organization: string, purpose: string) {
    return this.store.transaction(tx => this.readInTransaction(tx, organization, purpose));
  }
  async readInTransaction(tx: Transaction, organization: string, purpose: string) {
    const secret = await tx.get('secret', digest(JSON.stringify([organization, purpose])));
    if (!secret || secret.organization !== organization || secret.purpose !== purpose) fail(404, 'Secret not found');
    const { id: _id, organization: _organization, purpose: _purpose, ...encrypted } = secret;
    return this.ring.decrypt(organization, purpose, encrypted as Ciphertext);
  }
  async requiredKeys(): Promise<string[]> {
    return this.store.transaction(async tx => [...new Set((await tx.list('secret')).map(s => String(s.keyId)))]);
  }
  async verify() {
    const secrets = await this.store.transaction(tx => tx.list('secret'));
    const metadata = await this.ring.verify(secrets.map(s => String(s.keyId)));
    for (const secret of secrets) {
      // Decryption validation intentionally returns no plaintext.
      const { id: _id, organization, purpose, ...encrypted } = secret;
      await this.ring.decrypt(String(organization), String(purpose), encrypted as Ciphertext);
    }
    return { ...metadata, secrets: secrets.length };
  }
}
