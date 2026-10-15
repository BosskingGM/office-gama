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
