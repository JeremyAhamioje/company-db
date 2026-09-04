export const FOLLOWUP_DAYS = 14;

export type Filters = {
  q?: string;
  status?: string;
  metro?: string;
  vertical?: string;
  followup?: string;
  apollo?: string;
};

export function buildWhere(f: Filters): { where: string; params: unknown[]; nextParam: number } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  const q = (f.q ?? "").trim();
  if (q) {
    conditions.push(`(name ilike $${p} or domain ilike $${p})`);
    params.push(`%${q}%`);
    p++;
  }
  if (f.status) {
    conditions.push(`status = $${p}`);
    params.push(f.status);
    p++;
  }
  if (f.metro) {
    conditions.push(`metro = $${p}`);
    params.push(f.metro);
    p++;
  }
  if (f.vertical) {
    conditions.push(`vertical = $${p}`);
    params.push(f.vertical);
    p++;
  }
  if (f.followup === "due") {
    conditions.push(
      `outreached_at is not null and response_status is null and outreached_at <= now() - interval '${FOLLOWUP_DAYS} days'`
    );
  } else if (f.followup === "never") {
    conditions.push(`outreached_at is null`);
  }
  if (f.apollo === "pending") {
    conditions.push(`apollo_status = 'pending'`);
  } else if (f.apollo === "done") {
    conditions.push(`apollo_status = 'done'`);
  } else if (f.apollo === "none") {
    conditions.push(`apollo_status is null`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  return { where, params, nextParam: p };
}
