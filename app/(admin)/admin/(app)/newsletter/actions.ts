"use server";

import { refresh } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { cleanEmail, deleteContact, recordOptIn, setContactStatus, syncPending } from "@/lib/marketing/contacts";
import { mailchimpConnected } from "@/lib/marketing/mailchimp";

type Result = { ok: true; message?: string } | { error: string };
const UUID = /^[0-9a-f-]{36}$/i;

/** Someone who asked the team in person or by email to receive the newsletter (their consent is the team's to confirm). */
export async function addContact(formData: FormData): Promise<Result> {
  await requireArea("/admin/newsletter");
  const email = cleanEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };
  if (formData.get("consent") !== "on") return { error: "Tick that they asked to receive the newsletter." };
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length > 120) return { error: "The name can be at most 120 characters." };
  await recordOptIn({ email, name: name || null, source: "manual" });
  refresh();
  return { ok: true };
}

/** Unsubscribe (they asked to stop), suppress (they asked to be removed: never added again), or subscribe again. */
export async function changeContact(formData: FormData): Promise<Result> {
  await requireArea("/admin/newsletter");
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!UUID.test(id)) return { error: "This contact could not be found." };
  if (to === "delete") {
    const result = await deleteContact(id);
    if ("ok" in result) refresh();
    return result;
  }
  if (to !== "subscribed" && to !== "unsubscribed" && to !== "suppressed") return { error: "Unknown change." };
  const row = await setContactStatus(id, to);
  if (!row) return { error: "This contact could not be found." };
  refresh();
  return { ok: true };
}

/** Sends every change Mailchimp has not had yet. */
export async function syncNow(): Promise<Result> {
  await requireArea("/admin/newsletter");
  if (!mailchimpConnected()) return { error: "Mailchimp is not connected yet." };
  const { synced, failed } = await syncPending();
  refresh();
  return failed > 0 ? { error: `${synced} sent to Mailchimp, ${failed} failed. The reason is shown on each contact.` } : { ok: true, message: `${synced} sent to Mailchimp.` };
}
