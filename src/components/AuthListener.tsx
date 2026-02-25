"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthListener() {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        // Si no hay sesión válida, redirige a login
        window.location.href = "/login";
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}