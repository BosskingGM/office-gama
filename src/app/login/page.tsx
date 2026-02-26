"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"error" | "success" | "">("");
  const router = useRouter();

  const showMessage = (msg: string, msgType: "error" | "success") => {
    setMessage(msg);
    setType(msgType);

    setTimeout(() => {
      setMessage("");
      setType("");
    }, 3000);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showMessage("Completa todos los campos", "error");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showMessage("Correo o contraseña incorrectos", "error");
    } else {
      showMessage("Bienvenido de nuevo", "success");

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1000);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#faf9ff] px-6 relative">

      {/* TOAST PREMIUM */}
      {message && (
        <div
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-[999] px-6 py-4 rounded-2xl shadow-lg text-sm font-medium transition-all duration-300 ${
            type === "error"
              ? "bg-neutral-900 text-white"
              : "bg-[#d6a8ff] text-black"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white border border-neutral-200 p-10 rounded-3xl w-full max-w-md space-y-8">

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-neutral-900">
            Iniciar sesión
          </h1>
          <p className="text-neutral-500 text-sm">
            Accede a tu cuenta para ver tus pedidos
          </p>
        </div>

        {/* EMAIL */}
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-neutral-300 px-5 py-3 rounded-2xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#d6a8ff] transition"
        />

        {/* PASSWORD */}
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-neutral-300 px-5 py-3 rounded-2xl text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#d6a8ff] transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 transition"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* BOTÓN */}
        <button
          onClick={handleLogin}
          className="w-full bg-[#d6a8ff] text-black py-4 rounded-2xl font-semibold hover:opacity-90 transition"
        >
          Entrar
        </button>

        {/* REGISTRO */}
        <div className="text-center pt-2">
          <p className="text-neutral-500 text-sm">
            ¿No tienes cuenta?
          </p>

          <button
            onClick={() => router.push("/registro")}
            className="mt-3 w-full border border-neutral-300 py-3 rounded-2xl text-neutral-700 hover:bg-neutral-100 transition"
          >
            Crear cuenta
          </button>
        </div>

      </div>
    </main>
  );
}