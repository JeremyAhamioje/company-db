import { pool, Company } from "@/lib/db";
import { setCompanyStatus } from "./actions";

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  unclassified: "Unclassified",
  bad_website: "Bad website",
  good_website: "Good website",
  no_website: "No website",
};

const STATUS_STYLES: Record<string, string> = {
  unclassified: "bg-gray-100 text-gray-700",
  bad_website: "bg-red-100 text-red-700",
  good_website: "bg-green-100 text-green-700",
  no_website: "bg-yellow-100 text-yellow-700",
};

type SearchParams = {
  q?: string;
  status?: string;
  metro?: string;
  vertical?: string;
  page?: string;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "";
  const metro = sp.metro ?? "";
  const vertical = sp.vertical ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (q) {
    conditions.push(`(name ilike $${p} or domain ilike $${p})`);
    params.push(`%${q}%`);
    p++;
  }
  if (status) {
    conditions.push(`status = $${p}`);
    params.push(status);
    p++;
  }
  if (metro) {
    conditions.push(`metro = $${p}`);
    params.push(metro);
    p++;
  }
  if (vertical) {
    conditions.push(`vertical = $${p}`);
    params.push(vertical);
    p++;
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const countRes = await pool.query(`select count(*) from companies ${where}`, params);
  const total = parseInt(countRes.rows[0].count, 10);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;

  const rowsRes = await pool.query<Company>(
    `select * from companies ${where} order by review_count desc nulls last, name asc limit $${p} offset $${p + 1}`,
    [...params, PAGE_SIZE, offset]
  );
  const rows = rowsRes.rows;

  const statusCountsRes = await pool.query(
    `select status, count(*) from companies ${where} group by status`
  );
  const statusCounts: Record<string, number> = {};
  for (const r of statusCountsRes.rows) statusCounts[r.status] = parseInt(r.count, 10);

  const metrosRes = await pool.query(
    `select distinct metro from companies where metro is not null order by metro`
  );
  const verticalsRes = await pool.query(
    `select distinct vertical from companies order by vertical`
  );

  const qs = (overrides: Partial<SearchParams>) => {
    const merged = { q, status, metro, vertical, page: String(page), ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, String(v));
    }
    return `?${params.toString()}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 w-full">
      <h1 className="text-xl font-semibold mb-1">Company Database</h1>
      <p className="text-sm text-gray-500 mb-4">
        {total} companies matching current filters &middot;{" "}
        {Object.entries(statusCounts)
          .map(([s, c]) => `${STATUS_LABELS[s] ?? s}: ${c}`)
          .join(" · ")}
      </p>

      <form method="GET" className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name or domain..."
          className="border rounded px-3 py-1.5 text-sm w-64"
        />
        <select name="status" defaultValue={status} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <select name="metro" defaultValue={metro} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All metros</option>
          {metrosRes.rows.map((r) => (
            <option key={r.metro} value={r.metro}>
              {r.metro}
            </option>
          ))}
        </select>
        <select name="vertical" defaultValue={vertical} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All verticals</option>
          {verticalsRes.rows.map((r) => (
            <option key={r.vertical} value={r.vertical}>
              {r.vertical}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-black text-white rounded px-3 py-1.5 text-sm">
          Filter
        </button>
        {(q || status || metro || vertical) && (
          <a href="/" className="text-sm text-gray-500 underline">
            clear
          </a>
        )}
      </form>

      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Company</th>
              <th className="p-2">Website</th>
              <th className="p-2">Metro</th>
              <th className="p-2">Reviews</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Contact</th>
              <th className="p-2">Email</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50 align-top">
                <td className="p-2 max-w-[220px]">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.address}</div>
                </td>
                <td className="p-2 max-w-[200px] truncate">
                  {c.website_url ? (
                    <a
                      href={c.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      {c.domain || c.website_url}
                    </a>
                  ) : (
                    <span className="text-gray-400">none</span>
                  )}
                </td>
                <td className="p-2">{c.metro}</td>
                <td className="p-2">
                  {c.review_count ?? "—"}
                  {c.rating ? ` (${c.rating}★)` : ""}
                </td>
                <td className="p-2">{c.phone}</td>
                <td className="p-2 max-w-[160px]">
                  <div className="font-medium">{c.contact_name}</div>
                  <div className="text-xs text-gray-400">{c.contact_title}</div>
                </td>
                <td className="p-2 max-w-[220px]">
                  {c.email_candidates && c.email_candidates.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {c.email_candidates.map((cand, i) => (
                        <span
                          key={i}
                          title={`${cand.source} · ${cand.status} · ${cand.note}`}
                          className={`text-xs px-1.5 py-0.5 rounded w-fit ${
                            cand.status === "confirmed_deliverable"
                              ? "bg-green-100 text-green-700"
                              : cand.status.includes("personal")
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {cand.email}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs w-fit ${
                        STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                    <div className="flex gap-1">
                      {Object.keys(STATUS_LABELS).map((s) => (
                        <form
                          key={s}
                          action={async () => {
                            "use server";
                            await setCompanyStatus(c.id, s);
                          }}
                        >
                          <button
                            type="submit"
                            disabled={c.status === s}
                            className="text-[11px] border rounded px-1.5 py-0.5 disabled:opacity-30 hover:bg-gray-100"
                            title={STATUS_LABELS[s]}
                          >
                            {s === "bad_website"
                              ? "Bad"
                              : s === "good_website"
                              ? "Good"
                              : s === "no_website"
                              ? "No site"
                              : "Reset"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <a href={qs({ page: String(page - 1) })} className="border rounded px-3 py-1">
              Prev
            </a>
          )}
          {page < totalPages && (
            <a href={qs({ page: String(page + 1) })} className="border rounded px-3 py-1">
              Next
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
