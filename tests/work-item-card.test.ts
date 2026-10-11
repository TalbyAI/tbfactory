import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkItemCard } from '../src/work-item-card.tsx';
import { factorySearch } from '../src/factory-navigation.ts';

test('Board cards link to detail and summarize execution without exposing reports or forms', () => {
  const html = renderToStaticMarkup(
    createElement(WorkItemCard, {
      organization: 'alpha',
      repositoryName: 'Real code',
      item: {
        id: 'review-1',
        title: 'Review <change>',
        state: 'ready-for-review',
        version: 4,
        workflowRun: { status: 'waiting-human' },
        report: { summary: 'PRIVATE REPORT CONTENT' },
      },
      pendingApproval: true,
    }),
  );
  assert.match(html, /Review &lt;change&gt;/);
  assert.match(html, /Real code/);
  assert.match(html, /Factory state/);
  assert.match(html, /waiting-human/);
  assert.match(html, /Approval pending/);
  assert.match(html, /href="\/\?organization=alpha&amp;workItem=review-1"/);
  assert.doesNotMatch(html, /<form|PRIVATE REPORT CONTENT|<textarea/);
});

test('Existing detail URLs stay valid and invalid view input returns to the Board', () => {
  assert.equal(factorySearch({ organization: 'alpha', workItem: 'review-1' }).view, 'detail');
  assert.equal(factorySearch({ view: 'unexpected' }).view, 'board');
  assert.equal(factorySearch({ organization: ['alpha'], workItem: 1 }).organization, undefined);
  assert.equal(factorySearch({ view: 'detail' }).view, 'board');
  assert.equal(factorySearch({ organization: 'alpha', view: 'settings' }).view, 'settings');
});
