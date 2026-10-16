"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LinkIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Status = "checking" | "ready" | "invalid" | "done";

export default function RestablecerPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // El enlace del correo trae una sesión temporal de recuperación.
  // Supabase la lee sola de la URL; aquí solo esperamos a que esté lista.
  useEffect(() => {
    const hash = window.location.hash;
    if (/error(_code)?=/.test(hash)) {
      setStatus("invalid");
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setStatus("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("ready");
    });

    // Si en unos segundos no hay sesión, el enlace no sirve (vencido o ya usado)
    const t = setTimeout(
      () => setStatus((s) => (s === "checking" ? "invalid" : s)),
      4000
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(
        /same|different/i.test(updateError.message)
          ? "La nueva contraseña debe ser distinta a la anterior."
          : "No pudimos cambiar la contraseña. Pide un nuevo enlace e inténtalo otra vez."
      );
      return;
    }

    setStatus("done");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1800);
  };

  const passwordsMatch = confirm.length > 0 && password === confirm;

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="card p-6 sm:p-10 w-full max-w-md space-y-6 animate-fade-up">
        {status === "checking" && (
          <div className="text-center py-6 space-y-3 text-muted">
            <Loader2 size={28} className="animate-spin mx-auto text-brand-strong" />
            <p className="text-sm">Verificando tu enlace…</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-50 grid place-items-center text-danger">
              <LinkIcon size={26} />
            </div>
            <h1 className="text-2xl font-extrabold">Enlace no válido</h1>
            <p className="text-muted text-sm leading-relaxed">
              Este enlace ya se usó o venció. Pide uno nuevo para cambiar tu
              contraseña.
            </p>
            <Link href="/recuperar" className="btn-primary w-full">
              Pedir un nuevo enlace
            </Link>
          </div>
        )}

        {status === "done" && (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-50 grid place-items-center text-ok">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="text-2xl font-extrabold">¡Contraseña actualizada!</h1>
            <p className="text-muted text-sm">Te llevamos a la tienda…</p>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                Nueva contraseña
              </h1>
              <p className="text-muted text-sm">
                Elige una contraseña de al menos 6 caracteres.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="text-sm font-medium mb-1.5 block">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-neutral-500 hover:text-ink hover:bg-brand-soft transition"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="text-sm font-medium mb-1.5 block">
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field"
              />
              {confirm.length > 0 && (
                <p
                  className={`text-xs mt-1.5 ${
                    passwordsMatch ? "text-ok" : "text-danger"
                  }`}
                >
                  {passwordsMatch
                    ? "Las contraseñas coinciden"
                    : "Las contraseñas no coinciden"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base py-3.5"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar contraseña"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
