"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthListener() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        if (
          pathname !== "/login" &&
          pathname !== "/registro"
        ) {
          await supabase.auth.signOut();
          router.replace("/login");
        }
      }
    };

    checkSession();
  }, [pathname, router]);

  return null;
}