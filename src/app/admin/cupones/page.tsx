"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* =========================
   TIPOS Y AYUDAS
========================= */

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  percent_off: number;
  first_purchase_only: boolean;
  min_subtotal: number | string;
  max_uses: number | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type Redemption = {
  coupon_id: string;
  status: "reserved" | "used";
  reserved_until: string | null;
};

type FormState = {
  id: string | null;
  code: string;
  description: string;
  percent_off: string;
  first_purchase_only: boolean;
  min_subtotal: string;
  max_uses: string;
  active: boolean;
  starts_at: string; // datetime-local
  ends_at: string;
  hasUses: boolean; // con usos registrados el código ya no se puede cambiar
};

const EMPTY: FormState = {
  id: null,
  code: "",
  description: "",
  percent_off: "10",
  first_purchase_only: false,
  min_subtotal: "",
  max_uses: "",
  active: true,
  starts_at: "",
  ends_at: "",
  hasUses: false,
};

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Código al azar fácil de dictar por WhatsApp (sin 0/O ni 1/I)
function randomCode(prefix: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const tail = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${prefix}${tail}`;
}

function statusOf(c: Coupon, used: number): { label: string; tone: "ok" | "off" | "warn" } {
  const now = Date.now();
  if (!c.active) return { label: "Pausado", tone: "off" };
  if (c.starts_at && new Date(c.starts_at).getTime() > now)
    return { label: "Aún no empieza", tone: "warn" };
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return { label: "Vencido", tone: "off" };
  if (c.max_uses !== null && used >= c.max_uses) return { label: "Agotado", tone: "off" };
  return { label: "Activo", tone: "ok" };
}

// Mensaje listo para pegar en WhatsApp cuando un cliente pide su cupón
function whatsappReply(c: Coupon) {
  const lines = [
    `¡Hola! 💜 Aquí está tu cupón de Office Gama:`,
    ``,
    `*${c.code}* — ${c.percent_off}% de descuento${
      c.first_purchase_only ? " en tu primera compra" : ""
    }`,
    ``,
    `Escríbelo en el carrito, en "¿Tienes un cupón?", antes de pagar. Necesitas tener tu cuenta iniciada.`,
    `Se puede usar una sola vez por cliente.`,
  ];
  if (Number(c.min_subtotal) > 0)
    lines.push(`Aplica en compras de ${money(Number(c.min_subtotal))} o más.`);
  if (c.ends_at)
    lines.push(
      `Válido hasta el ${new Date(c.ends_at).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
      })}.`
    );
  return lines.join("\n");
}

/* =========================
   PÁGINA
========================= */

export default function CuponesPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [couponsRes, usesRes] = await Promise.all([
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase.from("coupon_redemptions").select("coupon_id, status, reserved_until"),
    ]);

    if (couponsRes.error) {
      setError(
        /relation .* does not exist|schema cache/i.test(couponsRes.error.message)
          ? "Falta crear las tablas de cupones en Supabase. Corre el archivo supabase/coupons.sql en el SQL Editor."
          : `No se pudieron cargar los cupones: ${couponsRes.error.message}`
      );
      setItems([]);
    } else {
      setItems((couponsRes.data ?? []) as Coupon[]);
    }

    // Cuenta los usos reales (pagos ya hechos) y los pagos en proceso vigentes
    const counts: Record<string, number> = {};
    const now = Date.now();
    for (const r of (usesRes.data ?? []) as Redemption[]) {
      const live =
        r.status === "used" ||
        (r.reserved_until !== null && new Date(r.reserved_until).getTime() >= now);
      if (live) counts[r.coupon_id] = (counts[r.coupon_id] || 0) + 1;
    }
    setUsage(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (changes: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...changes } : f));

  const openNew = () => {
    setFormError("");
    setForm({ ...EMPTY });
  };

  const openEdit = (c: Coupon) => {
    setFormError("");
    setForm({
      id: c.id,
      code: c.code,
      description: c.description ?? "",
      percent_off: String(c.percent_off),
      first_purchase_only: c.first_purchase_only,
      min_subtotal: Number(c.min_subtotal) > 0 ? String(c.min_subtotal) : "",
      max_uses: c.max_uses === null ? "" : String(c.max_uses),
      active: c.active,
      starts_at: toLocalInput(c.starts_at),
      ends_at: toLocalInput(c.ends_at),
      hasUses: (usage[c.id] ?? 0) > 0,
    });
  };

  const closeForm = () => {
    setForm(null);
    setFormError("");
  };

  const save = async () => {
    if (!form) return;
    setFormError("");

    const code = form.code.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      setFormError("El código debe tener de 3 a 30 letras, números, guion o guion bajo (sin espacios ni acentos).");
      return;
    }
    const percent = Number(form.percent_off);
    if (!Number.isInteger(percent) || percent < 1 || percent > 90) {
      setFormError("El descuento debe ser un número entero entre 1 y 90.");
      return;
    }
    const minSubtotal = form.min_subtotal.trim() === "" ? 0 : Number(form.min_subtotal);
    if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
      setFormError("La compra mínima debe ser un monto válido.");
      return;
    }
    const maxUses = form.max_uses.trim() === "" ? null : Number(form.max_uses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      setFormError("El límite de usos debe ser un entero de 1 en adelante (o déjalo vacío).");
      return;
    }
    const starts = fromLocalInput(form.starts_at);
    const ends = fromLocalInput(form.ends_at);
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      setFormError("La fecha final debe ser después de la fecha de inicio.");
      return;
    }

    setSaving(true);
    const row = {
      code,
      description: form.description.trim() || null,
      percent_off: percent,
      first_purchase_only: form.first_purchase_only,
      min_subtotal: minSubtotal,
      max_uses: maxUses,
      active: form.active,
      starts_at: starts,
      ends_at: ends,
    };

    const { error: dbErr } = form.id
      ? await supabase.from("coupons").update(row).eq("id", form.id)
      : await supabase.from("coupons").insert(row);
    setSaving(false);

    if (dbErr) {
      setFormError(
        dbErr.code === "23505"
          ? "Ya existe un cupón con ese código. Usa otro."
          : `No se pudo guardar: ${dbErr.message}`
      );
      return;
    }
    closeForm();
    await load();
  };

  const toggleActive = async (c: Coupon) => {
    const { error: err } = await supabase
      .from("coupons")
      .update({ active: !c.active })
      .eq("id", c.id);
    if (err) setError(`No se pudo cambiar: ${err.message}`);
    await load();
  };

  const remove = async (c: Coupon) => {
    if (!window.confirm(`¿Eliminar el cupón ${c.code}? No se puede deshacer.`)) return;
    const { error: err } = await supabase.from("coupons").delete().eq("id", c.id);
    if (err) {
      setError(
        err.code === "23503"
          ? `El cupón ${c.code} ya tiene usos registrados, por eso no se puede eliminar (así nadie puede volver a usarlo). Mejor páusalo.`
          : `No se pudo eliminar: ${err.message}`
      );
      return;
    }
    await load();
  };

  const copyReply = async (c: Coupon) => {
    try {
      await navigator.clipboard.writeText(whatsappReply(c));
      setCopied(c.id);
      setTimeout(() => setCopied((cur) => (cur === c.id ? null : cur)), 2500);
    } catch {
      setError("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  /* ---------- vista ---------- */

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Cupones</h1>
          <p className="text-sm text-muted mt-1">
            Cada cliente puede usar un mismo cupón una sola vez. Para repartirlos,
            crea una promoción con botón “Obtener cupón” en{" "}
            <strong>Promociones</strong>.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary shrink-0 text-sm">
          <Plus size={18} /> Nuevo
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3"
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="py-16 grid place-items-center text-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : items.length === 0 && !error ? (
        <div className="card p-10 text-center space-y-3">
          <p className="font-semibold">Aún no hay cupones</p>
          <p className="text-sm text-muted">
            Crea uno de porcentaje o de primera compra y úsalo en una promoción.
          </p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={18} /> Crear el primero
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((c) => {
            const used = usage[c.id] ?? 0;
            const st = statusOf(c, used);
            return (
              <div key={c.id} className="card p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono font-extrabold text-xl tracking-wide break-all">
                      {c.code}
                    </p>
                    <p className="text-sm text-neutral-700 mt-0.5">
                      {c.percent_off}% de descuento
                      {c.first_purchase_only ? " · solo primera compra" : ""}
                    </p>
                    {c.description && (
                      <p className="text-xs text-muted mt-1">{c.description}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      st.tone === "ok"
                        ? "bg-green-50 text-ok"
                        : st.tone === "warn"
                        ? "bg-peach-soft text-ink"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {st.label}
                  </span>
                </div>

                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-brand-soft rounded-xl px-3 py-2">
                    <dt className="text-muted">Usos</dt>
                    <dd className="font-bold text-sm">
                      {used}
                      {c.max_uses !== null ? ` / ${c.max_uses}` : ""}
                    </dd>
                  </div>
                  <div className="bg-brand-soft rounded-xl px-3 py-2">
                    <dt className="text-muted">Compra mínima</dt>
                    <dd className="font-bold text-sm">
                      {Number(c.min_subtotal) > 0 ? money(Number(c.min_subtotal)) : "—"}
                    </dd>
                  </div>
                  <div className="bg-brand-soft rounded-xl px-3 py-2">
                    <dt className="text-muted">Vence</dt>
                    <dd className="font-bold text-sm">
                      {c.ends_at
                        ? new Date(c.ends_at).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                          })
                        : "Nunca"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => copyReply(c)}
                    className="btn-outline text-sm py-2! px-4!"
                  >
                    {copied === c.id ? <Check size={15} /> : <Copy size={15} />}
                    {copied === c.id ? "¡Copiado!" : "Copiar mensaje de WhatsApp"}
                  </button>
                  <div className="flex-1" />
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={c.active}
                      onChange={() => toggleActive(c)}
                      className="w-4 h-4 accent-[#7e22ce]"
                    />
                    Activo
                  </label>
                  <button
                    onClick={() => openEdit(c)}
                    aria-label={`Editar ${c.code}`}
                    className="btn-outline p-0! w-10 h-10"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    aria-label={`Eliminar ${c.code}`}
                    className="btn-outline p-0! w-10 h-10 text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Formulario ===== */}
      {form && (
        <div
          className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={form.id ? "Editar cupón" : "Nuevo cupón"}
        >
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-6">
            <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-lg font-bold">
                  {form.id ? "Editar cupón" : "Nuevo cupón"}
                </h2>
                <button
                  onClick={closeForm}
                  aria-label="Cerrar"
                  className="w-9 h-9 grid place-items-center rounded-full hover:bg-brand-soft"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-5 pb-5 space-y-5">
                {formError && (
                  <div
                    role="alert"
                    className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                  >
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{formError}</p>
                  </div>
                )}

                {/* Tipo */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tipo de cupón</p>
                  <div role="radiogroup" aria-label="Tipo de cupón" className="grid grid-cols-2 gap-3">
                    {[
                      { v: false, t: "Descuento %", n: "Lo puede usar cualquier cliente, una vez." },
                      {
                        v: true,
                        t: "Primera compra",
                        n: "Solo clientes sin pedidos anteriores.",
                      },
                    ].map((o) => (
                      <button
                        key={o.t}
                        type="button"
                        role="radio"
                        aria-checked={form.first_purchase_only === o.v}
                        onClick={() => patch({ first_purchase_only: o.v })}
                        className={`text-left rounded-2xl border-2 p-3.5 transition ${
                          form.first_purchase_only === o.v
                            ? "border-brand-strong bg-brand-soft"
                            : "border-line bg-white hover:border-brand"
                        }`}
                      >
                        <p className="font-semibold text-sm">{o.t}</p>
                        <p className="text-xs text-muted mt-1 leading-4">{o.n}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_110px] gap-3">
                  <div>
                    <label htmlFor="c-code" className="text-sm font-medium mb-1.5 block">
                      Código
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="c-code"
                        value={form.code}
                        maxLength={30}
                        disabled={form.hasUses}
                        onChange={(e) =>
                          patch({ code: e.target.value.toUpperCase().replace(/\s+/g, "") })
                        }
                        placeholder="Ej. BIENVENIDA10"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        className="field min-w-0 font-mono uppercase"
                      />
                      {!form.hasUses && (
                        <button
                          type="button"
                          onClick={() =>
                            patch({ code: randomCode(form.first_purchase_only ? "PRIMERA" : "GAMA") })
                          }
                          aria-label="Generar código"
                          title="Generar código"
                          className="btn-outline p-0! w-11 h-11 shrink-0"
                        >
                          <Shuffle size={16} />
                        </button>
                      )}
                    </div>
                    {form.hasUses && (
                      <p className="text-xs text-muted mt-1.5">
                        Ya tiene usos, por eso el código no se puede cambiar.
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="c-pct" className="text-sm font-medium mb-1.5 block">
                      Descuento %
                    </label>
                    <input
                      id="c-pct"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={90}
                      value={form.percent_off}
                      onChange={(e) => patch({ percent_off: e.target.value })}
                      className="field"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="c-desc" className="text-sm font-medium mb-1.5 block">
                    Nota interna (opcional)
                  </label>
                  <input
                    id="c-desc"
                    value={form.description}
                    maxLength={120}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="Ej. Campaña de Instagram octubre"
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="c-min" className="text-sm font-medium mb-1.5 block">
                      Compra mínima (opcional)
                    </label>
                    <input
                      id="c-min"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={form.min_subtotal}
                      onChange={(e) => patch({ min_subtotal: e.target.value })}
                      placeholder="$ 0"
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor="c-max" className="text-sm font-medium mb-1.5 block">
                      Límite total de usos
                    </label>
                    <input
                      id="c-max"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={form.max_uses}
                      onChange={(e) => patch({ max_uses: e.target.value })}
                      placeholder="Sin límite"
                      className="field"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Vigencia (opcional)</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="c-from" className="text-xs text-muted mb-1 block">
                        Empieza
                      </label>
                      <input
                        id="c-from"
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={(e) => patch({ starts_at: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor="c-to" className="text-xs text-muted mb-1 block">
                        Termina
                      </label>
                      <input
                        id="c-to"
                        type="datetime-local"
                        value={form.ends_at}
                        onChange={(e) => patch({ ends_at: e.target.value })}
                        className="field"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => patch({ active: e.target.checked })}
                    className="w-4 h-4 accent-[#7e22ce]"
                  />
                  Cupón activo
                </label>

                <p className="text-xs text-muted leading-relaxed bg-brand-soft rounded-xl px-3.5 py-3">
                  El descuento se aplica solo a los productos (no al envío). Un cliente no puede
                  usar el mismo cupón dos veces, ni con otra cuenta si repite su teléfono.
                </p>

                <div className="flex gap-3 pt-1">
                  <button onClick={closeForm} disabled={saving} className="btn-outline flex-1">
                    Cancelar
                  </button>
                  <button onClick={save} disabled={saving} className="btn-primary flex-1">
                    {saving ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Guardando…
                      </>
                    ) : (
                      "Guardar"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
