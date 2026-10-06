import { fail } from './contracts';

const literal = (s: string) => s.replace(/[\\`*_{}\[\]<>#]/g, '\\$&');
export function confirmedContent(report: any, decision: any) {
  const choices = decision.payload.findings;
  const ids = new Set(choices.map((f: any) => f.finding));
  if (
    !decision.payload.reviewed ||
    ids.size !== choices.length ||
    ids.size !== report.findings.length ||
    report.findings.some((f: any) => !ids.has(f.id))
  )
    fail(409, 'Complete Review Decision required');
  const confirmed = new Set(
    choices.filter((f: any) => f.decision === 'confirmed').map((f: any) => f.finding),
  );
  const findings = report.findings.filter((f: any) => confirmed.has(f.id));
  return findings.length
    ? `# Confirmed Findings\n\n${findings.map((f: any) => `## ${literal(f.title)} (${f.severity})\n\n${literal(f.explanation)}${f.location ? `\n\nLocation: ${literal(f.location.path)}:${f.location.line}` : ''}`).join('\n\n')}`
    : '';
}
