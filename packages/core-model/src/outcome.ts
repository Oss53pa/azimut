export type Finding = {
  code: string;
  severity: 'blocking' | 'warning' | 'info';
  entity: { kind: string; id: string } | null;
  params: Record<string, string | number>;
  ruleRef: string | null;
};

export type Outcome<T> =
  | { ok: true; value: T; warnings: Finding[] }
  | { ok: false; findings: Finding[] };
