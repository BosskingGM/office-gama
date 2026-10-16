"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Solo se acepta una ruta interna (evita redirigir a otro sitio por ?next=)
function safeNext(): string {
  try {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  } catch {
    /* sin parámetros */
  }
  return "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión, no tiene caso mostrar el formulario
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeNext());
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setLoading(false);
      setError(
        /email not confirmed/i.test(authError.message)
          ? "Debes confirmar tu correo. Revisa tu bandeja de entrada y la carpeta de spam."
          : "Correo o contraseña incorrectos."
      );
      return;
    }

    router.push(safeNext());
    router.refresh();
  };

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <form
        onSubmit={handleLogin}
        noValidate
        className="card p-8 sm:p-10 w-full max-w-md space-y-6 animate-fade-up"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold">Iniciar sesión</h1>
          <p className="text-muted text-sm">
            Entra para pagar y ver tus pedidos.
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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <Link
              href="/recuperar"
              className="text-sm text-brand-strong font-medium hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-neutral-500 hover:text-ink hover:bg-brand-soft transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full text-base py-3.5"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Entrando…
            </>
          ) : (
            "Entrar"
          )}
        </button>

        <p className="text-center text-sm text-muted">
          ¿No tienes cuenta?{" "}
          <Link
            href="/registro"
            className="text-brand-strong font-semibold hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </form>
    </div>
  );
}
