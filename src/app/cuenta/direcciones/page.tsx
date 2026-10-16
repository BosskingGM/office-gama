"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import AddressFields, { type AddrValue } from "@/components/AddressFields";
import { joinAddress, splitAddress } from "@/lib/address";

type Address = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address: string; // "Calle y número, Col. Colonia"
  colonia: string | null;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

type Form = AddrValue & {
  id: string | null;
  label: string;
  full_name: string;
  phone: string;
  is_default: boolean;
};

const MAX_ADDRESSES = 5;
const LABELS = ["Casa", "Trabajo", "Otra"];

const EMPTY: Form = {
  id: null,
  label: "Casa",
  full_name: "",
  phone: "",
  address: "",
  colonia: "",
  city: "",
  postal_code: "",
  latitude: null,
  longitude: null,
  cp_city: null,
  mode: "manual",
  is_default: false,
};

export default function DireccionesPage() {
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data, error: err } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (err) {
      setError(
        /relation .* does not exist|schema cache/i.test(err.message)
          ? "Falta crear las tablas de la cuenta en Supabase (supabase/account.sql)."
          : "No pudimos cargar tus direcciones."
      );
      setItems([]);
    } else {
      setError("");
      setItems((data ?? []) as Address[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const makeDefault = async (id: string) => {
    // Primero se quita la anterior (solo puede haber una predeterminada)
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .neq("id", id);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
  };

  const patch = (c: Partial<Form>) => setForm((f) => (f ? { ...f, ...c } : f));

  const openNew = () => {
    setFormError("");
    setForm({ ...EMPTY, is_default: items.length === 0 });
  };

  const openEdit = (a: Address) => {
    setFormError("");
    const { street, colonia } = splitAddress(a.address, a.colonia);
    const hasPin = a.latitude !== null && a.longitude !== null;
    setForm({
      id: a.id,
      label: a.label,
      full_name: a.full_name,
      phone: a.phone,
      address: street,
      colonia,
      city: a.city,
      postal_code: a.postal_code,
      latitude: hasPin ? a.latitude : null,
      longitude: hasPin ? a.longitude : null,
      cp_city: null,
      mode: hasPin ? "mapa" : "manual",
      is_default: a.is_default,
    });
  };

  const save = async () => {
    if (!form) return;
    setFormError("");

    const row = {
      label: form.label.trim() || "Casa",
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address: joinAddress(form.address, form.colonia),
      colonia: form.colonia.trim() || null,
      city: form.city.trim(),
      postal_code: form.postal_code.trim(),
      latitude: form.mode === "mapa" ? form.latitude : null,
      longitude: form.mode === "mapa" ? form.longitude : null,
    };

    if (!row.full_name) return setFormError("Escribe el nombre de quien recibe.");
    if (row.phone.replace(/\D/g, "").length < 10)
      return setFormError("El teléfono debe tener 10 dígitos.");
    if (!/^\d{5}$/.test(row.postal_code))
      return setFormError("El código postal tiene 5 dígitos.");
    if (!row.colonia) return setFormError("Elige o escribe la colonia.");
    if (!form.address.trim()) return setFormError("Escribe la calle y el número.");
    if (!row.city) return setFormError("Escribe la ciudad o municipio.");
    if (form.mode === "mapa" && row.latitude === null)
      return setFormError(
        "Marca el punto en el mapa, o cambia a “Escribir dirección”."
      );

    setSaving(true);
    try {
      if (form.id) {
        const { error: err } = await supabase
          .from("addresses")
          .update(row)
          .eq("id", form.id);
        if (err) throw err;
        if (form.is_default) await makeDefault(form.id);
      } else {
        const first = items.length === 0;
        const { data, error: err } = await supabase
          .from("addresses")
          .insert({ ...row, user_id: userId, is_default: first })
          .select("id")
          .single();
        if (err) throw err;
        if (form.is_default && !first && data) await makeDefault(data.id);
      }
      setForm(null);
      await load();
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "";
      setFormError(
        /colonia|latitude|longitude|schema cache/i.test(msg)
          ? "Falta ejecutar supabase/address-colonia.sql en Supabase para guardar colonia y ubicación."
          : "No pudimos guardar la dirección. Intenta de nuevo."
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Address) => {
    if (!window.confirm("¿Eliminar esta dirección?")) return;
    const { error: err } = await supabase
      .from("addresses")
      .delete()
      .eq("id", a.id);
    if (err) {
      setError("No pudimos eliminar la dirección.");
      return;
    }
    // Si era la predeterminada, la más antigua que quede toma su lugar
    const rest = items.filter((i) => i.id !== a.id);
    if (a.is_default && rest.length > 0) await makeDefault(rest[0].id);
    await load();
  };

  const setAsDefault = async (a: Address) => {
    await makeDefault(a.id);
    await load();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-9 w-44" />
        <div className="skeleton h-36" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Direcciones</h1>
          <p className="text-sm text-muted mt-1">
            Guarda tus direcciones de entrega y elígelas al pagar.
          </p>
        </div>
        {items.length < MAX_ADDRESSES && !error && (
          <button onClick={openNew} className="btn-primary shrink-0 text-sm">
            <Plus size={18} /> Agregar
          </button>
        )}
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

      {!error && items.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-brand-soft grid place-items-center">
            <MapPin size={28} className="text-brand-strong" />
          </div>
          <p className="font-semibold">Aún no tienes direcciones guardadas</p>
          <p className="text-sm text-muted">
            Agrega una y tus compras con envío serán más rápidas.
          </p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={18} /> Agregar dirección
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((a) => (
            <article key={a.id} className="card p-5 flex flex-col gap-3">
              <header className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-bold">
                  <Home size={16} className="text-brand-strong" /> {a.label}
                </span>
                {a.is_default && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-brand-soft text-brand-strong px-2.5 py-1 rounded-full">
                    <Star size={12} /> Predeterminada
                  </span>
                )}
              </header>

              <div className="text-sm text-neutral-700 leading-relaxed">
                <p className="font-medium">{a.full_name}</p>
                <p>{a.address}</p>
                <p>
                  {a.city}, C.P. {a.postal_code}
                </p>
                <p className="text-muted">Tel. {a.phone}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 mt-auto border-t border-line">
                {!a.is_default && (
                  <button
                    onClick={() => setAsDefault(a)}
                    className="text-sm text-brand-strong font-medium hover:underline mr-auto"
                  >
                    Hacer predeterminada
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => openEdit(a)}
                    aria-label="Editar dirección"
                    className="btn-outline p-0! w-10 h-10"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(a)}
                    aria-label="Eliminar dirección"
                    className="btn-outline p-0! w-10 h-10 text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {items.length >= MAX_ADDRESSES && (
        <p className="text-xs text-muted">
          Puedes guardar hasta {MAX_ADDRESSES} direcciones. Elimina una para
          agregar otra.
        </p>
      )}

      {/* ===== Formulario ===== */}
      {form && (
        <div
          className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={form.id ? "Editar dirección" : "Nueva dirección"}
        >
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-6">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-lg font-bold">
                  {form.id ? "Editar dirección" : "Nueva dirección"}
                </h2>
                <button
                  onClick={() => setForm(null)}
                  aria-label="Cerrar"
                  className="w-9 h-9 grid place-items-center rounded-full hover:bg-brand-soft"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-5 pb-5 space-y-4">
                {formError && (
                  <div
                    role="alert"
                    className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                  >
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{formError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {LABELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => patch({ label: l })}
                      aria-pressed={form.label === l}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition ${
                        form.label === l
                          ? "bg-brand border-brand text-ink"
                          : "bg-white border-line hover:border-brand"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="a-name" className="text-sm font-medium mb-1.5 block">
                    Nombre de quien recibe
                  </label>
                  <input
                    id="a-name"
                    autoComplete="name"
                    value={form.full_name}
                    onChange={(e) => patch({ full_name: e.target.value })}
                    maxLength={100}
                    className="field"
                  />
                </div>

                <div>
                  <label htmlFor="a-phone" className="text-sm font-medium mb-1.5 block">
                    Teléfono
                  </label>
                  <input
                    id="a-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="10 dígitos"
                    value={form.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    maxLength={20}
                    className="field"
                  />
                </div>

                <AddressFields
                  idPrefix="dir"
                  zone="mexico"
                  value={form}
                  onChange={patch}
                />

                <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    disabled={items.length === 0 || (!!form.id && items.find((i) => i.id === form.id)?.is_default)}
                    onChange={(e) => patch({ is_default: e.target.checked })}
                    className="w-4 h-4 accent-[#7e22ce]"
                  />
                  Usar como dirección predeterminada
                </label>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setForm(null)}
                    disabled={saving}
                    className="btn-outline flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="btn-primary flex-1"
                  >
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
