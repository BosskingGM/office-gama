"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { revalidateStore } from "@/lib/revalidate-client";

/* =========================
   TIPOS Y CONSTANTES
========================= */

type DbVariant = {
  id: string;
  model_name: string | null;
  stock: number | null;
  image_url: string | null;
};

type DbProduct = {
  id: string;
  name: string;
  price: number | string;
  description: string | null;
  category: string | null;
  product_variants: DbVariant[] | null;
};

// Un modelo dentro del formulario. Todo producto tiene al menos uno:
// la tienda vende, cuenta stock y muestra la foto por modelo.
type VariantForm = {
  key: string;
  id: string | null; // null = modelo nuevo
  model_name: string;
  stock: string;
  imageBlob: Blob | null; // foto nueva ya reducida
  previewUrl: string | null; // vista previa de la foto nueva
  existingImageUrl: string | null; // foto que ya está guardada
};

type Notice = { kind: "ok" | "warn" | "error"; text: string };

const SINGLE_NAME = "Único";
const LOW_STOCK = 5;
const BUCKET = "products";

const CATEGORIES = [
  "Sacapuntas", "Libretas", "Washi Tapes", "Stickers", "Tintas", "Sellos",
  "Post It", "Plumones", "Folders", "Plumas", "Pegamento", "Extras",
  "Marca Textos", "Cutters", "Lapiceras", "Crayolas", "Lacre", "Gises",
  "Colores", "Correctores", "Juegos Geométricos", "Liquidación",
].sort((a, b) => a.localeCompare(b, "es"));

let keyCounter = 0;
const nextKey = () => `v${++keyCounter}`;

const emptyVariant = (name = ""): VariantForm => ({
  key: nextKey(),
  id: null,
  model_name: name,
  stock: "",
  imageBlob: null,
  previewUrl: null,
  existingImageUrl: null,
});

const money = (n: number | string) =>
  Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

/* =========================
   AYUDAS
========================= */

// Reduce la foto a máx. 1200 px y la convierte a JPG. Las fotos del celular
// pesan 5-10 MB; así la tienda carga rápido y la subida casi nunca falla.
async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "No se pudo leer esa imagen. Usa una foto JPG, PNG o WebP."
    );
  }

  const MAX = 1200;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");

  ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("No se pudo preparar la imagen.");
  return blob;
}

// Ruta del archivo dentro del bucket a partir de su URL pública.
function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

async function removeFiles(urls: (string | null)[]) {
  const paths = urls
    .map(storagePathFromUrl)
    .filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // Limpieza opcional: si falla, solo queda un archivo huérfano.
  }
}

const sortVariants = (list: DbVariant[]) =>
  [...list].sort((a, b) =>
    (a.model_name ?? "").localeCompare(b.model_name ?? "", "es", {
      numeric: true,
    })
  );

function productFlags(p: DbProduct) {
  const vs = p.product_variants ?? [];
  const noModels = vs.length === 0;
  const total = vs.reduce((acc, v) => acc + (v.stock ?? 0), 0);
  const soldOut = !noModels && total === 0;
  const low =
    !noModels && !soldOut && vs.some((v) => (v.stock ?? 0) <= LOW_STOCK);
  const noPhoto = noModels || vs.some((v) => !v.image_url);
  return { vs, noModels, total, soldOut, low, noPhoto };
}

/* =========================
   PÁGINA
========================= */

export default function InventarioPage() {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [chip, setChip] = useState<
    "todos" | "bajo" | "agotado" | "sinfoto" | "sinmodelos"
  >("todos");

  // Panel de edición
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [multi, setMulti] = useState(false);
  const [variants, setVariants] = useState<VariantForm[]>([emptyVariant()]);
  const [removed, setRemoved] = useState<{ id: string; label: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  // Eliminar
  const [toDelete, setToDelete] = useState<DbProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const previewsRef = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  /* ---------- Carga ---------- */

  const loadProducts = useCallback(async () => {
    setLoadingList(true);
    setLoadError("");

    const cols =
      "id, name, price, description, category, product_variants ( id, model_name, stock, image_url )";

    // Intenta ordenar por fecha; si la tabla no tiene esa columna, ordena por nombre.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let res: any = await supabase
      .from("products")
      .select(`${cols}, created_at`)
      .order("created_at", { ascending: false });

    if (res.error) {
      res = await supabase.from("products").select(cols).order("name");
    }

    if (res.error) {
      setLoadError(`No se pudieron cargar los productos: ${res.error.message}`);
      setProducts([]);
    } else {
      setProducts((res.data ?? []) as DbProduct[]);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  /* ---------- Vistas previas ---------- */

  const makePreview = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    previewsRef.current.add(url);
    return url;
  };

  const dropPreview = (url: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewsRef.current.delete(url);
  };

  const dropAllPreviews = () => {
    previewsRef.current.forEach((u) => URL.revokeObjectURL(u));
    previewsRef.current.clear();
  };

  useEffect(() => () => dropAllPreviews(), []);

  /* ---------- Abrir y cerrar el panel ---------- */

  const resetForm = () => {
    dropAllPreviews();
    setEditingId(null);
    setName("");
    setPrice("");
    setCategory("");
    setDescription("");
    setMulti(false);
    setVariants([emptyVariant()]);
    setRemoved([]);
    setSubmitted(false);
    setFormError("");
    setPhotoError({});
    setPhotoBusy(null);
    setDirty(false);
  };

  const openNew = () => {
    resetForm();
    setPanelOpen(true);
  };

  const openEdit = (p: DbProduct) => {
    resetForm();
    setEditingId(p.id);
    setName(p.name ?? "");
    setPrice(p.price != null ? String(p.price) : "");
    setCategory(p.category ?? "");
    setDescription(p.description ?? "");

    const vs = sortVariants(p.product_variants ?? []);
    const single =
      vs.length === 0 ||
      (vs.length === 1 &&
        (!vs[0].model_name || vs[0].model_name === SINGLE_NAME));

    setMulti(!single);
    setVariants(
      vs.length === 0
        ? [emptyVariant()]
        : vs.map((v) => ({
            key: nextKey(),
            id: v.id,
            model_name: v.model_name ?? "",
            stock: String(v.stock ?? 0),
            imageBlob: null,
            previewUrl: null,
            existingImageUrl: v.image_url,
          }))
    );
    setPanelOpen(true);
  };

  const closePanel = useCallback(
    (force = false) => {
      if (!force && dirty && !saving) {
        if (!confirm("Tienes cambios sin guardar. ¿Cerrar de todos modos?")) {
          return;
        }
      }
      setPanelOpen(false);
      resetForm();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dirty, saving]
  );

  // Escape cierra el panel, y la página de atrás no se desplaza mientras está abierto.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) closePanel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [panelOpen, saving, closePanel]);

  /* ---------- Edición de modelos ---------- */

  const touch = () => setDirty(true);

  const updateVariant = (key: string, patch: Partial<VariantForm>) => {
    touch();
    setVariants((list) =>
      list.map((v) => (v.key === key ? { ...v, ...patch } : v))
    );
  };

  const addVariant = () => {
    touch();
    setVariants((list) => [...list, emptyVariant()]);
  };

  const removeVariant = (v: VariantForm) => {
    touch();
    dropPreview(v.previewUrl);
    if (v.id) {
      setRemoved((r) => [
        ...r,
        { id: v.id as string, label: v.model_name || SINGLE_NAME },
      ]);
    }
    setVariants((list) => list.filter((x) => x.key !== v.key));
  };

  const chooseMode = (wantMulti: boolean) => {
    if (wantMulti === multi) return;
    touch();
    if (wantMulti) {
      // El único modelo pasa a ser el primero de la lista y se le pide nombre.
      setVariants((list) =>
        list.map((v, i) =>
          i === 0 && v.model_name === SINGLE_NAME
            ? { ...v, model_name: "" }
            : v
        )
      );
      setMulti(true);
    } else {
      setMulti(false);
      setVariants((list) =>
        list.slice(0, 1).map((v) => ({ ...v, model_name: SINGLE_NAME }))
      );
    }
  };

  const pickPhoto = async (v: VariantForm, file: File | null) => {
    if (!file) return;
    setPhotoError((e) => ({ ...e, [v.key]: "" }));
    setPhotoBusy(v.key);
    try {
      const blob = await prepareImage(file);
      dropPreview(v.previewUrl);
      updateVariant(v.key, { imageBlob: blob, previewUrl: makePreview(blob) });
    } catch (err) {
      setPhotoError((e) => ({
        ...e,
        [v.key]: err instanceof Error ? err.message : "No se pudo usar la foto.",
      }));
    } finally {
      setPhotoBusy(null);
    }
  };

  /* ---------- Validación ---------- */

  const errors = useMemo(() => {
    const out = {
      name: "",
      price: "",
      category: "",
      variants: {} as Record<
        string,
        { model?: string; stock?: string; photo?: string }
      >,
      general: "",
      count: 0,
    };

    if (!name.trim()) out.name = "Escribe el nombre del producto.";
    const p = Number(price);
    if (!price.trim() || !Number.isFinite(p) || p <= 0) {
      out.price = "Escribe un precio mayor a 0.";
    }
    if (!category) out.category = "Elige una categoría.";

    if (variants.length === 0) {
      out.general = "Agrega al menos un modelo.";
    }

    const seen = new Set<string>();
    for (const v of variants) {
      const e: { model?: string; stock?: string; photo?: string } = {};
      const label = v.model_name.trim().toLowerCase();

      if (multi) {
        if (!label) e.model = "Ponle nombre al modelo.";
        else if (seen.has(label)) e.model = "Ya hay otro modelo con ese nombre.";
        seen.add(label);
      }
      if (!/^\d+$/.test(v.stock.trim())) {
        e.stock = "Escribe las piezas (0 si no hay).";
      }
      if (!v.imageBlob && !v.existingImageUrl) {
        e.photo = "Falta la foto.";
      }
      if (e.model || e.stock || e.photo) out.variants[v.key] = e;
    }

    out.count =
      (out.name ? 1 : 0) +
      (out.price ? 1 : 0) +
      (out.category ? 1 : 0) +
      (out.general ? 1 : 0) +
      Object.keys(out.variants).length;
    return out;
  }, [name, price, category, variants, multi]);

  /* ---------- Guardar ---------- */

  const handleSave = async () => {
    setSubmitted(true);
    setFormError("");
    if (errors.count > 0) {
      setFormError("Revisa los campos marcados en rojo.");
      return;
    }

    setSaving(true);
    const uploaded: string[] = []; // fotos subidas en este intento (para deshacer)
    let createdProductId: string | null = null;
    const warnings: string[] = [];

    try {
      // 1. Subir fotos nuevas
      const urls: Record<string, string> = {};
      for (const v of variants) {
        if (!v.imageBlob) continue;
        const path = `${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, v.imageBlob, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
          });
        if (error) {
          throw new Error(
            `No se pudo subir la foto de "${v.model_name || SINGLE_NAME}": ${error.message}`
          );
        }
        uploaded.push(path);
        urls[v.key] = supabase.storage.from(BUCKET).getPublicUrl(path).data
          .publicUrl;
      }

      // 2. Producto
      const productData = {
        name: name.trim(),
        price: Number(price),
        description: description.trim(),
        category,
      };

      let productId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingId);
        if (error) {
          throw new Error(`No se pudo guardar el producto: ${error.message}`);
        }
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();
        if (error || !data) {
          throw new Error(
            `No se pudo crear el producto: ${error?.message ?? "sin respuesta"}`
          );
        }
        productId = data.id as string;
        createdProductId = productId;
      }

      // 3. Modelos
      const rows = variants.map((v) => ({
        v,
        data: {
          model_name: multi ? v.model_name.trim() : SINGLE_NAME,
          stock: parseInt(v.stock.trim(), 10),
          image_url: urls[v.key] ?? v.existingImageUrl,
        },
      }));

      const fresh = rows.filter((r) => !r.v.id);
      if (fresh.length > 0) {
        const { error } = await supabase
          .from("product_variants")
          .insert(fresh.map((r) => ({ product_id: productId, ...r.data })));
        if (error) {
          throw new Error(`No se pudieron guardar los modelos: ${error.message}`);
        }
      }

      for (const r of rows.filter((x) => x.v.id)) {
        const { error } = await supabase
          .from("product_variants")
          .update(r.data)
          .eq("id", r.v.id as string);
        if (error) {
          throw new Error(
            `No se pudo actualizar el modelo "${r.data.model_name}": ${error.message}`
          );
        }
      }

      // 4. Modelos quitados (solo ahora, ya con todo lo demás guardado)
      for (const r of removed) {
        const { error } = await supabase
          .from("product_variants")
          .delete()
          .eq("id", r.id);
        if (error) {
          // Casi siempre es porque ya tiene pedidos: se deja en 0 piezas.
          await supabase
            .from("product_variants")
            .update({ stock: 0 })
            .eq("id", r.id);
          warnings.push(
            `El modelo "${r.label}" ya tiene pedidos y no se puede borrar; quedó con 0 piezas (Agotado).`
          );
        }
      }

      // 5. Limpiar fotos que ya no se usan (opcional, no bloquea nada)
      const orphan = rows
        .filter((r) => r.v.imageBlob && r.v.existingImageUrl)
        .map((r) => r.v.existingImageUrl);
      if (orphan.length > 0) await removeFiles(orphan);

      dropAllPreviews();
      setPanelOpen(false);
      resetForm();
      await revalidateStore();
      await loadProducts();

      setNotice(
        warnings.length > 0
          ? { kind: "warn", text: `Guardado. ${warnings.join(" ")}` }
          : {
              kind: "ok",
              text: editingId ? "Producto actualizado." : "Producto creado.",
            }
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      // Si el producto era nuevo y algo falló, no se deja a medias.
      if (createdProductId) {
        await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", createdProductId);
        await supabase.from("products").delete().eq("id", createdProductId);
      }
      if (uploaded.length > 0) {
        try {
          await supabase.storage.from(BUCKET).remove(uploaded);
        } catch {
          /* nada */
        }
      }
      setFormError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar. Intenta de nuevo."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Eliminar ---------- */

  const askDelete = (p: DbProduct) => {
    setToDelete(p);
    setDeleteMsg("");
    setDeleteBlocked(false);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteMsg("");

    try {
      const vs = toDelete.product_variants ?? [];
      const ids = vs.map((v) => v.id);

      if (ids.length > 0) {
        const { count, error } = await supabase
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .in("variant_id", ids);

        if (error) {
          throw new Error(`No se pudo revisar los pedidos: ${error.message}`);
        }
        if ((count ?? 0) > 0) {
          setDeleteBlocked(true);
          setDeleteMsg(
            `Este producto ya aparece en ${count} ${
              count === 1 ? "artículo de pedido" : "artículos de pedidos"
            }. Si lo borras se pierde el historial. Lo mejor es dejarlo agotado.`
          );
          return;
        }

        const { error: vErr } = await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", toDelete.id);
        if (vErr) {
          throw new Error(`No se pudieron borrar los modelos: ${vErr.message}`);
        }
      }

      const { error: pErr } = await supabase
        .from("products")
        .delete()
        .eq("id", toDelete.id);
      if (pErr) {
        throw new Error(`No se pudo borrar el producto: ${pErr.message}`);
      }

      await removeFiles(vs.map((v) => v.image_url));
      const gone = toDelete.name;
      setToDelete(null);
      await revalidateStore();
      await loadProducts();
      setNotice({ kind: "ok", text: `Se eliminó "${gone}".` });
    } catch (err) {
      setDeleteMsg(
        err instanceof Error ? err.message : "No se pudo eliminar el producto."
      );
    } finally {
      setDeleting(false);
    }
  };

  const soldOutInstead = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error } = await supabase
      .from("product_variants")
      .update({ stock: 0 })
      .eq("product_id", toDelete.id);
    setDeleting(false);

    if (error) {
      setDeleteMsg(`No se pudo dejar agotado: ${error.message}`);
      return;
    }
    const nm = toDelete.name;
    setToDelete(null);
    await revalidateStore();
      await loadProducts();
    setNotice({ kind: "ok", text: `"${nm}" quedó agotado.` });
  };

  /* ---------- Lista filtrada ---------- */

  const counts = useMemo(() => {
    const c = { bajo: 0, agotado: 0, sinfoto: 0, sinmodelos: 0 };
    for (const p of products) {
      const f = productFlags(p);
      if (f.low) c.bajo++;
      if (f.soldOut) c.agotado++;
      if (f.noPhoto && !f.noModels) c.sinfoto++;
      if (f.noModels) c.sinmodelos++;
    }
    return c;
  }, [products]);

  const filtered = useMemo(() => {
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = norm(search.trim());

    return products.filter((p) => {
      if (q && !norm(p.name ?? "").includes(q)) return false;
      if (filterCategory && p.category !== filterCategory) return false;

      const f = productFlags(p);
      if (chip === "bajo") return f.low;
      if (chip === "agotado") return f.soldOut;
      if (chip === "sinfoto") return f.noPhoto && !f.noModels;
      if (chip === "sinmodelos") return f.noModels;
      return true;
    });
  }, [products, search, filterCategory, chip]);

  const chips: { id: typeof chip; label: string; n: number | null }[] = [
    { id: "todos", label: "Todos", n: products.length },
    { id: "bajo", label: "Poco stock", n: counts.bajo },
    { id: "agotado", label: "Agotados", n: counts.agotado },
    { id: "sinfoto", label: "Sin foto", n: counts.sinfoto },
    { id: "sinmodelos", label: "Sin modelos", n: counts.sinmodelos },
  ];

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Inventario</h1>
          <p className="text-sm text-muted mt-1">
            {loadingList
              ? "Cargando…"
              : `${products.length} ${
                  products.length === 1 ? "producto" : "productos"
                }`}
          </p>
        </div>
        <button type="button" onClick={openNew} className="btn-primary">
          <Plus size={18} aria-hidden="true" />
          Nuevo producto
        </button>
      </div>

      {/* Aviso */}
      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "bg-green-50 border-green-200 text-green-900"
              : notice.kind === "warn"
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto"
              aria-label="Buscar producto"
              className="field !pl-10"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filtrar por categoría"
            className="field sm:!w-56"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {chips
            .filter((c) => c.id === "todos" || (c.n ?? 0) > 0 || chip === c.id)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChip(c.id)}
                aria-pressed={chip === c.id}
                className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-medium transition ${
                  chip === c.id
                    ? "bg-brand border-brand text-ink"
                    : "bg-white border-line hover:border-brand"
                }`}
              >
                {c.label}
                <span className="ml-1.5 text-muted">{c.n}</span>
              </button>
            ))}
        </div>
      </div>

      {/* Lista */}
      {loadError ? (
        <div className="card p-6 text-sm text-danger flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={loadProducts} className="btn-outline">
            Reintentar
          </button>
        </div>
      ) : loadingList ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[84px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <p className="font-semibold">
            {products.length === 0
              ? "Aún no hay productos"
              : "Ningún producto coincide con los filtros"}
          </p>
          {products.length === 0 && (
            <button type="button" onClick={openNew} className="btn-primary">
              Crear el primero
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const f = productFlags(p);
            const thumb = f.vs.find((v) => v.image_url)?.image_url;
            return (
              <li
                key={p.id}
                className="card p-3 sm:p-4 flex items-center gap-3 sm:gap-4"
              >
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0 rounded-xl overflow-hidden bg-brand-soft grid place-items-center text-neutral-400">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageOff size={22} aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-sm text-muted truncate">
                    {p.category || "Sin categoría"} · {money(p.price)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {f.noModels ? (
                      <span className="text-danger font-medium">
                        Sin modelos: no se puede comprar
                      </span>
                    ) : (
                      <span
                        className={
                          f.soldOut
                            ? "text-danger font-medium"
                            : f.low
                            ? "text-brand-strong font-medium"
                            : "text-secondary"
                        }
                      >
                        {f.soldOut
                          ? "Agotado"
                          : `${f.total} ${f.total === 1 ? "pieza" : "piezas"}`}
                        {f.vs.length > 1 && ` en ${f.vs.length} modelos`}
                        {f.low && " · hay modelos con poco stock"}
                      </span>
                    )}
                    {f.noPhoto && !f.noModels && (
                      <span className="text-danger font-medium">
                        Falta foto
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="btn-outline !px-3.5 !py-2 text-sm"
                    aria-label={`Editar ${p.name}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => askDelete(p)}
                    aria-label={`Eliminar ${p.name}`}
                    className="p-2.5 rounded-full text-muted hover:text-danger hover:bg-red-50 transition"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* =========================
          PANEL DE PRODUCTO
      ========================= */}
      {panelOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => !saving && closePanel()}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
            className="absolute right-0 top-0 h-full w-full sm:max-w-xl bg-white shadow-2xl flex flex-col animate-slide-in-right focus:outline-none"
          >
            <header className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-b border-line">
              <h2 id="panel-title" className="text-xl font-extrabold">
                {editingId ? "Editar producto" : "Nuevo producto"}
              </h2>
              <button
                type="button"
                onClick={() => closePanel()}
                disabled={saving}
                aria-label="Cerrar"
                className="p-2 rounded-full hover:bg-neutral-100 disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-6 space-y-7">
              {/* Datos */}
              <section className="space-y-4">
                <Field label="Nombre" error={submitted ? errors.name : ""}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      touch();
                      setName(e.target.value);
                    }}
                    className="field"
                    autoComplete="off"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Precio (MXN)"
                    error={submitted ? errors.price : ""}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => {
                        touch();
                        setPrice(e.target.value);
                      }}
                      className="field"
                    />
                  </Field>

                  <Field
                    label="Categoría"
                    error={submitted ? errors.category : ""}
                  >
                    <select
                      value={category}
                      onChange={(e) => {
                        touch();
                        setCategory(e.target.value);
                      }}
                      className="field"
                    >
                      <option value="">Elegir…</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Descripción (opcional)">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => {
                      touch();
                      setDescription(e.target.value);
                    }}
                    className="field resize-y"
                  />
                </Field>
              </section>

              {/* Modelos */}
              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold">Fotos y existencias</h3>
                  <p className="text-sm text-muted mt-0.5">
                    Cada modelo lleva su foto y sus piezas disponibles.
                  </p>
                </div>

                <div
                  role="group"
                  aria-label="Tipo de producto"
                  className="grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1"
                >
                  <button
                    type="button"
                    aria-pressed={!multi}
                    disabled={variants.length > 1}
                    title={
                      variants.length > 1
                        ? "Quita los modelos extra para volver a un solo modelo"
                        : undefined
                    }
                    onClick={() => chooseMode(false)}
                    className={`rounded-full py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      !multi ? "bg-white shadow-sm" : "text-muted"
                    }`}
                  >
                    Un solo modelo
                  </button>
                  <button
                    type="button"
                    aria-pressed={multi}
                    onClick={() => chooseMode(true)}
                    className={`rounded-full py-2 text-sm font-semibold transition ${
                      multi ? "bg-white shadow-sm" : "text-muted"
                    }`}
                  >
                    Varios modelos
                  </button>
                </div>

                {errors.general && submitted && (
                  <p className="text-sm text-danger">{errors.general}</p>
                )}

                <div className="space-y-4">
                  {variants.map((v, i) => {
                    const e = submitted ? errors.variants[v.key] : undefined;
                    const shown = v.previewUrl ?? v.existingImageUrl;
                    const inputId = `photo-${v.key}`;
                    return (
                      <div
                        key={v.key}
                        className="rounded-2xl border border-line bg-soft p-4"
                      >
                        <div className="flex gap-4">
                          {/* Foto */}
                          <div className="shrink-0">
                            <input
                              id={inputId}
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(ev) => {
                                pickPhoto(v, ev.target.files?.[0] ?? null);
                                ev.target.value = "";
                              }}
                            />
                            <label
                              htmlFor={inputId}
                              className={`relative grid place-items-center w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden cursor-pointer text-center transition border-2 ${
                                shown
                                  ? "border-transparent"
                                  : e?.photo
                                  ? "border-dashed border-danger bg-red-50"
                                  : "border-dashed border-brand bg-white hover:bg-brand-soft"
                              }`}
                            >
                              {shown ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={shown}
                                  alt={`Foto de ${
                                    v.model_name || name || "producto"
                                  }`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="flex flex-col items-center gap-1 px-2 text-xs font-medium text-brand-strong">
                                  <ImagePlus size={24} aria-hidden="true" />
                                  Agregar foto
                                </span>
                              )}
                              {photoBusy === v.key && (
                                <span className="absolute inset-0 grid place-items-center bg-white/80">
                                  <Loader2
                                    size={22}
                                    className="animate-spin text-brand-strong"
                                    aria-label="Procesando foto"
                                  />
                                </span>
                              )}
                            </label>
                            {shown && (
                              <label
                                htmlFor={inputId}
                                className="mt-1.5 block text-center text-xs font-medium text-brand-strong cursor-pointer hover:underline"
                              >
                                Cambiar foto
                              </label>
                            )}
                          </div>

                          {/* Datos del modelo */}
                          <div className="flex-1 min-w-0 space-y-3">
                            {multi && (
                              <Field
                                label={`Modelo ${i + 1}`}
                                error={e?.model}
                              >
                                <input
                                  type="text"
                                  value={v.model_name}
                                  onChange={(ev) =>
                                    updateVariant(v.key, {
                                      model_name: ev.target.value,
                                    })
                                  }
                                  placeholder="Ej. Rosa, Gato, 0.5 mm"
                                  className="field"
                                  autoComplete="off"
                                />
                              </Field>
                            )}
                            <Field label="Piezas disponibles" error={e?.stock}>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                step="1"
                                value={v.stock}
                                onChange={(ev) =>
                                  updateVariant(v.key, {
                                    stock: ev.target.value,
                                  })
                                }
                                className="field"
                              />
                            </Field>
                          </div>
                        </div>

                        {(e?.photo || photoError[v.key]) && (
                          <p className="mt-2 text-sm text-danger" role="alert">
                            {photoError[v.key] || e?.photo}
                          </p>
                        )}

                        {multi && variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariant(v)}
                            className="mt-3 text-sm font-medium text-muted hover:text-danger inline-flex items-center gap-1.5"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Quitar este modelo
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {multi && (
                  <button
                    type="button"
                    onClick={addVariant}
                    className="btn-outline w-full"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Agregar otro modelo
                  </button>
                )}

                {removed.length > 0 && (
                  <p className="text-xs text-muted">
                    Se quitará al guardar:{" "}
                    {removed.map((r) => r.label).join(", ")}.
                  </p>
                )}
              </section>
            </div>

            <footer className="border-t border-line px-5 sm:px-7 py-4 space-y-3 bg-white">
              {formError && (
                <p
                  role="alert"
                  className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
                >
                  {formError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => closePanel()}
                  disabled={saving}
                  className="btn-outline"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || photoBusy !== null}
                  className="btn-primary flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Guardando…
                    </>
                  ) : editingId ? (
                    "Guardar cambios"
                  ) : (
                    "Crear producto"
                  )}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* =========================
          CONFIRMAR ELIMINAR
      ========================= */}
      {toDelete && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => !deleting && setToDelete(null)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-title"
            className="relative card p-6 w-full max-w-md space-y-4"
          >
            <h2 id="del-title" className="text-lg font-extrabold">
              {deleteBlocked ? "No se puede eliminar" : "¿Eliminar producto?"}
            </h2>
            <p className="text-sm text-secondary">
              {deleteBlocked ? (
                deleteMsg
              ) : (
                <>
                  Se borrará <strong>{toDelete.name}</strong> con todos sus
                  modelos y fotos. Esta acción no se puede deshacer.
                </>
              )}
            </p>
            {!deleteBlocked && deleteMsg && (
              <p
                role="alert"
                className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5"
              >
                {deleteMsg}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="btn-outline"
              >
                Cancelar
              </button>
              {deleteBlocked ? (
                <button
                  type="button"
                  onClick={soldOutInstead}
                  disabled={deleting}
                  className="btn-dark"
                >
                  {deleting ? "Guardando…" : "Dejarlo agotado"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="btn-dark !bg-danger hover:!bg-red-700"
                >
                  {deleting ? "Eliminando…" : "Sí, eliminar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   CAMPO CON ETIQUETA Y ERROR
========================= */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      <div className={error ? "[&>.field]:!border-danger" : ""}>{children}</div>
      {error && (
        <span role="alert" className="block text-sm text-danger mt-1.5">
          {error}
        </span>
      )}
    </label>
  );
}
