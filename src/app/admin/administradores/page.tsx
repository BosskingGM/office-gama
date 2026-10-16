"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Admin = {
  id: string;
  email: string;
  created_at: string | null;
  last_sign_in_at: string | null;
};

async function api(method: "GET" | "POST" | "DELETE", body?: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch("/api/admin/admins", {
    method,
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "No se pudo completar la acción.");
  return json as { admins: Admin[]; me?: string };
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function AdministradoresPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api("GET");
      setAdmins(r.admins);
      setMe(r.me ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");
    setBusy(true);
    try {
      const r = await api("POST", { email });
      setAdmins(r.admins);
      setOk(`${email.trim().toLowerCase()} ya es administrador.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Admin) => {
    if (!window.confirm(`¿Quitar el acceso de administrador a ${a.email}?`)) return;
    setError("");
    setOk("");
    try {
      const r = await api("DELETE", { id: a.id });
      setAdmins(r.admins);
      setOk(`${a.email} ya no es administrador.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Administradores</h1>
        <p className="text-sm text-muted mt-1">
          Las personas aquí pueden ver pedidos, inventario, promociones y
          cupones. Solo da acceso a gente de tu confianza.
        </p>
      </div>

      <form onSubmit={add} className="card p-4 sm:p-5 space-y-3">
        <label htmlFor="adm-email" className="text-sm font-medium block">
          Correo de la nueva persona
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="adm-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            autoCapitalize="none"
            autoCorrect="off"
            className="field flex-1"
          />
          <button type="submit" disabled={busy || !email.trim()} className="btn-primary shrink-0">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            Dar acceso
          </button>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Esa persona debe haberse registrado antes en la tienda con ese correo
          (y confirmado su correo). Después de agregarla, debe volver a entrar
          o recargar la página para ver el panel.
        </p>
      </form>

      {error && (
        <div role="alert" className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      {ok && (
        <div role="status" className="text-sm bg-green-50 border border-green-200 text-green-900 rounded-xl px-4 py-3">
          {ok}
        </div>
      )}

      {loading ? (
        <div className="py-12 grid place-items-center text-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <ul className="space-y-2">
          {admins.map((a) => (
            <li key={a.id} className="card p-3.5 flex items-center gap-3">
              <span className="w-10 h-10 grid place-items-center rounded-full bg-brand-soft shrink-0">
                <ShieldCheck size={18} className="text-brand-strong" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">
                  {a.email}
                  {a.id === me && (
                    <span className="ml-2 text-[11px] font-semibold bg-peach-soft px-2 py-0.5 rounded-full">
                      Tú
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  Última vez: {fmt(a.last_sign_in_at)}
                </p>
              </div>
              {a.id !== me && (
                <button
                  onClick={() => remove(a)}
                  aria-label={`Quitar acceso a ${a.email}`}
                  className="btn-outline p-0! w-10 h-10 text-danger shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
