"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password) {
      alert("Completa todos los campos");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Cuenta creada correctamente");
      router.push("/");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow w-full max-w-md">
        <h1 className="text-xl sm:text-2xl font-bold text-pink-400 mb-5 sm:mb-6 text-center">
          Crear Cuenta
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
          onClick={handleRegister}
          className="w-full bg-pink-400 text-white py-2 sm:py-3 rounded-full hover:bg-pink-500 transition"
        >
          Registrarse
        </button>
      </div>
    </main>
  );
}