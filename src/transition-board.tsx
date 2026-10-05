import { useEffect, useRef, useState, type FormEvent } from 'react';
import { uiRead, uiWrite } from './ui-functions';
import { ReviewPanel } from './review-panel';

type View = { id: string; [key: string]: any };
export function TransitionBoard({
  organization,
  user,
  refreshKey,
  openItem,
}: {
  organization: string;
  user: string;
  refreshKey: string;
  openItem: (item: View) => Promise<void>;
}) {
  const base = `/api/organizations/${organization}`;
  const [items, setItems] = useState<View[]>([]);
  const [requests, setRequests] = useState<Record<string, View[]>>({});
  const [types, setTypes] = useState<any>(null);
  const [teams, setTeams] = useState<View[] | null>(null);
  const [policies, setPolicies] = useState<View[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const operations = useRef(new Map<string, string>());
  async function read(path: string) {
    const response = await uiRead({ data: { path } });
    if (response.status >= 400) throw new Error(response.data.error);
    return response.data;
  }
  async function all(path: string, firstPage?: { items: View[]; cursor?: string | null }) {
    const rows: View[] = [];
    let cursor: string | null = null;
    do {
      const result: { items: View[]; cursor?: string | null } =
        firstPage ??
        (await read(
          `${path}${cursor ? `${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}` : ''}`,
        ));
      firstPage = undefined;
      rows.push(...result.items);
      cursor = result.cursor ?? null;
    } while (cursor);
    return rows;
  }
  async function write(path: string, body: Record<string, unknown>) {
    const key = JSON.stringify([path, body]);
    const operationId = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, operationId);
    const response = await uiWrite({ data: { path, body: { ...body, operationId } } });
    if (response.status < 500) operations.current.delete(key);
    if (response.status >= 400) throw new Error(response.data.error);
    return response.data;
  }
  async function refresh() {
    setTeams(null);
    setPolicies(null);
    const cards = await all(`${base}/board?type=pull-request-review`);
    const pending: Record<string, View[]> = {};
    for (const card of cards)
      pending[card.id] = await all(`${base}/work-items/${card.id}/transition-requests`);
    setItems(cards);
    setRequests(pending);
    setTypes(await read(`${base}/work-item-types`));
    for (const [path, setter] of [
      ['teams', setTeams],
      ['policies', setPolicies],
    ] as const) {
      const response = await uiRead({ data: { path: `${base}/${path}` } });
      if (response.status === 200) setter(await all(`${base}/${path}`, response.data));
      else if (response.status === 403) setter(null);
      else throw new Error(response.data.error);
    }
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh().catch((e) => setError((e as Error).message));
  }, [refreshKey]);
  const form = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return new FormData(event.currentTarget);
  };
  const words = (value: FormDataEntryValue | null) =>
    String(value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const states = [
    ...new Set<string>((types?.definitions ?? []).flatMap((definition: any) => definition.states)),
  ];
  return (
    <section aria-label="Transition Board">
      <h2>Kanban Board · pull-request-review</h2>
      <p>
        Factory state and Workflow Run execution state are displayed separately. Each card uses its
        retained state-flow version.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button className="secondary" disabled={busy} onClick={() => void perform(async () => {})}>
        Refresh board
      </button>
      <div className="kanban">
        {states.map((state) => (
          <div className="kanban-column" key={state}>
            <h3>{state}</h3>
            {items
              .filter((item) => item.state === state)
              .map((item) => (
                <article key={item.id} aria-label={`Work Item ${item.title}`}>
                  <h4>{item.title}</h4>
                  <small>
                    {item.id} · state-flow version {item.version}
                  </small>
                  <p>
                    Factory state: <strong>{item.state}</strong>
                  </p>
                  <p>
                    Workflow Run execution state:{' '}
                    <strong>
                      {item.workflowRun?.status ??
                        item.workflowRun?.executionState ??
                        'No active run'}
                    </strong>
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void perform(() => openItem(item))}
                  >
                    Open history
                  </button>
                  {!item.transitions.length && <p>No transitions in this retained version.</p>}
                  {[3, 4].includes(item.version) && (
                    <ReviewPanel
                      organization={organization}
                      item={item as { id: string; title: string; version: number }}
                      onChange={refresh}
                    />
                  )}
                  {item.transitions.map((transition: any) => (
                    <form
                      key={transition.id}
                      aria-label={transition.id}
                      onSubmit={(event) => {
                        const data = form(event);
                        void perform(async () => {
                          const inputs = Object.fromEntries(
                            transition.inputs.map((name: string) => [name, data.get(name)]),
                          );
                          const result = await write(
                            `${base}/work-items/${item.id}/transition-requests`,
                            {
                              transition: transition.id,
                              expectedState: item.state,
                              version: item.version,
                              inputs,
                            },
                          );
                          setMessage(
                            result.completed
                              ? 'State Transition completed.'
                              : result.workflowRun
                                ? 'Review Intake Workflow accepted. Factory state is unchanged.'
                                : 'Transition Request accepted; awaiting Approval. Factory state is unchanged.',
                          );
                          await openItem(result.workItem);
                        });
                      }}
                    >
                      <h4>{transition.id}</h4>
                      {transition.prerequisites.length > 0 && (
                        <p>Prerequisites: {transition.prerequisites.join('; ')}</p>
                      )}
                      {transition.available ? (
                        <>
                          {transition.requiresApproval && (
                            <p>Activity-bound human Approval required.</p>
                          )}
                          {transition.inputs.map((name: string) => (
                            <label key={name}>
                              {name}
                              {name.endsWith('Fact') ? (
                                <input
                                  name={name}
                                  required
                                  readOnly
                                  value={item.readinessFact ?? ''}
                                />
                              ) : (
                                <textarea name={name} required maxLength={10000} />
                              )}
                            </label>
                          ))}
                          <button disabled={busy}>Request {transition.id}</button>
                        </>
                      ) : (
                        <p>{transition.reason}</p>
                      )}
                    </form>
                  ))}
                  {(requests[item.id] ?? [])
                    .filter((request) => request.status !== 'completed')
                    .map((request) => (
                      <div key={request.id}>
                        <p>
                          Transition Request: {request.transition} ·{' '}
                          <strong>{request.status}</strong>
                        </p>
                        {request.status === 'pending-approval' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void perform(async () => {
                                await write(
                                  `${base}/work-items/${item.id}/transition-requests/${request.id}/approve`,
                                  {},
                                );
                                setMessage(
                                  'Activity approved. Execution still requires current permission.',
                                );
                              })
                            }
                          >
                            Approve {request.transition}
                          </button>
                        )}
                        {request.status === 'approved' &&
                          request.user === user &&
                          !request.credential && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void perform(async () => {
                                  const result = await write(
                                    `${base}/work-items/${item.id}/transition-requests/${request.id}/execute`,
                                    {},
                                  );
                                  setMessage('State Transition completed.');
                                  await openItem(result.workItem);
                                })
                              }
                            >
                              Execute {request.transition}
                            </button>
                          )}
                        {request.credential && (
                          <p>Execution must use the original API credential.</p>
                        )}
                      </div>
                    ))}
                </article>
              ))}
          </div>
        ))}
      </div>
      {types && (
        <details>
          <summary>Work Item Type selection</summary>
          <form
            onSubmit={(event) => {
              const data = form(event);
              void perform(async () => {
                await write(`${base}/work-item-types`, {
                  type: 'pull-request-review',
                  version: Number(data.get('version')),
                  enabled: data.get('enabled') === 'on',
                });
                setMessage('Selection saved for new Work Items. Existing versions are retained.');
              });
            }}
          >
            <label>
              Version for new Work Items
              <select
                name="version"
                key={types.selection.version}
                defaultValue={types.selection.version}
              >
                <option value="1">1 · registered only</option>
                <option value="2">2 · review lifecycle</option>
                <option value="3">3 · durable private review</option>
                <option value="4">4 · confirmed publication</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                name="enabled"
                key={String(types.selection.enabled)}
                defaultChecked={types.selection.enabled}
              />
              Enable creation
            </label>
            <button disabled={busy}>Save type selection</button>
          </form>
        </details>
      )}
      {teams && (
        <details>
          <summary>Manage Teams</summary>
          <p>Teams operate across this Organization's Projects and Repositories.</p>
          <form
            onSubmit={(event) => {
              const data = form(event);
              void perform(async () => {
                await write(`${base}/teams`, {
                  name: data.get('name'),
                  members: words(data.get('members')),
                });
              });
            }}
          >
            <label>
              Team name
              <input name="name" required maxLength={200} />
            </label>
            <label>
              Member User identifiers (comma separated)
              <input name="members" defaultValue={user} />
            </label>
            <button disabled={busy}>Create Team</button>
          </form>
          {teams.map((team) => (
            <form
              key={JSON.stringify(team)}
              onSubmit={(event) => {
                const data = form(event);
                void perform(async () => {
                  await write(`${base}/teams/${team.id}`, {
                    name: data.get('name'),
                    members: words(data.get('members')),
                  });
                });
              }}
            >
              <small>Team {team.id}</small>
              <label>
                Name
                <input name="name" defaultValue={team.name} required />
              </label>
              <label>
                Member User identifiers
                <input name="members" defaultValue={team.members.join(',')} />
              </label>
              <button disabled={busy}>Update Team</button>
            </form>
          ))}
        </details>
      )}
      {policies && (
        <details>
          <summary>Manage scoped policies</summary>
          <form
            onSubmit={(event) => {
              const data = form(event);
              void perform(async () => {
                await write(`${base}/policies`, {
                  [String(data.get('principalKind'))]: data.get('principal'),
                  activity: data.get('activity'),
                  scope: data.get('scope'),
                  scopeId: data.get('scopeId'),
                  effect: data.get('effect'),
                });
              });
            }}
          >
            <label>
              Principal kind
              <select name="principalKind">
                <option value="user">User</option>
                <option value="team">Team</option>
              </select>
            </label>
            <label>
              Principal identifier
              <input name="principal" defaultValue={user} required />
            </label>
            <label>
              Activity
              <input name="activity" defaultValue="transition.prepare-review" required />
            </label>
            <label>
              Scope
              <select name="scope">
                {['organization', 'project', 'repository', 'team', 'user'].map((scope) => (
                  <option key={scope}>{scope}</option>
                ))}
              </select>
            </label>
            <label>
              Scope identifier
              <input name="scopeId" defaultValue={organization} required />
            </label>
            <label>
              Effect
              <select name="effect">
                <option value="allow">allow</option>
                <option value="deny">deny</option>
                <option value="human">human</option>
              </select>
            </label>
            <button disabled={busy}>Install policy</button>
          </form>
          {policies.map((policy) => (
            <div key={policy.id}>
              <p>
                {policy.activity} · {policy.effect} · {policy.scope}:{policy.scopeId} ·{' '}
                {policy.team ? `Team ${policy.team}` : `User ${policy.user}`}
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await write(`${base}/policies/${policy.id}/remove`, {});
                  })
                }
              >
                Remove policy {policy.id}
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
