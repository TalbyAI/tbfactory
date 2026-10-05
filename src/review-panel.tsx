import { useEffect, useRef, useState, type FormEvent } from 'react';
import { uiRead, uiWrite } from './ui-functions';

export function ReviewPanel({
  organization,
  item,
  onChange,
}: {
  organization: string;
  item: { id: string; title: string };
  onChange: () => Promise<void>;
}) {
  const path = `/api/organizations/${organization}/work-items/${item.id}`;
  const [view, setView] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const operations = useRef(new Map<string, string>());
  async function refresh() {
    const result = await uiRead({ data: { path: `${path}/reviews` } });
    if (result.status === 200) setView(result.data);
    else if (result.status !== 403) setError(result.data.error);
  }
  useEffect(() => {
    setView(null);
    void refresh();
  }, [organization, item.id]);
  async function write(endpoint: string, body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const requestPath = `${path}/${endpoint}`;
      const key = JSON.stringify([requestPath, body]);
      const operationId = operations.current.get(key) ?? crypto.randomUUID();
      operations.current.set(key, operationId);
      const response = await uiWrite({
        data: { path: requestPath, body: { ...body, operationId } },
      });
      if (response.status < 500) operations.current.delete(key);
      if (response.status >= 400) throw Error(response.data.error);
      await refresh();
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!view) return error ? <p role="alert">{error}</p> : null;
  const active = view.runs.find(
    (r: any) => !['completed', 'superseded', 'stopped'].includes(r.status),
  );
  return (
    <section aria-label={`Private review ${item.title}`}>
      <h4>Private Review Reports</h4>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="secondary" disabled={busy} onClick={() => void refresh()}>
        Refresh review
      </button>
      {active && (
        <p>
          Execution: <strong>{active.status}</strong> · Workflow: {active.workflow}
        </p>
      )}
      {active?.error && <p role="status">{active.error}</p>}
      {view.notifications
        .filter((n: any) => !n.resolved)
        .map((n: any) => (
          <p role="status" key={n.id}>
            {n.message}
          </p>
        ))}
      {active?.status === 'waiting-inputs' && (
        <form
          aria-label="Supply review Facts"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const fields = Object.fromEntries(
              [...data.entries()]
                .filter(([, value]) => String(value).trim())
                .map(([name, value]) => [name, String(value).trim()]),
            );
            void write('review-facts', { fields });
          }}
        >
          {['sourceBranch', 'targetBranch', 'sourceCommit', 'targetCommit'].map((field) => (
            <label key={field}>
              {field}
              <input name={field} defaultValue={view.currentInputs[field] ?? ''} maxLength={300} />
            </label>
          ))}
          <button disabled={busy}>Record review Facts</button>
        </form>
      )}
      {active?.status === 'waiting-approval' && (
        <button disabled={busy} onClick={() => void write('review-approval', { run: active.id })}>
          Approve report generation
        </button>
      )}
      {view.reports.map((report: any) => (
        <details key={report.id} open={report.id === active?.report}>
          <summary>Private report · {report.id.slice(0, 12)}</summary>
          <p>Summary: {report.summary}</p>
          <p>Human Review Decision: pending. Findings are proposed.</p>
          <p>
            Source: {report.relevantInputs.checkout.sourceCommit} · Target:{' '}
            {report.relevantInputs.checkout.targetCommit}
          </p>
          {(view.currentInputs.sourceCommit !== report.relevantInputs.checkout.sourceCommit ||
            view.currentInputs.targetCommit !== report.relevantInputs.checkout.targetCommit) && (
            <p role="status">
              Source or target commits have changed. This report retains its original inputs.
            </p>
          )}
          {report.findings.map((finding: any) => (
            <div key={finding.id}>
              <h5>
                {finding.title} · {finding.severity}
              </h5>
              <p>{finding.explanation}</p>
              {finding.location && (
                <p>
                  {finding.location.path}:{finding.location.line}
                </p>
              )}
              {finding.previousFinding && (
                <p>
                  Previous Finding: {finding.previousFinding} · {finding.assessment}
                </p>
              )}
            </div>
          ))}
          {!report.findings.length && <p>No Findings. Human review is still required.</p>}
          <a href={`${path}/reviews/${report.id}/artifact`}>Download private Markdown report</a>
          {active?.report === report.id && active.status === 'waiting-review' && (
            <button
              disabled={busy}
              onClick={() => void write('review-supersession', { run: active.id })}
            >
              Supersede this review
            </button>
          )}
        </details>
      ))}
    </section>
  );
}
