import * as oidc from 'openid-client';
import { digest, fail, token } from './contracts';
import { userId } from './provision';
import { type Row, type Store } from './store';

export type OidcConfig = { issuer: string; clientId: string; clientSecret: string; callback: string; allowLoopbackHttp?: boolean; trustVerifiedEmail?: boolean };
export type Caller = { user: string; human: boolean; organization?: string; activities?: string[]; credential?: string; session?: string };

export class Authentication {
  private constructor(private readonly store: Store, private readonly oidc: oidc.Configuration, private readonly config: OidcConfig) {}
  static async create(store: Store, config: OidcConfig) {
    const issuer = new URL(config.issuer);
    const callback = new URL(config.callback);
    const loopback = (url: URL) => ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((issuer.protocol !== 'https:' || callback.protocol !== 'https:') && !(config.allowLoopbackHttp && loopback(issuer) && loopback(callback))) throw new Error('OIDC requires HTTPS; explicit loopback HTTP is development-only');
    const client = await oidc.discovery(issuer, config.clientId, undefined, oidc.ClientSecretPost(config.clientSecret), {
      execute: config.allowLoopbackHttp && issuer.protocol === 'http:' ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks] : [oidc.enableNonRepudiationChecks],
    });
    if (client.serverMetadata().issuer !== config.issuer) throw new Error('OIDC issuer mismatch');
    return new Authentication(store, client, config);
  }
  async begin() {
    const cookie = token();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState(); const nonce = oidc.randomNonce();
    await this.store.transaction(tx => tx.create('login', { id: digest(cookie), digest: digest(cookie), verifier, state, nonce, expiresAt: Date.now() + 600000 }));
    const url = oidc.buildAuthorizationUrl(this.oidc, { redirect_uri: this.config.callback, scope: 'openid email', code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce });
    return { cookie, url: url.href };
  }
  async complete(callback: URL, cookie: string | undefined) {
    if (!cookie) fail(401, 'Invalid login transaction');
    const login = await this.store.transaction(async tx => {
      const record = await tx.get('login', digest(cookie));
      if (!record || Number(record.expiresAt) <= Date.now()) fail(401, 'Invalid login transaction');
      await tx.remove('login', record.id);
      return record;
    });
    let claims: oidc.IDToken;
    let contact: Record<string, unknown>;
    try {
      const result = await oidc.authorizationCodeGrant(this.oidc, callback, { pkceCodeVerifier: String(login.verifier), expectedState: String(login.state), expectedNonce: String(login.nonce), idTokenExpected: true }, { redirect_uri: this.config.callback });
      claims = result.claims()!;
      contact = claims;
      if (claims.email === undefined && this.oidc.serverMetadata().userinfo_endpoint) {
        // Some providers return requested contact claims only from UserInfo.
        // The validated ID Token subject binds that response to this login.
        contact = await oidc.fetchUserInfo(this.oidc, result.access_token, claims.sub);
      }
    } catch { fail(401, 'Invalid OIDC authentication'); }
    if (!claims.sub || claims.iss !== this.config.issuer) fail(401, 'Invalid OIDC authentication');
    const sessionToken = token();
    const user = await this.store.transaction(async tx => {
      const id = userId(claims.iss, claims.sub);
      const previous = await tx.get('user', id);
      const user: Row = { id, issuer: claims.iss, subject: claims.sub, email: typeof contact.email === 'string' ? contact.email : undefined, verified: this.config.trustVerifiedEmail === true && contact.email_verified === true, createdAt: previous?.createdAt ?? Date.now() };
      await tx.put('user', user);
      await tx.create('session', { id: digest(sessionToken), digest: digest(sessionToken), user: id, expiresAt: Date.now() + 12 * 3600000 });
      return user;
    });
    return { token: sessionToken, user };
  }
  async authenticate(value: string | undefined, bearer = false): Promise<Caller> {
    if (!value) fail(401, 'Invalid authentication');
    return this.store.transaction(async tx => {
      const record = await tx.get(bearer ? 'credential' : 'session', digest(value));
      if (!record || Number(record.expiresAt) <= Date.now() || record.revoked) fail(401, 'Invalid authentication');
      return bearer ? { user: String(record.user), human: false, organization: String(record.organization), activities: record.activities as string[], credential: record.id } : { user: String(record.user), human: true, session: record.id };
    });
  }
  async logout(value: string | undefined) {
    if (value) await this.store.transaction(tx => tx.remove('session', digest(value)));
  }
}
