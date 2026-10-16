// Ayudas compartidas de la cuenta del cliente.
import { supabase } from "@/lib/supabase";

export const ACCOUNT_EVENT = "account:updated";

export function notifyAccountUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACCOUNT_EVENT));
  }
}

export async function fetchFullName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("customer_details")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.full_name ?? "";
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export const initialOf = (name: string, email?: string | null) =>
  (name.trim()[0] || email?.[0] || "?").toUpperCase();

export { STORE_WHATSAPP_URL as WHATSAPP_URL } from "@/lib/store";
