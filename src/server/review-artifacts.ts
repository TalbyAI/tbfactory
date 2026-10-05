import { mkdir, readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { z } from 'zod';
import { atomicWrite } from './durable-files';
import { authorized, currentCaller } from './authorization';
import { digest, fail, identifier } from './contracts';
import { scopeOf } from './reviews';
import { type Store } from './store';
import { type Caller } from './auth';

export const reportSchema = z.strictObject({
  summary: z.string().trim().min(1).max(10000),
  findings: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(300),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        explanation: z.string().trim().min(1).max(10000),
        location: z
          .strictObject({ path: z.string().min(1).max(1000), line: z.number().int().positive() })
          .optional(),
        previousFinding: identifier.optional(),
        assessment: z.enum(['still-applicable', 'enriched', 'obsolete', 'resolved']).optional(),
      }),
    )
    .max(100),
});
export type ReviewReport = z.infer<typeof reportSchema>;
const literal = (s: string) => s.replace(/[\\`*_{}\[\]<>#]/g, '\\$&');
export function reportMarkdown(report: ReviewReport) {
  return `# Private Review Report\n\n${literal(report.summary)}\n\n${report.findings.map((f, i) => `## ${i + 1}. ${literal(f.title)} (${f.severity})\n\n${literal(f.explanation)}\n${f.location ? `\nLocation: ${literal(f.location.path)}:${f.location.line}\n` : ''}${f.previousFinding ? `\nPrevious Finding: ${f.previousFinding}; assessment: ${f.assessment}\n` : ''}`).join('\n')}`;
}
export class ReviewArtifacts {
  readonly directory: string;
  constructor(directory: string) {
    this.directory = resolve(directory);
  }
  private path(key: string) {
    if (!/^[a-f0-9]{64}$/.test(key)) fail(500, 'Invalid Artifact metadata');
    return join(this.directory, key);
  }
  async write(key: string, content: string) {
    await mkdir(this.directory, { recursive: true });
    const path = this.path(key);
    try {
      if (!(await lstat(path)).isFile()) fail(503, 'Artifact content is not a regular file');
      const existing = await readFile(path, 'utf8');
      if (existing === content)
        return {
          storageKey: key,
          digest: digest(content),
          size: Buffer.byteLength(content),
          mediaType: 'text/markdown; charset=utf-8',
        };
      fail(503, 'Artifact content conflicts with retained output');
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
    await atomicWrite(path, content);
    return {
      storageKey: key,
      digest: digest(content),
      size: Buffer.byteLength(content),
      mediaType: 'text/markdown; charset=utf-8',
    };
  }
  async read(
    store: Store,
    caller: Caller,
    organization: string,
    workItem: string,
    reportId: string,
  ) {
    const report = await store.transaction(async (tx) => {
      await currentCaller(tx, caller);
      const item = await tx.get('work_item', identifier.parse(workItem));
      if (!item || item.organization !== organization) fail(404, 'Resource not found');
      await authorized(tx, caller, 'work-item.read', scopeOf(item));
      await authorized(tx, caller, 'artifact.read', scopeOf(item));
      const report = await tx.get('review_report', identifier.parse(reportId));
      if (!report || report.organization !== organization || report.workItem !== item.id)
        fail(404, 'Resource not found');
      return report.data as any;
    });
    return this.verify(report);
  }
  async verify(report: Record<string, any>) {
    try {
      const path = this.path(report.storageKey);
      if (!(await lstat(path)).isFile()) fail(503, 'Artifact content unavailable');
      const data = await readFile(path);
      if (data.length !== report.size || digest(data.toString('utf8')) !== report.digest)
        fail(503, 'Artifact content integrity failure');
      return data;
    } catch (e: any) {
      if (e.code === 'ENOENT') fail(503, 'Artifact content unavailable');
      throw e;
    }
  }
}
