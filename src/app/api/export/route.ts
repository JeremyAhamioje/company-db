import { NextRequest } from "next/server";
import { pool, Company } from "@/lib/db";
import { buildWhere } from "@/lib/filters";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const COLUMNS: (keyof Company)[] = [
  "name",
  "website_url",
  "domain",
  "metro",
  "vertical",
  "address",
  "phone",
  "review_count",
  "rating",
  "contact_name",
  "contact_title",
  "email",
  "status",
  "is_bad_lead",
  "apollo_status",
  "outreached_at",
  "response_status",
  "outreach_notes",
  "google_maps_url",
  "google_place_id",
];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { where, params } = buildWhere({
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    metro: sp.get("metro") ?? undefined,
    vertical: sp.get("vertical") ?? undefined,
    followup: sp.get("followup") ?? undefined,
    apollo: sp.get("apollo") ?? undefined,
    website: sp.get("website") ?? undefined,
    bad_lead: sp.get("bad_lead") ?? undefined,
  });

  const res = await pool.query<Company>(
    `select * from companies ${where} order by review_count desc nulls last, name asc`,
    params
  );

  const lines = [COLUMNS.join(",")];
  for (const row of res.rows) {
    lines.push(COLUMNS.map((c) => csvEscape(row[c])).join(","));
  }
  const csv = lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="companies_export.csv"`,
    },
  });
}
