import { useEffect, useRef, useState, type FormEvent } from 'react';
import { uiRead, uiWrite } from './ui-functions';

export function ReviewPanel({
  organization,
  item,
  onChange,
}: {
  organization: string;
  item: { id: string; title: string; version: number };
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
    <section className="review-panel" aria-label={`Private review ${item.title}`}>
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
        <div>
          {view.runStatus.find((s: any) => s.run === active.id)?.current === false && (
            <p role="status">
              Relevant input versions have changed. Supersede this review before requesting renewed
              Approval.
            </p>
          )}
          <button
            disabled={
              busy || view.runStatus.find((s: any) => s.run === active.id)?.current === false
            }
            onClick={() => void write('review-approval', { run: active.id })}
          >
            Approve report generation
          </button>
          <button
            disabled={busy}
            onClick={() => void write('review-supersession', { run: active.id })}
          >
            Supersede this review
          </button>
        </div>
      )}
      {view.reports.map((report: any) => {
        const run = view.runs.find((r: any) => r.id === report.run);
        const decision = view.decisions.find((d: any) => d.id === run?.decision);
        const current = view.reportStatus.find((s: any) => s.report === report.id)?.current;
        const publication = view.publications.find((p: any) => p.id === run?.publication);
        const canReview =
          (!run?.publication || publication?.correctionAllowed) &&
          current &&
          (['waiting-review', 'waiting-revalidation'].includes(run?.status) ||
            (!active && run?.status === 'completed'));
        return (
          <details key={report.id} open={report.id === active?.report}>
            <summary>Private report · {report.id.slice(0, 12)}</summary>
            <p>Summary: {report.summary}</p>
            <p>
              Human Review Decision:{' '}
              {decision
                ? decision.usable
                  ? 'submitted and current'
                  : 'requires renewed review'
                : 'pending. Findings are proposed.'}
            </p>
            <p>
              Source: {report.relevantInputs.checkout.sourceCommit} · Target:{' '}
              {report.relevantInputs.checkout.targetCommit}
            </p>
            {!current && (
              <p role="status">
                Relevant input versions have changed. This report retains its original inputs.
                Request a new review and confirm its Findings again.
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
            {!report.findings.length && (
              <p>
                {decision?.usable
                  ? 'No Findings. Human review recorded.'
                  : 'No Findings. Human review is still required.'}
              </p>
            )}
            <a href={`${path}/reviews/${report.id}/artifact`}>Download private Markdown report</a>
            {item.version === 4 &&
              decision?.usable &&
              run?.status === 'completed' &&
              !active &&
              (!run.publication ||
                (publication?.correctionAllowed && publication.decision !== decision.id)) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void write('review-publications', { run: run.id, decision: decision.id })
                  }
                >
                  Request publication of confirmed Findings
                </button>
              )}
            {(view.publications ?? [])
              .filter((p: any) => p.run === report.run)
              .map((p: any) => (
                <PublicationPanel
                  key={p.id}
                  publication={p}
                  history={view.publicationHistory ?? []}
                  busy={busy}
                  write={write}
                />
              ))}
            {view.decisions
              .filter((d: any) => d.payload.reportVersion === report.id)
              .map((d: any) => (
                <details key={d.id} open={d.id === decision?.id}>
                  <summary>
                    Review Decision · {d.id.slice(0, 12)} · {d.usable ? 'current' : 'superseded'} ·
                    User {d.actor}
                  </summary>
                  {d.payload.findings.map((f: any) => (
                    <p key={f.finding}>
                      {report.findings.find((finding: any) => finding.id === f.finding)?.title}:{' '}
                      {f.decision}
                      {f.reason && ` — ${f.reason}`}
                    </p>
                  ))}
                  {!d.payload.findings.length && <p>Empty report explicitly reviewed.</p>}
                </details>
              ))}
            {canReview && (
              <ReviewDecisionForm
                key={`${report.id}:${decision?.id ?? 'pending'}`}
                report={report}
                decision={decision}
                busy={busy}
                submit={(findings) =>
                  write('review-decisions', {
                    run: report.run,
                    reportVersion: report.version,
                    reviewed: true,
                    findings,
                    ...(decision ? { replaces: decision.id } : {}),
                  })
                }
              />
            )}
            {active?.report === report.id &&
              ['waiting-review', 'waiting-revalidation', 'waiting-authorization'].includes(
                active.status,
              ) && (
                <button
                  disabled={busy}
                  onClick={() => void write('review-supersession', { run: active.id })}
                >
                  Supersede this review
                </button>
              )}
          </details>
        );
      })}
    </section>
  );
}

function PublicationPanel({
  publication: p,
  history,
  busy,
  write,
}: {
  publication: any;
  history: any[];
  busy: boolean;
  write: (endpoint: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const evidence = history.find((f) => f.id === p.evidence)?.payload;
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState('completed');
  const [confirmedStopped, setConfirmedStopped] = useState(false);
  const recoverable = ['uncertain', 'failed', 'blocked'].includes(p.status);
  const canComplete = !!evidence?.matches.length;
  const canRetry = !!evidence?.complete && !evidence.unavailable && !canComplete;
  const canStop = canRetry || (!!evidence?.noDispatch && !canComplete);
  const allowed =
    resolution === 'completed'
      ? canComplete
      : resolution === 'retry'
        ? canRetry
        : resolution === 'not-published' && canStop;
  useEffect(() => {
    setResolution(canComplete ? 'completed' : canStop ? 'not-published' : '');
    setReason('');
    setConfirmedStopped(false);
  }, [p.evidence, canComplete, canStop]);
  return (
    <section aria-label="Publication and recovery">
      <h5>
        Publication: {p.status} · Attempt {p.attempt}
      </h5>
      <p>
        Destination: {p.destination.external.provider} · Pull request {p.destination.number}
      </p>
      {p.error && <p role="status">{p.error}</p>}
      {p.effect && <p>Completed provider comment: {p.effect.id}</p>}
      {p.effects?.length > 1 && (
        <p role="status">
          Possible duplicate publication. Matching provider comments:{' '}
          {p.effects.map((effect: any) => effect.id).join(', ')}. Another attempt is prohibited.
        </p>
      )}
      {p.status === 'waiting-approval' && (
        <button
          disabled={busy}
          onClick={() => void write('publication-approval', { run: p.run, publication: p.id })}
        >
          Approve this publication Activity
        </button>
      )}
      {recoverable && (
        <button
          disabled={busy}
          onClick={() =>
            void write('publication-reconciliation', { run: p.run, publication: p.id })
          }
        >
          Gather provider evidence
        </button>
      )}
      {evidence && (
        <p>
          Provider evidence: {evidence.matches.length} matching effects.{' '}
          {evidence.complete ? 'Listing complete.' : 'Listing incomplete or unavailable.'} Absence
          does not prove that publication failed.{' '}
          {recoverable ? 'User confirmation is required.' : 'Recovery decision recorded.'}
        </p>
      )}
      {recoverable && evidence && !canComplete && !canStop && (
        <p role="status">
          Evidence is insufficient to resolve publication or authorize another attempt. Gather
          provider evidence again; the outcome remains unresolved.
        </p>
      )}
      {recoverable && evidence && canComplete && evidence.matches.length > 1 && (
        <p role="status">
          Possible duplicate publication. Matching provider comments:{' '}
          {evidence.matches.map((effect: any) => effect.id).join(', ')}. Another attempt is
          prohibited.
        </p>
      )}
      {recoverable && evidence?.noDispatch && !canComplete && (
        <p>
          The Factory never authorized a provider POST for this attempt. You may confirm the stopped
          Activity as not published.
        </p>
      )}
      {recoverable && evidence && (canComplete || canStop) && (
        <form
          aria-label="Confirm publication recovery"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim() || !confirmedStopped || !allowed) return;
            void write('publication-confirmation', {
              run: p.run,
              publication: p.id,
              evidence: p.evidence,
              resolution,
              reason: reason.trim(),
              confirmedStopped: true,
            });
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Recovery decision
              <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
                <option value="" disabled>
                  Choose a recovery decision
                </option>
                {canComplete && <option value="completed">Confirm already published</option>}
                {canStop && <option value="not-published">Confirm not published and stop</option>}
                {canRetry && <option value="retry">Authorize a new publication attempt</option>}
              </select>
            </label>
            <label>
              Evidence and reason
              <textarea
                required
                maxLength={10000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label className="review-confirmation">
              <input
                type="checkbox"
                checked={confirmedStopped}
                onChange={(event) => setConfirmedStopped(event.target.checked)}
              />{' '}
              I verified the provider outcome and confirm the previous attempt has stopped. A new
              attempt may duplicate a publication if my conclusion is wrong.
            </label>
            <button disabled={busy || !reason.trim() || !confirmedStopped || !allowed}>
              Record recovery decision
            </button>
          </fieldset>
        </form>
      )}
      <details>
        <summary>Immutable publication history</summary>
        {history
          .filter((f) => f.payload.activity === p.id)
          .map((f) => (
            <p key={f.id}>
              {f.kind} · User {f.actor}
              {f.payload.resolution && ` · ${f.payload.resolution}`}
              {f.payload.reason && ` · ${f.payload.reason}`}
            </p>
          ))}
      </details>
    </section>
  );
}

function ReviewDecisionForm({
  report,
  decision,
  busy,
  submit,
}: {
  report: any;
  decision: any;
  busy: boolean;
  submit: (findings: any[]) => Promise<void>;
}) {
  const [choices, setChoices] = useState<Record<string, { decision: string; reason: string }>>(() =>
    Object.fromEntries(
      (decision?.payload.findings ?? []).map((f: any) => [
        f.finding,
        { decision: f.decision, reason: f.reason ?? '' },
      ]),
    ),
  );
  const [reviewed, setReviewed] = useState(false);
  const complete =
    reviewed &&
    report.findings.every(
      (f: any) =>
        choices[f.id]?.decision === 'confirmed' ||
        (choices[f.id]?.decision === 'rejected' && choices[f.id].reason.trim()),
    );
  return (
    <form
      className="review-decision"
      aria-label="Consolidated Review Decision"
      onSubmit={(event) => {
        event.preventDefault();
        if (!complete) return;
        void submit(
          report.findings.map((f: any) => ({
            finding: f.id,
            decision: choices[f.id].decision,
            ...(choices[f.id].decision === 'rejected'
              ? { reason: choices[f.id].reason.trim() }
              : {}),
          })),
        );
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {decision ? 'Correct or renew the Review Decision' : 'Review all Findings together'}
        </legend>
        {report.findings.map((f: any) => (
          <div key={f.id}>
            <label>
              Decision for {f.title}
              <select
                value={choices[f.id]?.decision ?? ''}
                required
                onChange={(event) =>
                  setChoices({
                    ...choices,
                    [f.id]: { decision: event.target.value, reason: choices[f.id]?.reason ?? '' },
                  })
                }
              >
                <option value="">Choose a decision</option>
                <option value="confirmed">Confirm</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
            {choices[f.id]?.decision === 'rejected' && (
              <label>
                Rejection reason for {f.title}
                <textarea
                  required
                  maxLength={10000}
                  value={choices[f.id].reason}
                  onChange={(event) =>
                    setChoices({
                      ...choices,
                      [f.id]: { ...choices[f.id], reason: event.target.value },
                    })
                  }
                />
              </label>
            )}
          </div>
        ))}
        <label className="review-confirmation">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
          />{' '}
          I reviewed this report version and all its Findings, including an empty report.
        </label>
        <p>
          This Review Decision records human validation. Publication requires separate
          authorization.
        </p>
        <button disabled={!complete || busy}>Submit consolidated Review Decision</button>
      </fieldset>
    </form>
  );
}
