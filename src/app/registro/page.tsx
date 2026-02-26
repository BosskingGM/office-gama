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
      showMessage("Cuenta creada correctamente", "success");

      setTimeout(() => {
        router.push("/login");
      }, 1000);
    }
  };

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

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
            Crear cuenta
          </h1>
          <p className="text-neutral-500 text-sm">
            Regístrate para comenzar a comprar
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

        {/* CONFIRM PASSWORD */}
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full border px-5 py-3 rounded-2xl text-neutral-900 focus:outline-none focus:ring-2 transition ${
              confirmPassword.length > 0
                ? passwordsMatch
                  ? "border-[#d6a8ff] focus:ring-[#d6a8ff]"
                  : "border-neutral-900 focus:ring-neutral-900"
                : "border-neutral-300 focus:ring-[#d6a8ff]"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 transition"
          >
            {showConfirmPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* INDICADOR */}
        {confirmPassword.length > 0 && (
          <p
            className={`text-sm font-medium ${
              passwordsMatch
                ? "text-neutral-800"
                : "text-neutral-500"
            }`}
          >
            {passwordsMatch
              ? "Las contraseñas coinciden"
              : "Las contraseñas no coinciden"}
          </p>
        )}

        {/* BOTÓN */}
        <button
          onClick={handleRegister}
          className="w-full bg-[#d6a8ff] text-black py-4 rounded-2xl font-semibold hover:opacity-90 transition"
        >
          Registrarse
        </button>

      </div>
    </main>
  );
}