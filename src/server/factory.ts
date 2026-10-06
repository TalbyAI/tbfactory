import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest, fail, identifier, stable, text } from './contracts';
import { type Store, type Transaction, type Row } from './store';
import { type Caller } from './auth';
import { authorized, currentCaller, visible, type Scope } from './authorization';
import {
  credentialIssue,
  credentialMetadata,
  credentialOperation,
  revocation,
} from './credentials';
import {
  invitationAccept,
  invitationIssue,
  invitationOperation,
  invitationPreview,
} from './invitations';
import { definition, selection, selectionSchema } from './work-item-types';
import { migrateWorkItem, typeMigrationSchema } from './work-item-migrations';
import { initialPublicationMode, publicationModeSchema } from './publication-provider';
import { sharingOperation, shareCreationSchema, shareActionSchema } from './artifact-sharing';
import { type ReviewArtifacts } from './review-artifacts';
import {
  publicationOperation,
  publicationActionSchema,
  publicationConfirmationSchema,
} from './publications';
import {
  reviewOperation,
  reviewFactsSchema,
  reviewActionSchema,
  reviewDecisionSchema,
} from './reviews';
import {
  boardItem,
  transitionOperation,
  transitionRequestSchema,
  requestActionSchema,
} from './transitions';
import {
  managementOperation,
  managedPolicySchema,
  teamSchema,
  removePolicySchema,
} from './organization-management';

const operationId = { operationId: identifier };
const creation = z.strictObject({
  ...operationId,
  project: identifier,
  repository: identifier.optional(),
  title: text.max(300),
  type: z.literal('pull-request-review'),
  publicationMode: publicationModeSchema.optional(),
});
const note = z.strictObject({ ...operationId, text });
const correction = z.strictObject({ ...operationId, fact: identifier, text });
const reference = z
  .strictObject({
    ...operationId,
    provider: z.enum(['github', 'azure-devops']),
    locator: z.url().max(2000),
  })
  .superRefine((value, context) => {
    const url = new URL(value.locator);
    const github =
      value.provider === 'github' &&
      url.hostname === 'github.com' &&
      /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[1-9][0-9]*$/.test(url.pathname);
    const azure =
      value.provider === 'azure-devops' &&
      url.hostname === 'dev.azure.com' &&
      /^\/[^/]+\/[^/]+\/_git\/[^/]+\/pullrequest\/[1-9][0-9]*$/.test(url.pathname);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.port ||
      (!github && !azure)
    )
      context.addIssue({
        code: 'custom',
        message: 'Expected canonical external pull request locator',
      });
  });
const reads = z.strictObject({
  cursor: z.string().max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type Operation = {
  action: string;
  organization?: string;
  resource?: string;
  request?: string;
  input?: unknown;
  query?: Record<string, string>;
};
const inputSchemas: Record<string, z.ZodType> = {
  'sharing.create': shareCreationSchema,
  'sharing.approve': shareActionSchema,
  'sharing.revoke': shareActionSchema,
  'sharing.revoke-approve': shareActionSchema,
  'publication.request': publicationActionSchema,
  'publication.approve': publicationActionSchema,
  'publication.reconcile': publicationActionSchema,
  'publication.confirm': publicationConfirmationSchema,
  'review.facts': reviewFactsSchema,
  'review.approve': reviewActionSchema,
  'review.supersede': reviewActionSchema,
  'review.cancel': reviewActionSchema,
  'review.decide': reviewDecisionSchema,
  'type.manage': selectionSchema,
  'work-item.migrate': typeMigrationSchema,
  'team.manage': teamSchema,
  'policy.manage': managedPolicySchema,
  'policy.remove': removePolicySchema,
  'transition.request': transitionRequestSchema,
  'transition.approve': requestActionSchema,
  'transition.execute': requestActionSchema,
  'work-item.create': creation,
  'note.append': note,
  'correction.append': correction,
  'reference.append': reference,
  'credential.issue': credentialIssue,
  'credential.revoke': revocation,
  'invitation.issue': invitationIssue,
  'invitation.accept': invitationAccept,
  'invitation.preview': invitationPreview,
  'invitation.revoke': revocation,
};

export function page(items: Row[], query: z.infer<typeof reads>, chronological = false) {
  const key = (r: Row) =>
    chronological ? `${String(r.recordedAt).padStart(16, '0')}:${r.id}` : r.id;
  let after = '';
  if (query.cursor) {
    try {
      after = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()).after;
      if (typeof after !== 'string') throw new Error();
    } catch {
      fail(422, 'Invalid cursor');
    }
  }
  const sorted = items.sort((a, b) => key(a).localeCompare(key(b))).filter((r) => key(r) > after);
  const selected = sorted.slice(0, query.limit);
  return {
    items: selected,
    cursor:
      sorted.length > selected.length
        ? Buffer.from(JSON.stringify({ after: key(selected.at(-1)!) })).toString('base64url')
        : null,
  };
}

export class Factory {
  constructor(
    readonly store: Store,
    readonly settings = { credentialMaximumDays: 90, invitationDays: 7 },
    readonly sharing: { artifacts?: ReviewArtifacts; origin?: string } = {},
  ) {}
  async execute(caller: Caller, operation: Operation): Promise<any> {
    const query = reads.parse(
      operation.action === 'invitation.preview'
        ? {}
        : operation.action === 'board'
          ? { cursor: operation.query?.cursor, limit: operation.query?.limit }
          : (operation.query ?? {}),
    );
    if (operation.action === 'board')
      z.strictObject({
        type: z.literal('pull-request-review'),
        cursor: z.string().optional(),
        limit: z.string().optional(),
      }).parse(operation.query);
    const organization = operation.organization;
    if (organization) identifier.parse(organization);
    if (operation.resource) identifier.parse(operation.resource);
    if (operation.request) identifier.parse(operation.request);
    const input: any = inputSchemas[operation.action]?.parse(
      operation.action === 'invitation.preview' ? operation.query : operation.input,
    );
    return this.store.transaction(async (tx) => {
      await currentCaller(tx, caller);
      if (['invitation.accept', 'invitation.preview'].includes(operation.action))
        return invitationOperation(
          this,
          tx,
          caller,
          operation,
          input,
          this.settings.invitationDays,
        );
      if (operation.action === 'organizations') {
        const memberships = await tx.list('membership', 'user = $user AND active = true', {
          user: caller.user,
        });
        const organizations: Row[] = [];
        for (const member of memberships) {
          try {
            await authorized(tx, caller, 'organization.read', {
              organization: String(member.organization),
            });
          } catch (e) {
            if (
              (e as { status: number }).status === 403 ||
              (e as { status: number }).status === 404
            )
              continue;
            throw e;
          }
          const record = await tx.get('organization', String(member.organization));
          if (record) organizations.push(record);
        }
        return page(organizations, query);
      }
      if (!organization) fail(404, 'Resource not found');
      await visible(tx, caller, organization);
      if (operation.action.startsWith('team.') || operation.action.startsWith('policy.'))
        return managementOperation(this, tx, caller, operation, input, query);
      if (operation.action === 'type.list') {
        await authorized(tx, caller, 'organization.read', { organization });
        return {
          definitions: [1, 2, 3, 4, 5].map((version) => definition('pull-request-review', version)),
          selection: await selection(tx, organization),
        };
      }
      if (operation.action === 'type.manage') {
        await authorized(tx, caller, 'type.manage', { organization });
        return this.mutate(tx, caller, operation, input, async () => ({
          selection: await tx.put('type_selection', {
            id: organization,
            organization,
            type: input.type,
            version: input.version,
            enabled: input.enabled,
          }),
        }));
      }
      if (operation.action.startsWith('invitation.'))
        return invitationOperation(
          this,
          tx,
          caller,
          operation,
          input,
          this.settings.invitationDays,
        );
      if (operation.action === 'credential.list') {
        if (!caller.human) fail(403, 'Browser confirmation required');
        await authorized(tx, caller, 'credential.revoke', { organization });
        return page(
          (
            await tx.list('credential', 'organization = $organization AND user = $user', {
              organization,
              user: caller.user,
            })
          ).map(credentialMetadata),
          query,
        );
      }
      if (operation.action.startsWith('credential.'))
        return credentialOperation(
          this,
          tx,
          caller,
          operation,
          input,
          this.settings.credentialMaximumDays,
        );
      if (operation.action === 'projects') {
        const projects = await tx.list('project', 'organization = $organization', { organization });
        const permitted: Row[] = [];
        for (const project of projects) {
          try {
            await authorized(tx, caller, 'project.read', { organization, project: project.id });
          } catch (e) {
            if ((e as { status: number }).status === 403) continue;
            throw e;
          }
          const repositories = await tx.list(
            'repository',
            'organization = $organization AND project = $project',
            { organization, project: project.id },
          );
          const allowed: Row[] = [];
          for (const repository of repositories) {
            try {
              await authorized(tx, caller, 'project.read', {
                organization,
                project: project.id,
                repository: repository.id,
              });
              allowed.push(repository);
            } catch (e) {
              if ((e as { status: number }).status !== 403) throw e;
            }
          }
          permitted.push({ ...project, repositories: allowed });
        }
        return page(permitted, query);
      }
      if (operation.action === 'work-item.list' || operation.action === 'board') {
        const items = await tx.list('work_item', 'organization = $organization', { organization });
        const permitted: Row[] = [];
        for (const item of items) {
          try {
            await authorized(tx, caller, 'work-item.read', {
              organization,
              project: String(item.project),
              repository: item.repository as string | undefined,
            });
            permitted.push(item);
          } catch (error) {
            if ((error as { status: number }).status !== 403) throw error;
          }
        }
        const selected = page(permitted, query);
        return operation.action === 'board'
          ? {
              ...selected,
              items: await Promise.all(selected.items.map((item) => boardItem(tx, caller, item))),
            }
          : selected;
      }
      let scope: Scope = { organization };
      let workItem: Row | undefined;
      if (operation.action === 'work-item.create') {
        const project = await tx.get('project', input.project);
        if (!project || project.organization !== organization) fail(404, 'Resource not found');
        scope = { organization, project: project.id };
        if (input.repository) {
          const repository = await tx.get('repository', input.repository);
          if (!repository || repository.organization !== organization)
            fail(404, 'Resource not found');
          if (repository.project !== project.id) fail(409, 'Invalid Repository ownership');
          scope.repository = repository.id;
        }
      } else {
        workItem = await tx.get('work_item', operation.resource!);
        if (!workItem || workItem.organization !== organization) fail(404, 'Resource not found');
        scope = {
          organization,
          project: String(workItem.project),
          repository: workItem.repository as string | undefined,
        };
      }
      if (operation.action.startsWith('transition.'))
        return transitionOperation(this, tx, caller, operation, input, workItem!, scope, query);
      if (operation.action === 'work-item.migrate')
        return migrateWorkItem(this, tx, caller, operation, input, workItem!, scope);
      if (operation.action.startsWith('review.'))
        return reviewOperation(this, tx, caller, operation, input, workItem!);
      if (operation.action.startsWith('publication.'))
        return publicationOperation(this, tx, caller, operation, input, workItem!);
      if (operation.action.startsWith('sharing.'))
        return sharingOperation(this, tx, caller, operation, input, workItem!);
      await authorized(tx, caller, operation.action, scope);
      if (operation.action === 'work-item.read') return workItem;
      if (operation.action === 'history.read')
        return page(
          await tx.list('fact', 'organization = $organization AND workItem = $workItem', {
            organization,
            workItem: workItem!.id,
          }),
          query,
          true,
        );
      if (!input) fail(404, 'Resource not found');
      if (operation.action === 'correction.append') {
        const original = await tx.get('fact', input.fact);
        if (
          !original ||
          original.organization !== organization ||
          original.workItem !== workItem!.id
        )
          fail(404, 'Resource not found');
      }
      return this.mutate(tx, caller, operation, input, async () => {
        if (operation.action === 'work-item.create') {
          const configured = await selection(tx, organization);
          if (!configured.enabled) fail(409, 'Work Item Type disabled for creation');
          const selected = definition(configured.type, configured.version);
          const workItem = await tx.create('work_item', {
            id: randomUUID(),
            organization,
            project: input.project,
            repository: input.repository,
            title: input.title,
            type: selected.type,
            version: selected.version,
            publicationMode: await initialPublicationMode(
              tx,
              organization,
              input.repository,
              selected.version,
              input.publicationMode,
            ),
            state: 'registered',
            actor: caller.user,
            createdAt: Date.now(),
          });
          const fact = await this.fact(tx, caller, workItem, 'work-item.created', {
            title: input.title,
            type: workItem.type,
            version: selected.version,
            state: 'registered',
            publicationMode: workItem.publicationMode,
          });
          return { workItem, fact };
        }
        if (operation.action === 'correction.append')
          return {
            fact: await this.fact(
              tx,
              caller,
              workItem!,
              'manual.correction',
              { text: input.text },
              input.fact,
            ),
          };
        if (operation.action === 'reference.append')
          return {
            fact: await this.fact(tx, caller, workItem!, 'external.reference', {
              provider: input.provider,
              locator: input.locator,
            }),
          };
        return {
          fact: await this.fact(tx, caller, workItem!, 'manual.note', { text: input.text }),
        };
      });
    });
  }
  async mutate(
    tx: Transaction,
    caller: Caller,
    operation: Operation,
    input: any,
    apply: () => Promise<any>,
  ) {
    const id = digest(
      stable([operation.organization, caller.user, operation.action, input.operationId]),
    );
    const requestDigest = digest(
      stable({
        resource: operation.resource,
        ...(operation.request ? { request: operation.request } : {}),
        input,
      }),
    );
    const receipt = await tx.get('receipt', id);
    if (receipt) {
      if (receipt.digest !== requestDigest) fail(409, 'Operation identifier content mismatch');
      return receipt.result;
    }
    const result = await apply();
    await tx.create('receipt', {
      id,
      organization: operation.organization!,
      user: caller.user,
      operation: operation.action,
      clientId: input.operationId,
      digest: requestDigest,
      result,
    });
    return result;
  }
  async fact(
    tx: Transaction,
    caller: Caller,
    item: Row,
    kind: string,
    payload: Record<string, unknown>,
    correctedFact?: string,
  ) {
    return tx.create('fact', {
      id: randomUUID(),
      organization: item.organization,
      workItem: item.id,
      kind,
      payload,
      actor: caller.user,
      recordedAt: Date.now(),
      correctedFact,
    });
  }
}
