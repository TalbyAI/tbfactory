export function factorySearch(search: Record<string, unknown>) {
  const organization = typeof search.organization === 'string' ? search.organization : undefined;
  const workItem = typeof search.workItem === 'string' ? search.workItem : undefined;
  const invitation = typeof search.invitation === 'string' ? search.invitation : undefined;
  const view =
    search.view === 'settings' || search.view === 'create'
      ? search.view
      : workItem
        ? 'detail'
        : 'board';
  return { organization, workItem, invitation, view };
}
