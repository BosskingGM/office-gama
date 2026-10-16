"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notifyAccountUpdated } from "@/lib/account";

type Msg = { kind: "ok" | "error"; text: string } | null;

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  const ok = msg.kind === "ok";
  return (
    <div
      role={ok ? "status" : "alert"}
      className={`flex gap-2 text-sm rounded-xl px-4 py-3 border ${
        ok
          ? "text-ok bg-green-50 border-green-200"
          : "text-danger bg-red-50 border-red-200"
      }`}
    >
      {ok ? (
        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={18} className="shrink-0 mt-0.5" />
      )}
      <p>{msg.text}</p>
    </div>
  );
}

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [since, setSince] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? "");
      if (user.created_at) {
        setSince(
          new Date(user.created_at).toLocaleDateString("es-MX", {
            month: "long",
            year: "numeric",
          })
        );
      }
      const { data: d } = await supabase
        .from("customer_details")
        .select("full_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      setFullName(d?.full_name ?? "");
      setPhone(d?.phone ?? "");
      setLoading(false);
    };
    load();
  }, []);

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const name = fullName.trim();
    const digits = phone.replace(/\D/g, "");
    if (!name) {
      setMsg({ kind: "error", text: "Escribe tu nombre completo." });
      return;
    }
    if (phone.trim() && digits.length < 10) {
      setMsg({ kind: "error", text: "El teléfono debe tener 10 dígitos." });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("customer_details").upsert(
      {
        user_id: userId,
        full_name: name,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSaving(false);

    if (error) {
      setMsg({
        kind: "error",
        text: /relation .* does not exist|schema cache/i.test(error.message)
          ? "Falta crear las tablas de la cuenta en Supabase (supabase/account.sql)."
          : "No pudimos guardar tus datos. Intenta de nuevo.",
      });
      return;
    }
    setMsg({ kind: "ok", text: "Tus datos se guardaron." });
    notifyAccountUpdated();
  };

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    const next = newEmail.trim();

    if (!/^\S+@\S+\.\S+$/.test(next)) {
      setEmailMsg({ kind: "error", text: "Escribe un correo válido." });
      return;
    }
    if (next.toLowerCase() === email.toLowerCase()) {
      setEmailMsg({ kind: "error", text: "Ese ya es tu correo actual." });
      return;
    }

    setEmailBusy(true);
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/cuenta/perfil` }
    );
    setEmailBusy(false);

    if (error) {
      setEmailMsg({
        kind: "error",
        text: /already|registered|exists/i.test(error.message)
          ? "Ese correo ya está en uso."
          : /rate limit|seconds/i.test(error.message)
          ? "Espera un momento antes de intentarlo otra vez."
          : "No pudimos cambiar el correo. Intenta de nuevo.",
      });
      return;
    }
    setNewEmail("");
    setEmailMsg({
      kind: "ok",
      text: `Te enviamos un correo de confirmación. Tu correo cambia hasta que confirmes el enlace. Revisa también tu correo actual (${email}), puede pedirte confirmar ahí.`,
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-44" />
        <div className="skeleton h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Mis datos</h1>
        <p className="text-sm text-muted mt-1">
          Los usamos para llenar tus compras automáticamente.
        </p>
      </div>

      <form onSubmit={saveDetails} noValidate className="card p-5 sm:p-7 space-y-5">
        <h2 className="font-bold">Datos personales</h2>
        <Banner msg={msg} />

        <div>
          <label htmlFor="full_name" className="text-sm font-medium mb-1.5 block">
            Nombre completo
          </label>
          <input
            id="full_name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="phone" className="text-sm font-medium mb-1.5 block">
            Teléfono
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="10 dígitos"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            className="field"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </button>
      </form>

      <form onSubmit={changeEmail} noValidate className="card p-5 sm:p-7 space-y-5">
        <div>
          <h2 className="font-bold">Correo electrónico</h2>
          <p className="text-sm text-muted mt-1 flex items-center gap-2 break-all">
            <Mail size={15} className="shrink-0" /> {email}
          </p>
          {since && (
            <p className="text-xs text-muted mt-1">Cliente desde {since}</p>
          )}
        </div>

        <Banner msg={emailMsg} />

        <div>
          <label htmlFor="new_email" className="text-sm font-medium mb-1.5 block">
            Nuevo correo
          </label>
          <input
            id="new_email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="field"
          />
        </div>

        <button type="submit" disabled={emailBusy} className="btn-outline w-full sm:w-auto">
          {emailBusy ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Enviando…
            </>
          ) : (
            "Cambiar correo"
          )}
        </button>
      </form>
    </div>
  );
}
