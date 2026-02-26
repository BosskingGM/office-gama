"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      showMessage("Completa todos los campos", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Las contraseñas no coinciden", "error");
      return;
    }

    if (password.length < 6) {
      showMessage("La contraseña debe tener al menos 6 caracteres", "error");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      showMessage(error.message, "error");
    } else {
      showMessage("Cuenta creada correctamente 🎉", "success");

      setTimeout(() => {
        router.push("/login");
      }, 1200);
    }
  };

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-white px-4 sm:px-6 relative">

      {/* Toast */}
      {message && (
        <div
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all duration-500 ${
            type === "error"
              ? "bg-red-500 animate-bounce"
              : "bg-green-500 animate-bounce"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl w-full max-w-md transition-all duration-300">
        <h1 className="text-xl sm:text-2xl font-bold text-pink-400 mb-6 text-center">
          Crear Cuenta
        </h1>

        {/* Email */}
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 p-3 mb-4 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-400 transition"
        />

        {/* Password */}
        <div className="relative mb-4">
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-pink-400"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Confirm Password */}
        <div className="relative mb-2">
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full border p-3 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 transition ${
              confirmPassword.length > 0
                ? passwordsMatch
                  ? "border-green-400 focus:ring-green-400"
                  : "border-red-400 focus:ring-red-400"
                : "border-gray-300 focus:ring-pink-400"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-pink-400"
          >
            {showConfirmPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Indicador */}
        {confirmPassword.length > 0 && (
          <p
            className={`text-sm mb-4 font-medium ${
              passwordsMatch ? "text-green-500" : "text-red-500"
            }`}
          >
            {passwordsMatch
              ? "✔ Las contraseñas coinciden"
              : "✖ Las contraseñas no coinciden"}
          </p>
        )}

        <button
          onClick={handleRegister}
          className="w-full bg-pink-400 text-white py-3 rounded-full hover:bg-pink-500 transition transform hover:scale-105"
        >
          Registrarse
        </button>
      </div>
    </main>
  );
}