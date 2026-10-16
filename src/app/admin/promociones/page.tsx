"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PromoSlide, THEMES, type ThemeKey } from "@/components/PromoBanner";

/* =========================
   TIPOS Y AYUDAS
========================= */

type DbPromo = {
  id: string;
  title: string | null;
  subtitle: string | null;
  button_text: string | null;
  link_url: string | null;
  image_url: string | null;
  theme: string | null;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

type LinkKind = "catalogo" | "none" | "custom";

type FormState = {
  id: string | null;
  title: string;
  subtitle: string;
  button_text: string;
  link_kind: LinkKind;
  link_custom: string;
  theme: ThemeKey;
  active: boolean;
  starts_at: string; // formato datetime-local, "" = sin fecha
  ends_at: string;
  imageBlob: Blob | null;
  previewUrl: string | null;
  existingImageUrl: string | null;
  removeImage: boolean;
};

const BUCKET = "products"; // el mismo bucket del inventario, carpeta promos/

const EMPTY: FormState = {
  id: null,
  title: "",
  subtitle: "",
  button_text: "",
  link_kind: "catalogo",
  link_custom: "",
  theme: "lila",
  active: true,
  starts_at: "",
  ends_at: "",
  imageBlob: null,
  previewUrl: null,
  existingImageUrl: null,
  removeImage: false,
};

// ISO (UTC) → valor para <input type="datetime-local"> en hora local
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

function linkKindOf(url: string | null): { kind: LinkKind; custom: string } {
  if (!url) return { kind: "none", custom: "" };
  if (url === "#catalogo") return { kind: "catalogo", custom: "" };
  return { kind: "custom", custom: url };
}

// Reduce la foto a máx. 1600 px de ancho y la convierte a JPG.
async function prepareBanner(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No se pudo leer esa imagen. Usa un JPG, PNG o WebP.");
  }
  const MAX = 1600;
  const scale = Math.min(1, MAX / bitmap.width);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("No se pudo preparar la imagen.");
  return blob;
}

function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  try {
    return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  } catch {
    return url.slice(i + marker.length).split("?")[0];
  }
}

async function removeFile(url: string | null) {
  const path = storagePathFromUrl(url);
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* limpieza opcional */
  }
}

function statusOf(p: DbPromo): { label: string; tone: "ok" | "off" | "warn" } {
  const now = Date.now();
  if (!p.active) return { label: "Pausada", tone: "off" };
  if (p.starts_at && new Date(p.starts_at).getTime() > now)
    return {
      label: `Empieza ${new Date(p.starts_at).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
      })}`,
      tone: "warn",
    };
  if (p.ends_at && new Date(p.ends_at).getTime() < now)
    return { label: "Vencida", tone: "off" };
  return { label: "Visible en la tienda", tone: "ok" };
}

/* =========================
   PÁGINA
========================= */

export default function PromocionesPage() {
  const [items, setItems] = useState<DbPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("promotions")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (err) {
      setError(
        /relation .* does not exist|schema cache/i.test(err.message)
          ? "Falta crear la tabla de promociones en Supabase. Corre el archivo supabase/promotions.sql en el SQL Editor."
          : `No se pudieron cargar las promociones: ${err.message}`
      );
      setItems([]);
    } else {
      setItems((data ?? []) as DbPromo[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- formulario ---------- */

  const closeForm = () => {
    if (form?.previewUrl) URL.revokeObjectURL(form.previewUrl);
    setForm(null);
    setFormError("");
  };

  const openNew = () => {
    setFormError("");
    setForm({ ...EMPTY });
  };

  const openEdit = (p: DbPromo) => {
    const { kind, custom } = linkKindOf(p.link_url);
    setFormError("");
    setForm({
      id: p.id,
      title: p.title ?? "",
      subtitle: p.subtitle ?? "",
      button_text: p.button_text ?? "",
      link_kind: kind,
      link_custom: custom,
      theme: (p.theme as ThemeKey) in THEMES ? (p.theme as ThemeKey) : "lila",
      active: p.active,
      starts_at: toLocalInput(p.starts_at),
      ends_at: toLocalInput(p.ends_at),
      imageBlob: null,
      previewUrl: null,
      existingImageUrl: p.image_url,
      removeImage: false,
    });
  };

  const patch = (changes: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...changes } : f));

  const pickPhoto = async (file: File | null) => {
    if (!file || !form) return;
    setFormError("");
    setPhotoBusy(true);
    try {
      const blob = await prepareBanner(file);
      if (form.previewUrl) URL.revokeObjectURL(form.previewUrl);
      patch({
        imageBlob: blob,
        previewUrl: URL.createObjectURL(blob),
        removeImage: false,
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "No se pudo usar la foto.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const currentImage = form
    ? form.previewUrl ?? (form.removeImage ? null : form.existingImageUrl)
    : null;

  const resolveLink = (f: FormState): string | null => {
    if (f.link_kind === "catalogo") return "#catalogo";
    if (f.link_kind === "custom") return f.link_custom.trim() || null;
    return null;
  };

  const save = async () => {
    if (!form) return;
    setFormError("");

    const title = form.title.trim();
    const subtitle = form.subtitle.trim();
    const button = form.button_text.trim();
    const link = resolveLink(form);

    if (!currentImage && !title) {
      setFormError("Agrega una imagen o al menos un título.");
      return;
    }
    if (button && !link) {
      setFormError("Para poner un botón elige a dónde lleva.");
      return;
    }
    if (link && !/^(#|\/(?!\/)|https?:\/\/)/.test(link)) {
      setFormError(
        "La dirección debe empezar con /, # o https:// (por ejemplo /producto/123)."
      );
      return;
    }
    const starts = fromLocalInput(form.starts_at);
    const ends = fromLocalInput(form.ends_at);
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      setFormError("La fecha final debe ser después de la fecha de inicio.");
      return;
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let image_url: string | null = form.removeImage
        ? null
        : form.existingImageUrl;

      if (form.imageBlob) {
        const path = `promos/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, form.imageBlob, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
          });
        if (upErr) throw new Error(`No se pudo subir la imagen: ${upErr.message}`);
        uploadedPath = path;
        image_url = supabase.storage.from(BUCKET).getPublicUrl(path).data
          .publicUrl;
      }

      const row = {
        title: title || null,
        subtitle: subtitle || null,
        button_text: button || null,
        link_url: link,
        image_url,
        theme: form.theme,
        active: form.active,
        starts_at: starts,
        ends_at: ends,
      };

      if (form.id) {
        const { error: dbErr } = await supabase
          .from("promotions")
          .update(row)
          .eq("id", form.id);
        if (dbErr) throw new Error(dbErr.message);
      } else {
        // La nueva promoción va primero
        const first = items.length
          ? Math.min(...items.map((i) => i.sort_order)) - 1
          : 0;
        const { error: dbErr } = await supabase
          .from("promotions")
          .insert({ ...row, sort_order: first });
        if (dbErr) throw new Error(dbErr.message);
      }

      // Si se cambió o quitó la foto, borra la anterior
      if (
        form.existingImageUrl &&
        (form.imageBlob || form.removeImage) &&
        form.existingImageUrl !== image_url
      ) {
        await removeFile(form.existingImageUrl);
      }

      closeForm();
      await load();
    } catch (e) {
      if (uploadedPath) {
        try {
          await supabase.storage.from(BUCKET).remove([uploadedPath]);
        } catch {
          /* nada */
        }
      }
      setFormError(
        e instanceof Error ? e.message : "No se pudo guardar. Intenta otra vez."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------- acciones de la lista ---------- */

  const toggleActive = async (p: DbPromo) => {
    const { error: err } = await supabase
      .from("promotions")
      .update({ active: !p.active })
      .eq("id", p.id);
    if (err) setError(`No se pudo cambiar: ${err.message}`);
    await load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    const results = await Promise.all(
      next.map((p, i) =>
        supabase.from("promotions").update({ sort_order: i }).eq("id", p.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) setError(`No se pudo reordenar: ${failed.error.message}`);
    await load();
  };

  const remove = async (p: DbPromo) => {
    if (!window.confirm("¿Eliminar esta promoción? No se puede deshacer.")) return;
    const { error: err } = await supabase
      .from("promotions")
      .delete()
      .eq("id", p.id);
    if (err) {
      setError(`No se pudo eliminar: ${err.message}`);
      return;
    }
    await removeFile(p.image_url);
    await load();
  };

  /* ---------- vista ---------- */

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Promociones</h1>
          <p className="text-sm text-muted mt-1">
            Lo que aparece hasta arriba de la tienda. Los cambios se ven en
            menos de 1 minuto.
          </p>
        </div>
        <button onClick={openNew} className="btn-primary shrink-0 text-sm">
          <Plus size={18} /> Nueva
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
          <p className="font-semibold">Aún no hay promociones</p>
          <p className="text-sm text-muted">
            Mientras no haya ninguna activa, la tienda muestra un banner de
            bienvenida.
          </p>
          <button onClick={openNew} className="btn-primary">
            <Plus size={18} /> Crear la primera
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((p, i) => {
            const st = statusOf(p);
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className="pointer-events-none">
                  <PromoSlide promo={{ ...p, link_url: null }} />
                </div>
                <div className="p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        st.tone === "ok"
                          ? "bg-green-50 text-ok"
                          : st.tone === "warn"
                          ? "bg-peach-soft text-ink"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {st.label}
                    </span>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={() => toggleActive(p)}
                        className="w-4 h-4 accent-[#7e22ce]"
                      />
                      Activa
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Subir"
                      className="btn-outline p-0! w-10 h-10"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      aria-label="Bajar"
                      className="btn-outline p-0! w-10 h-10"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => openEdit(p)}
                      className="btn-outline text-sm py-2! px-4!"
                    >
                      <Pencil size={15} /> Editar
                    </button>
                    <button
                      onClick={() => remove(p)}
                      aria-label="Eliminar"
                      className="btn-outline p-0! w-10 h-10 text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
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
          aria-label={form.id ? "Editar promoción" : "Nueva promoción"}
        >
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-6">
            <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-lg font-bold">
                  {form.id ? "Editar promoción" : "Nueva promoción"}
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
                {/* Vista previa */}
                <div>
                  <p className="text-xs font-semibold text-muted mb-1.5">
                    Así se verá
                  </p>
                  <div className="rounded-2xl overflow-hidden border border-line pointer-events-none">
                    <PromoSlide
                      promo={{
                        id: "preview",
                        title: form.title.trim() || null,
                        subtitle: form.subtitle.trim() || null,
                        button_text: form.button_text.trim() || null,
                        link_url: null,
                        image_url: currentImage,
                        theme: form.theme,
                      }}
                    />
                  </div>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3"
                  >
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{formError}</p>
                  </div>
                )}

                {/* Imagen */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Imagen (opcional)</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="btn-outline text-sm py-2! px-4! cursor-pointer">
                      {photoBusy ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ImagePlus size={16} />
                      )}
                      {currentImage ? "Cambiar imagen" : "Subir imagen"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          pickPhoto(e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {currentImage && (
                      <button
                        type="button"
                        onClick={() => {
                          if (form.previewUrl) URL.revokeObjectURL(form.previewUrl);
                          patch({
                            imageBlob: null,
                            previewUrl: null,
                            removeImage: true,
                          });
                        }}
                        className="btn-outline text-sm py-2! px-4! text-danger"
                      >
                        Quitar imagen
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Mejor horizontal, de 1600 × 600 px. Se recorta de los lados,
                    así que deja lo importante al centro. Si tu imagen ya trae
                    texto, deja vacíos título y subtítulo.
                  </p>
                </div>

                {/* Textos */}
                <div className="space-y-3.5">
                  <div>
                    <label htmlFor="p-title" className="text-sm font-medium mb-1.5 block">
                      Título
                    </label>
                    <input
                      id="p-title"
                      value={form.title}
                      maxLength={80}
                      onChange={(e) => patch({ title: e.target.value })}
                      placeholder="Ej. 2x1 en washi tapes"
                      className="field"
                    />
                  </div>
                  <div>
                    <label htmlFor="p-sub" className="text-sm font-medium mb-1.5 block">
                      Subtítulo
                    </label>
                    <input
                      id="p-sub"
                      value={form.subtitle}
                      maxLength={120}
                      onChange={(e) => patch({ subtitle: e.target.value })}
                      placeholder="Ej. Solo este fin de semana"
                      className="field"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="p-btn" className="text-sm font-medium mb-1.5 block">
                        Texto del botón
                      </label>
                      <input
                        id="p-btn"
                        value={form.button_text}
                        maxLength={24}
                        onChange={(e) => patch({ button_text: e.target.value })}
                        placeholder="Ver ofertas"
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor="p-link" className="text-sm font-medium mb-1.5 block">
                        Al tocarla lleva a
                      </label>
                      <select
                        id="p-link"
                        value={form.link_kind}
                        onChange={(e) =>
                          patch({ link_kind: e.target.value as LinkKind })
                        }
                        className="field"
                      >
                        <option value="catalogo">El catálogo</option>
                        <option value="none">A ningún lado</option>
                        <option value="custom">Otra dirección</option>
                      </select>
                    </div>
                  </div>
                  {form.link_kind === "custom" && (
                    <div>
                      <input
                        value={form.link_custom}
                        onChange={(e) => patch({ link_custom: e.target.value })}
                        placeholder="/producto/123  o  https://…"
                        aria-label="Dirección"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="field"
                      />
                      <p className="text-xs text-muted mt-1.5">
                        Para llevar a un producto, abre el producto en la tienda
                        y copia la parte de la dirección que empieza con
                        /producto/.
                      </p>
                    </div>
                  )}
                </div>

                {/* Color */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Color {currentImage ? "(solo si no hay imagen)" : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => patch({ theme: k })}
                        aria-pressed={form.theme === k}
                        className={`inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full border-2 text-sm font-medium transition ${
                          form.theme === k
                            ? "border-brand-strong bg-brand-soft"
                            : "border-line bg-white"
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full ${THEMES[k].swatch} border border-black/10`}
                        />
                        {THEMES[k].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fechas */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Programar (opcional)
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="p-from" className="text-xs text-muted mb-1 block">
                        Empieza
                      </label>
                      <input
                        id="p-from"
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={(e) => patch({ starts_at: e.target.value })}
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor="p-to" className="text-xs text-muted mb-1 block">
                        Termina
                      </label>
                      <input
                        id="p-to"
                        type="datetime-local"
                        value={form.ends_at}
                        onChange={(e) => patch({ ends_at: e.target.value })}
                        className="field"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    Déjalas vacías para que se muestre siempre. Al llegar la
                    fecha final desaparece sola.
                  </p>
                </div>

                <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => patch({ active: e.target.checked })}
                    className="w-4 h-4 accent-[#7e22ce]"
                  />
                  Mostrar en la tienda
                </label>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeForm}
                    disabled={saving}
                    className="btn-outline flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={save}
                    disabled={saving || photoBusy}
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
