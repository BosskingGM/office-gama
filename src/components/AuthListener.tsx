"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthListener() {
  const pathname = usePathname();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Si la sesión se pierde Y no estamos en login o registro
      if (!session && pathname !== "/login" && pathname !== "/registro") {
        window.location.href = "/login";
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  return null;
}