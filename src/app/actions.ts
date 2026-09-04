"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";

export async function setCompanyStatus(id: string, status: string) {
  await pool.query(`update companies set status = $1 where id = $2`, [status, id]);
  revalidatePath("/");
}

export async function setCompanyNotes(id: string, notes: string) {
  await pool.query(`update companies set notes = $1 where id = $2`, [notes, id]);
  revalidatePath("/");
}

export async function markOutreached(id: string) {
  await pool.query(
    `update companies set outreached_at = now(), response_status = null where id = $1`,
    [id]
  );
  revalidatePath("/");
}

export async function clearOutreach(id: string) {
  await pool.query(
    `update companies set outreached_at = null, response_status = null where id = $1`,
    [id]
  );
  revalidatePath("/");
}

export async function setResponseStatus(id: string, status: string | null) {
  await pool.query(`update companies set response_status = $1 where id = $2`, [status, id]);
  revalidatePath("/");
}

export async function setOutreachNotes(id: string, notes: string) {
  await pool.query(`update companies set outreach_notes = $1 where id = $2`, [notes, id]);
  revalidatePath("/");
}

export async function setApolloStatus(id: string, status: string | null) {
  await pool.query(`update companies set apollo_status = $1 where id = $2`, [status, id]);
  revalidatePath("/");
}
