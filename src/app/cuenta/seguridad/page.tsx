"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { WHATSAPP_URL } from "@/lib/account";

type Msg = { kind: "ok" | "error"; text: string } | null;

export default function SeguridadPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [outBusy, setOutBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!current) {
      setMsg({ kind: "error", text: "Escribe tu contraseña actual." });
      return;
    }
    if (next.length < 6) {
      setMsg({
        kind: "error",
        text: "La nueva contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }
    if (next !== confirm) {
      setMsg({ kind: "error", text: "Las contraseñas nuevas no coinciden." });
      return;
    }
    if (next === current) {
      setMsg({
        kind: "error",
        text: "La nueva contraseña debe ser distinta a la actual.",
      });
      return;
    }

    setBusy(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = session?.user.email;
    if (!email) {
      setBusy(false);
      setMsg({ kind: "error", text: "Tu sesión expiró. Inicia sesión otra vez." });
      return;
    }

    // Se confirma que quien cambia la contraseña conoce la actual
    const { error: checkErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (checkErr) {
      setBusy(false);
      setMsg({ kind: "error", text: "La contraseña actual no es correcta." });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);

    if (error) {
      setMsg({
        kind: "error",
        text: "No pudimos cambiar la contraseña. Intenta de nuevo.",
      });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMsg({ kind: "ok", text: "Tu contraseña se actualizó." });
  };

  const signOutEverywhere = async () => {
    if (
      !window.confirm(
        "Se cerrará tu sesión en todos tus dispositivos, incluido este. ¿Continuar?"
      )
    )
      return;
    setOutBusy(true);
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">Seguridad</h1>
        <p className="text-sm text-muted mt-1">
          Cambia tu contraseña y controla tus sesiones abiertas.
        </p>
      </div>

      <form onSubmit={changePassword} noValidate className="card p-5 sm:p-7 space-y-5">
        <h2 className="font-bold">Cambiar contraseña</h2>

        {msg && (
          <div
            role={msg.kind === "ok" ? "status" : "alert"}
            className={`flex gap-2 text-sm rounded-xl px-4 py-3 border ${
              msg.kind === "ok"
                ? "text-ok bg-green-50 border-green-200"
                : "text-danger bg-red-50 border-red-200"
            }`}
          >
            {msg.kind === "ok" ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
            )}
            <p>{msg.text}</p>
          </div>
        )}

        <div>
          <label htmlFor="current" className="text-sm font-medium mb-1.5 block">
            Contraseña actual
          </label>
          <input
            id="current"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="next" className="text-sm font-medium mb-1.5 block">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="next"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="field pr-12"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-neutral-500 hover:text-ink hover:bg-brand-soft transition"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-xs text-muted mt-1.5">Mínimo 6 caracteres.</p>
        </div>

        <div>
          <label htmlFor="confirm" className="text-sm font-medium mb-1.5 block">
            Confirmar nueva contraseña
          </label>
          <input
            id="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field"
          />
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Guardando…
            </>
          ) : (
            "Actualizar contraseña"
          )}
        </button>
      </form>

      <section className="card p-5 sm:p-7 space-y-4">
        <div>
          <h2 className="font-bold">Sesiones</h2>
          <p className="text-sm text-muted mt-1">
            Si usaste tu cuenta en una computadora que no es tuya, puedes cerrar
            sesión en todos los dispositivos.
          </p>
        </div>
        <button
          onClick={signOutEverywhere}
          disabled={outBusy}
          className="btn-outline w-full sm:w-auto"
        >
          {outBusy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <LogOut size={17} />
          )}
          Cerrar sesión en todos lados
        </button>
      </section>

      <section className="card p-5 sm:p-7 space-y-3">
        <h2 className="font-bold">Eliminar mi cuenta</h2>
        <p className="text-sm text-muted">
          Si quieres que borremos tu cuenta y tus datos, escríbenos y lo
          hacemos por ti.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline w-full sm:w-auto"
        >
          <MessageCircle size={17} /> Escribir por WhatsApp
        </a>
      </section>
    </div>
  );
}
