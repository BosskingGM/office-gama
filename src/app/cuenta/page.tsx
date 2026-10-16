"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SHIPPING_OPTIONS, type ShippingType } from "@/lib/shipping";
import { firstName, WHATSAPP_URL } from "@/lib/account";
import StatusBadge, { statusInfo } from "@/components/StatusBadge";

const money = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const SALE = ["pagado", "enviado", "entregado"];

export default function CuentaResumenPage() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [hasPhone, setHasPhone] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const uid = session.user.id;

      const [ordersRes, detailsRes, addrRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, created_at, status, total, shipping_type, order_items ( quantity )")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_details")
          .select("full_name, phone")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase
          .from("addresses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid),
      ]);

      if (ordersRes.error) setFailed(true);
      else setOrders(ordersRes.data ?? []);

      setName(detailsRes.data?.full_name ?? "");
      setHasPhone(!!detailsRes.data?.phone);
      setAddresses(addrRes.count ?? 0);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton h-24" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  const sales = orders.filter((o) => SALE.includes(String(o.status).toLowerCase()));
  const spent = sales.reduce((acc, o) => acc + Number(o.total ?? 0), 0);
  const pieces = sales.reduce(
    (acc, o) =>
      acc +
      (o.order_items ?? []).reduce(
        (a: number, i: any) => a + Number(i.quantity ?? 0),
        0
      ),
    0
  );
  const inProgress = orders.filter((o) =>
    ["pendiente", "pagado", "enviado"].includes(String(o.status).toLowerCase())
  ).length;
  const last = orders[0];
  const incomplete = !name || !hasPhone;

  const shortcuts = [
    { href: "/cuenta/pedidos", icon: Package, title: "Mis pedidos", text: `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}` },
    { href: "/cuenta/perfil", icon: UserIcon, title: "Mis datos", text: "Nombre, teléfono y correo" },
    { href: "/cuenta/direcciones", icon: MapPin, title: "Direcciones", text: addresses ? `${addresses} guardada${addresses === 1 ? "" : "s"}` : "Agrega una dirección" },
    { href: "/cuenta/seguridad", icon: Lock, title: "Seguridad", text: "Contraseña y sesión" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold">
          {firstName(name) ? `¡Hola, ${firstName(name)}!` : "Mi cuenta"}
        </h1>
        <p className="text-sm text-muted mt-1">
          Aquí ves tus compras y administras tus datos.
        </p>
      </div>

      {incomplete && (
        <Link
          href="/cuenta/perfil"
          className="flex items-center gap-3 bg-peach-soft border border-peach rounded-2xl px-4 py-3.5 text-sm hover:brightness-95 transition"
        >
          <UserIcon size={18} className="text-brand-strong shrink-0" />
          <span className="flex-1">
            <strong>Completa tus datos</strong> para que tus próximas compras
            sean más rápidas.
          </span>
          <ChevronRight size={16} className="shrink-0" />
        </Link>
      )}

      {failed ? (
        <div className="card p-8 text-center text-sm text-muted">
          No pudimos cargar tus pedidos. Recarga la página en unos minutos.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pedidos en curso", value: String(inProgress) },
              { label: "Piezas compradas", value: String(pieces) },
              { label: "Total comprado", value: money(spent) },
            ].map((s) => (
              <div key={s.label} className="card p-3.5 sm:p-5">
                <p className="text-[11px] sm:text-xs text-muted leading-tight">
                  {s.label}
                </p>
                <p className="text-lg sm:text-2xl font-extrabold mt-1.5 break-words">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="font-bold">Tu último pedido</h2>
            {last ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      Pedido #{last.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm text-muted">
                      {new Date(last.created_at).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {SHIPPING_OPTIONS[last.shipping_type as ShippingType]
                        ? ` · ${SHIPPING_OPTIONS[last.shipping_type as ShippingType].label}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={last.status} />
                </div>
                {statusInfo(last.status).help && (
                  <p className="text-sm text-neutral-600">
                    {statusInfo(last.status).help}
                  </p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-line">
                  <p className="text-lg font-bold">{money(last.total)}</p>
                  <Link
                    href={`/pedido/${last.id}`}
                    className="btn-outline text-sm px-4! py-2!"
                  >
                    Ver detalle <ChevronRight size={16} />
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted">Aún no has hecho ningún pedido.</p>
                <Link href="/" className="btn-primary">
                  Ir a la tienda
                </Link>
              </div>
            )}
          </section>
        </>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {shortcuts.map(({ href, icon: Icon, title, text }) => (
          <Link
            key={href}
            href={href}
            className="card card-hover p-4 flex items-center gap-4"
          >
            <span className="w-11 h-11 rounded-full bg-brand-soft text-brand-strong grid place-items-center shrink-0">
              <Icon size={20} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold">{title}</span>
              <span className="block text-xs text-muted truncate">{text}</span>
            </span>
            <ChevronRight size={18} className="text-neutral-400 shrink-0" />
          </Link>
        ))}
      </div>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="card p-4 flex items-center gap-4 hover:border-brand transition"
      >
        <span className="w-11 h-11 rounded-full bg-green-50 text-ok grid place-items-center shrink-0">
          <MessageCircle size={20} />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">¿Necesitas ayuda con un pedido?</span>
          <span className="block text-xs text-muted">Escríbenos por WhatsApp</span>
        </span>
        <ChevronRight size={18} className="text-neutral-400 shrink-0" />
      </a>
    </div>
  );
}
