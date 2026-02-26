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
      showMessage("Correo o contraseña incorrectos ❌", "error");
    } else {
      showMessage("¡Bienvenido de nuevo! 🎉", "success");

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-white px-4 sm:px-6 relative">

      {/* Toast visible debajo del navbar */}
      {message && (
        <div
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all duration-500 animate-bounce ${
            type === "error"
              ? "bg-red-500"
              : "bg-green-500"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl w-full max-w-md transition-all duration-300">
        <h1 className="text-xl sm:text-2xl font-bold text-pink-400 mb-6 text-center">
          Iniciar Sesión
        </h1>

        {/* Email */}
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 p-3 mb-4 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
        />

        {/* Password con ojito */}
        <div className="relative mb-6">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-pink-400 transition"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-pink-400 text-white py-3 rounded-full hover:bg-pink-500 transition transform hover:scale-105"
        >
          Entrar
        </button>

        {/* Crear cuenta */}
        <p className="text-center text-sm text-gray-500 mt-6">
          ¿No tienes cuenta?
        </p>

        <button
          onClick={() => router.push("/registro")}
          className="w-full mt-2 border border-pink-400 text-pink-400 py-2 rounded-full hover:bg-pink-50 transition"
        >
          Crear una cuenta
        </button>
      </div>
    </main>
  );
}