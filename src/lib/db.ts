import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export const pool =
  global._pgPool ??
  new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

export type Company = {
  id: string;
  name: string;
  website_url: string | null;
  domain: string | null;
  vertical: string;
  metro: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  review_count: number | null;
  rating: string | null;
  source: string;
  status: string;
  notes: string | null;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  email_candidates: EmailCandidate[] | null;
  outreached_at: string | null;
  response_status: string | null;
  outreach_notes: string | null;
  apollo_status: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailCandidate = {
  email: string;
  source: string;
  status: string;
  note: string;
};
