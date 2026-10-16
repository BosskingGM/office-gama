// Estado de un pedido, con color y texto en español.
// Se usa en "Mis pedidos" y en el detalle del pedido.

const STATUS: Record<
  string,
  { label: string; className: string; help: string }
> = {
  pagado: {
    label: "Pagado",
    className: "bg-green-100 text-green-800",
    help: "Recibimos tu pago. Estamos preparando tu pedido.",
  },
  revision: {
    label: "En revisión",
    className: "bg-amber-100 text-amber-800",
    help: "Estamos revisando tu transferencia. Tus piezas están apartadas; te avisamos por correo al aprobar tu pago.",
  },
  contra_entrega: {
    label: "Pago al recoger",
    className: "bg-orange-100 text-orange-800",
    help: "Tu pedido está apartado. Paga en la tienda cuando pases por él.",
  },
  pendiente: {
    label: "Pendiente",
    className: "bg-yellow-100 text-yellow-800",
    help: "Estamos esperando la confirmación de tu pago.",
  },
  enviado: {
    label: "Enviado",
    className: "bg-blue-100 text-blue-800",
    help: "Tu pedido va en camino. Te avisamos por correo al enviarlo.",
  },
  entregado: {
    label: "Entregado",
    className: "bg-purple-100 text-purple-800",
    help: "Tu pedido fue entregado. ¡Gracias por tu compra!",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-100 text-red-700",
    help: "Este pedido fue cancelado. Escríbenos si tienes dudas.",
  },
};

export function statusInfo(status: string | null | undefined) {
  const key = (status ?? "").toLowerCase();
  return (
    STATUS[key] ?? {
      label: status || "Sin estado",
      className: "bg-neutral-200 text-neutral-800",
      help: "",
    }
  );
}

export default function StatusBadge({ status }: { status: string }) {
  const { label, className } = statusInfo(status);
  return (
    <span
      className={`inline-block px-3.5 py-1 rounded-full text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
