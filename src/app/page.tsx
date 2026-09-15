import { pool, Company } from "@/lib/db";
import { buildWhere, FOLLOWUP_DAYS } from "@/lib/filters";
import {
  setCompanyStatus,
  markOutreached,
  clearOutreach,
  setResponseStatus,
  setOutreachNotes,
  setApolloStatus,
} from "./actions";

const PAGE_SIZE = 50;

const APOLLO_LABELS: Record<string, string> = {
  pending: "Apollo: pending",
  done: "Apollo: done",
};

const APOLLO_STYLES: Record<string, string> = {
  pending: "bg-indigo-100 text-indigo-700",
  done: "bg-emerald-100 text-emerald-700",
};

const RESPONSE_LABELS: Record<string, string> = {
  positive: "Positive",
  negative: "Negative",
};

const RESPONSE_STYLES: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-rose-100 text-rose-700",
};

function daysSince(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

const STATUS_LABELS: Record<string, string> = {
  unclassified: "Unclassified",
  bad_website: "Bad website",
  good_website: "Good website",
  no_website: "No website",
};

const STATUS_STYLES: Record<string, string> = {
  unclassified: "bg-slate-100 text-slate-600",
  bad_website: "bg-rose-100 text-rose-700",
  good_website: "bg-emerald-100 text-emerald-700",
  no_website: "bg-amber-100 text-amber-700",
};

type SearchParams = {
  q?: string;
  status?: string;
  metro?: string;
  vertical?: string;
  followup?: string;
  apollo?: string;
  website?: string;
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
  const followup = sp.followup ?? "";
  const apollo = sp.apollo ?? "";
  const website = sp.website ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const { where, params, nextParam } = buildWhere({ q, status, metro, vertical, followup, apollo, website });
  let p = nextParam;

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
    `select status, count(*) from companies ${where} group by status`,
    params
  );
  const statusCounts: Record<string, number> = {};
  for (const r of statusCountsRes.rows) statusCounts[r.status] = parseInt(r.count, 10);

  const metrosRes = await pool.query(
    `select distinct metro from companies where metro is not null order by metro`
  );
  const verticalsRes = await pool.query(
    `select distinct vertical from companies order by vertical`
  );

  const dueRes = await pool.query(
    `select count(*) from companies where outreached_at is not null and response_status is null and outreached_at <= now() - interval '${FOLLOWUP_DAYS} days'`
  );
  const dueCount = parseInt(dueRes.rows[0].count, 10);

  const qs = (overrides: Partial<SearchParams>) => {
    const merged = { q, status, metro, vertical, followup, apollo, website, page: String(page), ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, String(v));
    }
    return `?${params.toString()}`;
  };

  const exportUrl = (() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, metro, vertical, followup, apollo, website })) {
      if (v) p.set(k, String(v));
    }
    return `/api/export?${p.toString()}`;
  })();

  return (
    <div className="max-w-7xl mx-auto p-6 w-full">
      <h1 className="text-xl font-semibold mb-1 text-slate-800">Company Database</h1>
      <p className="text-sm text-slate-500 mb-4">
        {total} companies matching current filters &middot;{" "}
        {Object.entries(statusCounts)
          .map(([s, c]) => `${STATUS_LABELS[s] ?? s}: ${c}`)
          .join(" · ")}
        {dueCount > 0 && (
          <>
            {" "}
            ·{" "}
            <a href={qs({ followup: "due", page: "1" })} className="text-amber-600 underline font-medium">
              {dueCount} due for follow-up
            </a>
          </>
        )}
      </p>

      <form method="GET" className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name or domain..."
          className="border border-slate-300 rounded px-3 py-1.5 text-sm w-64 bg-white text-slate-800 placeholder:text-slate-400"
        />
        <select
          name="status"
          defaultValue={status}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="metro"
          defaultValue={metro}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800"
        >
          <option value="">All metros</option>
          {metrosRes.rows.map((r) => (
            <option key={r.metro} value={r.metro}>
              {r.metro}
            </option>
          ))}
        </select>
        <select
          name="vertical"
          defaultValue={vertical}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800"
        >
          <option value="">All verticals</option>
          {verticalsRes.rows.map((r) => (
            <option key={r.vertical} value={r.vertical}>
              {r.vertical}
            </option>
          ))}
        </select>
        <select
          name="followup"
          defaultValue={followup}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800"
        >
          <option value="">Any outreach state</option>
          <option value="due">Follow-up due</option>
          <option value="never">Never outreached</option>
        </select>
        <select
          name="apollo"
          defaultValue={apollo}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800"
        >
          <option value="">Any Apollo state</option>
          <option value="pending">Apollo pending</option>
          <option value="done">Apollo done</option>
          <option value="none">Not queued for Apollo</option>
        </select>
        <select
          name="website"
          defaultValue={website}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white text-slate-800"
          title="Based on actual data, not the manual Status classification"
        >
          <option value="">Any website (data)</option>
          <option value="none">No website in data</option>
          <option value="has">Has website in data</option>
        </select>
        <button
          type="submit"
          className="bg-indigo-600 text-white rounded px-3 py-1.5 text-sm hover:bg-indigo-700"
        >
          Filter
        </button>
        {(q || status || metro || vertical || followup || apollo || website) && (
          <a href="/" className="text-sm text-slate-500 underline hover:text-slate-800">
            clear
          </a>
        )}
        <a
          href={exportUrl}
          className="ml-auto border border-slate-300 rounded px-3 py-1.5 text-sm bg-white text-slate-600 hover:bg-slate-100"
        >
          Export CSV
        </a>
      </form>

      <div className="border border-slate-200 rounded overflow-hidden overflow-x-auto bg-white">
        <table className="w-full text-sm text-slate-800">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="p-2">Company</th>
              <th className="p-2">Website</th>
              <th className="p-2">Metro</th>
              <th className="p-2">Reviews</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Contact</th>
              <th className="p-2">Email</th>
              <th className="p-2">Status</th>
              <th className="p-2">Outreach</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 align-top text-slate-800">
                <td className="p-2 max-w-[220px]">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-400">{c.address}</div>
                </td>
                <td className="p-2 max-w-[200px] truncate">
                  {c.website_url ? (
                    <a
                      href={c.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 underline hover:text-indigo-800"
                    >
                      {c.domain || c.website_url}
                    </a>
                  ) : (
                    <span className="text-slate-400">none</span>
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
                  <div className="text-xs text-slate-400">{c.contact_title}</div>
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
                              ? "bg-emerald-100 text-emerald-700"
                              : cand.status.includes("personal")
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {cand.email}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs w-fit ${
                        STATUS_STYLES[c.status] ?? "bg-slate-100 text-slate-600"
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
                            className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-600 disabled:opacity-30 hover:bg-slate-100"
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

                    {c.apollo_status && (
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs w-fit ${
                          APOLLO_STYLES[c.apollo_status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {APOLLO_LABELS[c.apollo_status] ?? c.apollo_status}
                      </span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {c.status === "good_website" && c.apollo_status !== "pending" && (
                        <form
                          action={async () => {
                            "use server";
                            await setApolloStatus(c.id, "pending");
                          }}
                        >
                          <button
                            type="submit"
                            className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
                          >
                            Queue for Apollo
                          </button>
                        </form>
                      )}
                      {c.apollo_status === "pending" && (
                        <form
                          action={async () => {
                            "use server";
                            await setApolloStatus(c.id, "done");
                          }}
                        >
                          <button
                            type="submit"
                            className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
                          >
                            Mark done
                          </button>
                        </form>
                      )}
                      {c.apollo_status && (
                        <form
                          action={async () => {
                            "use server";
                            await setApolloStatus(c.id, null);
                          }}
                        >
                          <button
                            type="submit"
                            className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100"
                          >
                            clear
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-2 min-w-[180px]">
                  <div className="flex flex-col gap-1">
                    {c.outreached_at ? (
                      <span className="text-xs text-slate-600">
                        Outreached {daysSince(c.outreached_at)}d ago
                        {!c.response_status && daysSince(c.outreached_at) >= FOLLOWUP_DAYS && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            follow-up due
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Not yet outreached</span>
                    )}

                    <div className="flex gap-1 flex-wrap">
                      <form
                        action={async () => {
                          "use server";
                          await markOutreached(c.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
                        >
                          {c.outreached_at ? "Re-outreach" : "Mark outreached"}
                        </button>
                      </form>
                      {c.outreached_at && (
                        <form
                          action={async () => {
                            "use server";
                            await clearOutreach(c.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100"
                          >
                            clear
                          </button>
                        </form>
                      )}
                    </div>

                    {c.outreached_at && (
                      <div className="flex gap-1">
                        {(["positive", "negative"] as const).map((s) => (
                          <form
                            key={s}
                            action={async () => {
                              "use server";
                              await setResponseStatus(c.id, c.response_status === s ? null : s);
                            }}
                          >
                            <button
                              type="submit"
                              className={`text-[11px] border border-slate-300 rounded px-1.5 py-0.5 hover:bg-slate-100 ${
                                c.response_status === s
                                  ? RESPONSE_STYLES[s]
                                  : "bg-white text-slate-500"
                              }`}
                            >
                              {RESPONSE_LABELS[s]}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}

                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        await setOutreachNotes(c.id, String(formData.get("notes") ?? ""));
                      }}
                      className="flex gap-1"
                    >
                      <input
                        type="text"
                        name="notes"
                        defaultValue={c.outreach_notes ?? ""}
                        placeholder="comments..."
                        className="border border-slate-300 rounded px-1 py-0.5 text-[11px] w-28 bg-white text-slate-800 placeholder:text-slate-400"
                      />
                      <button
                        type="submit"
                        className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-100"
                      >
                        Save
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <a
              href={qs({ page: String(page - 1) })}
              className="border border-slate-300 rounded px-3 py-1 bg-white hover:bg-slate-100"
            >
              Prev
            </a>
          )}
          {page < totalPages && (
            <a
              href={qs({ page: String(page + 1) })}
              className="border border-slate-300 rounded px-3 py-1 bg-white hover:bg-slate-100"
            >
              Next
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
