"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      showMessage(error.message, "error");
    } else {
      showMessage("Sesión iniciada correctamente ✨", "success");

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1000);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 relative">
      
      {/* Toast elegante */}
      {message && (
        <div
          className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300 ${
            type === "error"
              ? "bg-red-500"
              : "bg-pink-500"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow w-full max-w-md">
        <h1 className="text-xl sm:text-2xl font-bold text-pink-400 mb-5 sm:mb-6 text-center">
          Iniciar Sesión
        </h1>

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 p-2 sm:p-3 mb-4 rounded text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 p-2 sm:p-3 mb-6 rounded text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400"
        />

        <button
          onClick={handleLogin}
          className="w-full bg-pink-400 text-white py-2 sm:py-3 rounded-full hover:bg-pink-500 transition"
        >
          Entrar
        </button>
      </div>
    </main>
  );
}