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
