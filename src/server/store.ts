import { Surreal, RecordId, type SurrealTransaction } from 'surrealdb';

export type Row = { id: string; [field: string]: unknown };
export type Table =
  | 'organization'
  | 'project'
  | 'repository'
  | 'user'
  | 'membership'
  | 'policy'
  | 'session'
  | 'login'
  | 'work_item'
  | 'fact'
  | 'receipt'
  | 'invitation'
  | 'credential'
  | 'audit'
  | 'secret'
  | 'type_selection'
  | 'transition_request'
  | 'team'
  | 'provider_source'
  | 'correspondence'
  | 'observation_delivery';
const fields: Record<Table, Record<string, string>> = {
  provider_source: {
    organization: 'string',
    source: 'string',
    project: 'string',
    repository: 'string',
    type: 'string',
    external: 'object',
    enabled: 'bool',
    fingerprint: 'string',
  },
  correspondence: {
    organization: 'string',
    type: 'string',
    resource: 'string',
    project: 'string',
    repository: 'string',
    workItem: 'string',
  },
  observation_delivery: {
    organization: 'string',
    type: 'string',
    resource: 'string',
    eventId: 'string',
    digest: 'string',
    result: 'object',
  },
  organization: { name: 'string' },
  type_selection: { organization: 'string', type: 'string', version: 'number', enabled: 'bool' },
  team: { organization: 'string', name: 'string', members: 'array<string>' },
  transition_request: {
    organization: 'string',
    workItem: 'string',
    user: 'string',
    credential: 'option<string>',
    transition: 'string',
    expectedState: 'string',
    version: 'number',
    sequence: 'number',
    inputs: 'object',
    status: 'string',
    createdAt: 'number',
    result: 'option<object>',
    approval: 'option<object>',
  },
  project: { organization: 'string', name: 'string' },
  repository: { project: 'string', organization: 'string', name: 'string' },
  user: {
    issuer: 'string',
    subject: 'string',
    email: 'option<string>',
    verified: 'bool',
    createdAt: 'number',
  },
  membership: {
    user: 'string',
    organization: 'string',
    active: 'bool',
    revokedAt: 'option<number>',
  },
  policy: {
    organization: 'string',
    user: 'string',
    team: 'option<string>',
    scope: 'string',
    scopeId: 'string',
    activity: 'string',
    effect: 'string',
  },
  session: { digest: 'string', user: 'string', expiresAt: 'number' },
  login: {
    digest: 'string',
    verifier: 'string',
    state: 'string',
    nonce: 'string',
    expiresAt: 'number',
  },
  work_item: {
    organization: 'string',
    project: 'string',
    repository: 'option<string>',
    title: 'string',
    type: 'string',
    version: 'number',
    state: 'string',
    actor: 'string',
    createdAt: 'number',
    transitionSequence: 'option<number>',
    activeRun: 'option<object>',
  },
  fact: {
    organization: 'string',
    workItem: 'string',
    kind: 'string',
    payload: 'object',
    actor: 'string',
    recordedAt: 'number',
    correctedFact: 'option<string>',
  },
  receipt: {
    organization: 'string',
    user: 'string',
    operation: 'string',
    clientId: 'string',
    digest: 'string',
    result: 'object',
  },
  invitation: {
    organization: 'string',
    email: 'string',
    grants: 'array<object>',
    issuer: 'string',
    digest: 'string',
    issuedAt: 'number',
    expiresAt: 'number',
    revoked: 'bool',
    consumedBy: 'option<string>',
    consumedAt: 'option<number>',
  },
  credential: {
    organization: 'string',
    user: 'string',
    label: 'string',
    digest: 'string',
    activities: 'array<string>',
    expiresAt: 'number',
    issuedAt: 'number',
    revoked: 'bool',
  },
  audit: {
    organization: 'string',
    actor: 'string',
    kind: 'string',
    recordedAt: 'number',
    resource: 'string',
    decision: 'object',
  },
  secret: {
    organization: 'string',
    purpose: 'string',
    keyId: 'string',
    nonce: 'string',
    tag: 'string',
    ciphertext: 'string',
  },
};

function row(value: Record<string, unknown>): Row {
  return { ...value, id: String((value.id as RecordId).id) };
}

export class Transaction {
  constructor(private readonly db: SurrealTransaction) {}
  async get(table: Table, id: string): Promise<Row | undefined> {
    const result = await this.db.select(new RecordId(table, id));
    return result ? row(result as Record<string, unknown>) : undefined;
  }
  async list(table: Table, where = 'true', bindings: Record<string, unknown> = {}): Promise<Row[]> {
    const [result] = await this.db.query<[Record<string, unknown>[]]>(
      `SELECT * FROM ${table} WHERE ${where}`,
      bindings,
    );
    return result.map(row);
  }
  async put(table: Table, value: Row) {
    const { id, ...content } = value;
    await this.db.upsert(new RecordId(table, id)).content(content);
    return value;
  }
  async create(table: Table, value: Row) {
    const { id, ...content } = value;
    await this.db.create(new RecordId(table, id)).content(content);
    return value;
  }
  async remove(table: Table, id: string) {
    await this.db.delete(new RecordId(table, id));
  }
}

export class Store {
  constructor(private readonly db: Surreal) {}
  async transaction<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    // Retry the whole transaction: authorization and receipts must be read again.
    for (let attempt = 0; ; attempt++) {
      const transaction = await this.db.beginTransaction();
      try {
        const result = await operation(new Transaction(transaction));
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.cancel().catch(() => {});
        if (attempt < 7 && /conflict|retry|already exists|unique index/i.test(String(error))) {
          await new Promise((resolve) => setTimeout(resolve, 10 * 2 ** attempt));
          continue;
        }
        throw error;
      }
    }
  }
  async close() {
    await this.db.close();
  }
}

export type DatabaseConfig = {
  url: string;
  namespace: string;
  database: string;
  username: string;
  password: string;
};
export async function connectStore(config: DatabaseConfig): Promise<Store> {
  const db = new Surreal();
  try {
    await db.connect(config.url, {
      authentication: { username: config.username, password: config.password },
      reconnect: { attempts: 8, retryDelay: 250, retryDelayMax: 5000 },
    });
    await db.use({ namespace: config.namespace, database: config.database });
    for (const [table, definitions] of Object.entries(fields)) {
      await db.query(
        `DEFINE TABLE IF NOT EXISTS ${table} SCHEMAFULL;` +
          Object.entries(definitions)
            .map(
              ([field, type]) =>
                `DEFINE FIELD IF NOT EXISTS ${field} ON ${table} TYPE ${type}${type.includes('object') ? ' FLEXIBLE' : ''};`,
            )
            .join(''),
      );
    }
    for (const [table, columns] of Object.entries({
      user: 'issuer, subject',
      membership: 'user, organization',
      receipt: 'organization, user, operation, clientId',
      session: 'digest',
      login: 'digest',
      credential: 'digest',
      invitation: 'digest',
      provider_source: 'fingerprint',
      correspondence: 'organization, type, resource',
      observation_delivery: 'organization, type, resource, eventId',
    })) {
      await db.query(
        `DEFINE INDEX IF NOT EXISTS unique_identity ON ${table} FIELDS ${columns} UNIQUE;`,
      );
    }
    return new Store(db);
  } catch (error) {
    await db.close().catch(() => {});
    throw error;
  }
}
