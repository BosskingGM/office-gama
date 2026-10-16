"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const clean = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError("Escribe un correo válido.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      clean,
      { redirectTo: `${window.location.origin}/restablecer` }
    );
    setLoading(false);

    // Solo mostramos error si falla el envío en sí (límite de intentos, red).
    // Si el correo no existe respondemos igual, para no revelar quién tiene cuenta.
    if (resetError && /rate limit|too many|seconds/i.test(resetError.message)) {
      setError("Espera un momento antes de pedir otro correo e inténtalo de nuevo.");
      return;
    }
    if (resetError && resetError.status && resetError.status >= 500) {
      setError("No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="card p-6 sm:p-10 w-full max-w-md space-y-6 animate-fade-up">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-brand-soft grid place-items-center text-brand-strong">
              <MailCheck size={28} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">Revisa tu correo</h1>
            <p className="text-muted text-sm leading-relaxed">
              Si <strong className="text-ink">{email.trim()}</strong> tiene una
              cuenta, te enviamos un enlace para crear una nueva contraseña.
              Si no lo ves, revisa la carpeta de spam.
            </p>
            <Link href="/login" className="btn-outline w-full">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                Recuperar contraseña
              </h1>
              <p className="text-muted text-sm">
                Escribe tu correo y te mandamos un enlace para crear una nueva.
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
              <label htmlFor="email" className="text-sm font-medium mb-1.5 block">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base py-3.5"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Enviando…
                </>
              ) : (
                "Enviar enlace"
              )}
            </button>

            <p className="text-center text-sm">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-brand-strong font-semibold hover:underline"
              >
                <ArrowLeft size={15} /> Volver a iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
