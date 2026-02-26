"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"error" | "success" | "">("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const showMessage = (msg: string, msgType: "error" | "success") => {
    setMessage(msg);
    setType(msgType);

    setTimeout(() => {
      setMessage("");
      setType("");
    }, 4000);
  };

  const handleRegister = async () => {
    if (!email || !password) {
      showMessage("Completa todos los campos", "error");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "http://localhost:3000",
      },
    });

    if (error) {
      showMessage(error.message, "error");
      setLoading(false);
      return;
    }

    // 🔥 IMPORTANTE: cerrar sesión automática si Supabase crea una
    if (data.session) {
      await supabase.auth.signOut();
    }

    showMessage(
      "Cuenta creada 🎉 Revisa tu correo para confirmarla 📩",
      "success"
    );

    setEmail("");
    setPassword("");
    setLoading(false);

    setTimeout(() => {
      router.push("/login");
    }, 2000);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 relative">

      {/* Toast elegante animado */}
      {message && (
        <div
          className={`fixed top-6 right-6 px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all duration-300 ${
            type === "error"
              ? "bg-red-500 animate-shake"
              : "bg-pink-500 animate-fadeIn"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow w-full max-w-md transition-all duration-300 hover:shadow-xl">
        <h1 className="text-xl sm:text-2xl font-bold text-pink-400 mb-5 sm:mb-6 text-center">
          Crear Cuenta
        </h1>

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 p-2 sm:p-3 mb-4 rounded text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 p-2 sm:p-3 mb-6 rounded text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
        />

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-pink-400 text-white py-2 sm:py-3 rounded-full hover:bg-pink-500 transition flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Creando...
            </>
          ) : (
            "Registrarse"
          )}
        </button>
      </div>

      {/* Animaciones personalizadas */}
      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.4s ease forwards;
        }

        .animate-shake {
          animation: shake 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
          100% { transform: translateX(0); }
        }
      `}</style>

    </main>
  );
}