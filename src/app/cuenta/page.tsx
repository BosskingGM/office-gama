"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, PackageOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SHIPPING_OPTIONS, type ShippingType } from "@/lib/shipping";
import StatusBadge from "@/components/StatusBadge";

const money = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function CuentaPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Si no hay sesión, AuthListener ya manda a /login; esto evita quedarse cargando.
      if (!session) {
        setSignedIn(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id, created_at, status, total, shipping_type, shipping_cost,
          order_items (
            id, quantity, price, product_name, variant_name,
            product_variants ( image_url, model_name, products ( name ) )
          )
        `
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setFailed(true);
      } else {
        setOrders(data ?? []);
      }
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-44" />
        <div className="skeleton h-44" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="card p-10 text-center space-y-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold">Inicia sesión</h1>
        <p className="text-sm text-muted">
          Entra a tu cuenta para ver tus pedidos.
        </p>
        <Link href="/login?next=/cuenta" className="btn-primary">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl sm:text-4xl font-extrabold">Mis pedidos</h1>

      {failed ? (
        <div className="card p-10 text-center space-y-2">
          <p className="font-semibold text-lg">No pudimos cargar tus pedidos</p>
          <p className="text-sm text-muted">Recarga la página en unos minutos.</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-brand-soft grid place-items-center">
            <PackageOpen size={34} className="text-brand-strong" />
          </div>
          <p className="font-semibold text-lg">Aún no tienes pedidos</p>
          <Link href="/" className="btn-primary">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const shipping =
              SHIPPING_OPTIONS[order.shipping_type as ShippingType]?.label;
            return (
              <article key={order.id} className="card p-5 sm:p-7">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      Pedido #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm text-muted">
                      {new Date(order.created_at).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {shipping && ` · ${shipping}`}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </header>

                <ul className="mt-5 pt-5 border-t border-line space-y-4">
                  {(order.order_items ?? []).map((item: any) => {
                    const v = item.product_variants;
                    const name = item.product_name || v?.products?.name || "Producto";
                    const model = item.variant_name || v?.model_name;
                    return (
                      <li key={item.id} className="flex items-center gap-4">
                        {v?.image_url ? (
                          <img
                            src={v.image_url}
                            alt=""
                            loading="lazy"
                            className="w-16 h-16 object-cover rounded-xl border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-brand-soft shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold line-clamp-2">{name}</p>
                          <p className="text-xs text-muted">
                            {model ? `${model} · ` : ""}
                            {item.quantity} {item.quantity === 1 ? "pieza" : "piezas"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {money(item.price * item.quantity)}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                <footer className="mt-5 pt-5 border-t border-line flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">Total</p>
                    <p className="text-xl font-bold">{money(order.total)}</p>
                  </div>
                  <Link
                    href={`/pedido/${order.id}`}
                    className="btn-outline text-sm px-4! py-2!"
                  >
                    Ver detalle <ChevronRight size={16} />
                  </Link>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
