export function WorkItemCard({
  organization,
  item,
  repositoryName,
  pendingApproval,
}: {
  organization: string;
  item: {
    id: string;
    title: string;
    state: string;
    version: number;
    repository?: string;
    workflowRun?: { status?: string; executionState?: string } | null;
    [key: string]: unknown;
  };
  repositoryName?: string;
  pendingApproval: boolean;
}) {
  const execution = item.workflowRun?.status ?? item.workflowRun?.executionState ?? 'No active run';
  return (
    <article className="work-item-card" aria-label={`Work Item ${item.title}`}>
      <small className="card-repository" title={repositoryName ?? item.repository}>
        {repositoryName ?? item.repository ?? 'No Repository'}
      </small>
      <h4>
        <a href={`/?${new URLSearchParams({ organization, workItem: item.id })}`}>{item.title}</a>
      </h4>
      <dl className="card-states">
        <div>
          <dt>Factory state</dt>
          <dd>{item.state}</dd>
        </div>
        <div>
          <dt>Workflow Run</dt>
          <dd>{execution}</dd>
        </div>
      </dl>
      {pendingApproval && <p className="attention">Approval pending</p>}
      <small className="card-id" title={item.id}>
        {item.id.slice(0, 8)} · version {item.version}
      </small>
    </article>
  );
}
