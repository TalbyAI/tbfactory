import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { uiRead, uiSession, uiWrite } from '../ui-functions';

export const Route = createFileRoute('/')({ loader: () => uiSession(), component: FactoryPage });
type RecordView = { id: string; [field: string]: any };

function FactoryPage() {
  const session = Route.useLoaderData();
  const [organizations, setOrganizations] = useState<RecordView[]>([]);
  const [organization, setOrganization] = useState('');
  const [projects, setProjects] = useState<RecordView[]>([]);
  const [project, setProject] = useState('');
  const [item, setItem] = useState<RecordView | null>(null);
  const [facts, setFacts] = useState<RecordView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [invitationToken, setInvitationToken] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [issuedInvitation, setIssuedInvitation] = useState<any>(null);
  const [credential, setCredential] = useState<any>(null);
  const [credentials, setCredentials] = useState<RecordView[]>([]);
  const pending = useRef(new Map<string, string>());
  const base = `/api/organizations/${organization}`;
  async function read(path: string) {
    const result = await uiRead({ data: { path } });
    if (result.status >= 400) throw new Error(result.data.error);
    return result.data;
  }
  async function write(path: string, body: Record<string, unknown>) {
    const key = JSON.stringify([path, body]);
    const operationId = pending.current.get(key) ?? crypto.randomUUID(); pending.current.set(key, operationId);
    const result = await uiWrite({ data: { path, body: { ...body, operationId } } });
    if (result.status < 500) pending.current.delete(key);
    if (result.status >= 400) throw new Error(result.data.error);
    return result.data;
  }
  async function perform(action: () => Promise<void>) {
    setError(''); setBusy(true);
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function refreshOrganizations() {
    const result: RecordView[] = []; let cursor: string | null = null;
    do { const page = await read(`/api/organizations${cursor ? `?cursor=${cursor}` : ''}`); result.push(...page.items); cursor = page.cursor; } while (cursor);
    setOrganizations(result);
    return result;
  }
  useEffect(() => {
    const supplied = new URLSearchParams(location.search).get('invitation');
    if (supplied) { sessionStorage.setItem('factory-invitation', supplied); history.replaceState(null, '', '/'); }
    setInvitationToken(supplied ?? sessionStorage.getItem('factory-invitation') ?? '');
    if (session) void perform(async () => {
      const available = await refreshOrganizations();
      const query = new URLSearchParams(location.search);
      const initialOrganization = query.get('organization'); const initialItem = query.get('workItem');
      if (initialOrganization && available.some(o => o.id === initialOrganization)) {
        await selectOrganization(initialOrganization);
        if (initialItem) {
          const existing = await read(`/api/organizations/${initialOrganization}/work-items/${encodeURIComponent(initialItem)}`);
          setItem(existing); await historyPage(existing, false, initialOrganization);
        }
      }
    });
  }, []);
  useEffect(() => {
    if (!session || !invitationToken) return;
    void perform(async () => setPreview(await read(`/api/invitations/preview?token=${encodeURIComponent(invitationToken)}`)));
  }, [invitationToken]);
  async function selectOrganization(id: string) {
    setOrganization(id); setItem(null); setFacts([]); setProjects([]); setProject(''); setCredential(null); setIssuedInvitation(null); setCredentials([]);
    if (!id) return;
    await perform(async () => {
      const all: RecordView[] = []; let cursor: string | null = null;
      do { const page = await read(`/api/organizations/${id}/projects${cursor ? `?cursor=${cursor}` : ''}`); all.push(...page.items); cursor = page.cursor; } while (cursor);
      setProjects(all); setProject(all[0]?.id ?? '');
      const list = await uiRead({ data: { path: `/api/organizations/${id}/api-credentials` } });
      if (list.status === 200) setCredentials(list.data.items);
    });
  }
  async function historyPage(workItem: RecordView, append = false, scope = organization) {
    const history = await read(`/api/organizations/${scope}/work-items/${workItem.id}/facts?limit=10${append && cursor ? `&cursor=${cursor}` : ''}`);
    setFacts(previous => append ? [...previous, ...history.items] : history.items); setCursor(history.cursor);
  }
  function form(event: FormEvent<HTMLFormElement>) { event.preventDefault(); return new FormData(event.currentTarget); }
  const repositories = projects.find(p => p.id === project)?.repositories ?? [];
  return <main>
    <header><div><small>FACTORY / WORK ITEMS</small><h1>TBFactory</h1></div>{session && <div><small>{session.name}</small><form action="/auth/logout" method="post"><button className="secondary">Sign out</button></form></div>}</header>
    {error && <p role="alert">{error}</p>}
    {!session ? <section><h2>Sign in to your Factory</h2><p>Use the installation's identity provider to access your Organizations.</p><a className="button" href="/auth/login">Sign in</a></section> : <>
      {preview && <section><h2>Invitation to {preview.organization.name}</h2><p>Proposed access: {preview.invitation.grants.map((g: any) => g.activity).join(', ')}</p><p>Recipient: {preview.invitation.email}</p><button disabled={busy} onClick={() => perform(async () => { await write('/api/invitations/accept', { token: invitationToken }); sessionStorage.removeItem('factory-invitation'); setPreview(null); setInvitationToken(''); await refreshOrganizations(); })}>Accept Invitation</button></section>}
      {!organizations.length ? <section><h2>No Organization access</h2><p>Your User is authenticated. An operator or an authorized Invitation must establish your Membership before you can access Factory work.</p></section> : <>
        <label>Organization<select disabled={busy} value={organization} onChange={e => void selectOrganization(e.target.value)}><option value="">Select an Organization</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        {organization && <>
          <section><h2>Create a Work Item</h2><form onSubmit={e => { const data = form(e); void perform(async () => {
            const created = await write(`${base}/work-items`, { project, ...(data.get('repository') ? { repository: data.get('repository') } : {}), title: data.get('title'), type: data.get('type') });
            setItem(created.workItem); await historyPage(created.workItem);
            history.replaceState(null, '', `/?organization=${organization}&workItem=${created.workItem.id}`);
          }); }}>
            <label>Title<input name="title" required maxLength={300} /></label>
            <label>Project<select value={project} required onChange={e => setProject(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Repository (optional)<select name="repository" key={project}><option value="">No Repository</option>{repositories.map((r: RecordView) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label>Work Item Type<select name="type"><option value="pull-request-review">pull-request-review</option></select></label>
            <button disabled={busy || !project}>Create Work Item</button>
          </form></section>
          <section><h2>Open a Work Item</h2><form onSubmit={e => { const data = form(e); void perform(async () => { const existing = await read(`${base}/work-items/${encodeURIComponent(String(data.get('id')))}`); setItem(existing); await historyPage(existing); }); }}><label>Work Item identifier<input name="id" required /></label><button className="secondary" disabled={busy}>Open Work Item</button></form></section>
          {item && <section><small>{item.id}</small><h2>{item.title}</h2><p>Factory state: <strong>{item.state}</strong> · {item.type} · state-flow version {item.version}</p><h3>Fact history</h3>
            {facts.map(fact => <article key={fact.id}><strong>{fact.kind}</strong><p><small>{new Date(fact.recordedAt).toISOString()} · Actor {fact.actor}</small></p><pre>{JSON.stringify(fact.payload, null, 2)}</pre>{fact.correctedFact && <small>Corrects Fact {fact.correctedFact}</small>}<p><small>Fact {fact.id}</small></p></article>)}
            {cursor && <button className="secondary" disabled={busy} onClick={() => perform(() => historyPage(item, true))}>Load more Facts</button>}
            <form onSubmit={e => { const data = form(e); void perform(async () => { await write(`${base}/work-items/${item.id}/notes`, { text: data.get('text') }); await historyPage(item); }); }}><label>Manual note<textarea name="text" required maxLength={10000} /></label><button disabled={busy}>Add note</button></form>
            <form onSubmit={e => { const data = form(e); void perform(async () => { await write(`${base}/work-items/${item.id}/corrections`, { fact: data.get('fact'), text: data.get('text') }); await historyPage(item); }); }}><label>Fact to correct<input name="fact" required /></label><label>Correction<textarea name="text" required maxLength={10000} /></label><button disabled={busy}>Append correction</button></form>
            <form onSubmit={e => { const data = form(e); void perform(async () => { await write(`${base}/work-items/${item.id}/references`, { provider: data.get('provider'), locator: data.get('locator') }); await historyPage(item); }); }}><label>Provider<select name="provider"><option value="github">GitHub</option><option value="azure-devops">Azure DevOps</option></select></label><label>Canonical pull request URL<input type="url" name="locator" required /></label><button disabled={busy}>Add external reference</button></form>
          </section>}
          <div className="columns"><section><h2>Issue an Invitation</h2><form onSubmit={e => { const data = form(e); void perform(async () => { const result = await write(`${base}/invitations`, { email: data.get('email'), grants: data.getAll('grant').map(activity => ({ activity, scope: 'organization', scopeId: organization, effect: 'allow' })) }); setIssuedInvitation(result); }); }}>
            <label>Invited email<input name="email" type="email" required /></label><fieldset><legend>Initial Activities</legend>{['organization.read', 'project.read', 'work-item.create', 'work-item.read', 'history.read', 'note.append', 'correction.append', 'reference.append'].map(activity => <label key={activity}><input type="checkbox" name="grant" value={activity} defaultChecked={['organization.read', 'project.read', 'work-item.read', 'history.read'].includes(activity)} />{activity}</label>)}</fieldset><button disabled={busy}>Issue Invitation</button></form>
            {issuedInvitation && <div className="secret">{issuedInvitation.token ? <><label>Invitation link<input readOnly value={`${location.origin}/?invitation=${issuedInvitation.token}`} /></label><button onClick={() => navigator.clipboard.writeText(`${location.origin}/?invitation=${issuedInvitation.token}`)}>Copy Invitation link</button></> : <p>The one-time link is unavailable. Revoke this Invitation and issue a new one.</p>}<button className="secondary" disabled={busy} onClick={() => perform(async () => { await write(`${base}/invitations/${issuedInvitation.invitation.id}/revoke`, {}); setIssuedInvitation(null); })}>Revoke Invitation</button></div>}
          </section><section><h2>API credentials</h2><form onSubmit={e => { const data = form(e); void perform(async () => { const result = await write(`${base}/api-credentials`, { label: data.get('label'), activities: String(data.get('activities')).split(',').map(s => s.trim()), expiresAt: Date.now() + Number(data.get('days')) * 86400000 }); setCredential(result); setCredentials(previous => [...previous.filter(c => c.id !== result.credential.id), result.credential]); }); }}>
            <label>Credential label<input name="label" required maxLength={200} /></label><label>Activities (comma separated)<input name="activities" defaultValue="organization.read,project.read,work-item.read,history.read" required /></label><label>Lifetime in days<input name="days" type="number" min="1" max="90" defaultValue="30" required /></label><button disabled={busy}>Create API credential</button></form>
            {credential && <div className="secret">{credential.token ? <><p>Copy this token now. It is shown once.</p><label>API token<input readOnly value={credential.token} /></label><button onClick={() => navigator.clipboard.writeText(credential.token)}>Copy API token</button></> : <p>The one-time token is unavailable. Revoke the credential and issue a new one.</p>}</div>}
            {credentials.map(c => <article key={c.id}><p>{c.label} · Expires {new Date(c.expiresAt).toISOString()} · {c.revoked ? 'Revoked' : 'Active'}</p>{!c.revoked && <button className="secondary" disabled={busy} onClick={() => perform(async () => { await write(`${base}/api-credentials/${c.id}/revoke`, {}); setCredentials(previous => previous.map(p => p.id === c.id ? { ...p, revoked: true } : p)); setCredential(null); })}>Revoke {c.label}</button>}</article>)}
          </section></div>
        </>}
      </>}
    </>}
  </main>;
}
