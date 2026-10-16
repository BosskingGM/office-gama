"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { revalidateStore } from "@/lib/revalidate-client";

/* =========================================================
   Exportar inventario a Excel + carga masiva desde Excel.
   Una fila = un modelo. Los productos con varios modelos
   repiten el nombre en cada fila.
========================================================= */

type Variant = {
  id: string;
  model_name: string | null;
  stock: number | null;
  image_url: string | null;
};
type Product = {
  id: string;
  name: string;
  price: number | string;
  description: string | null;
  category: string | null;
  product_variants: Variant[] | null;
};

const SINGLE_NAME = "Único";
const SHEET = "Productos";
const MAX_ROWS = 2000;

const COLS = [
  { key: "pid", header: "ID producto", width: 14, hint: "NO LO CAMBIES. Déjalo vacío si el producto es nuevo." },
  { key: "name", header: "Nombre *", width: 38, hint: "Nombre del producto. Obligatorio." },
  { key: "category", header: "Categoría *", width: 20, hint: "Elige de la lista." },
  { key: "price", header: "Precio *", width: 12, hint: "Número, ej. 45.50 (sin $)." },
  { key: "description", header: "Descripción", width: 40, hint: "Opcional." },
  { key: "model", header: "Modelo", width: 22, hint: "Color o diseño. Vacío = \"Único\" (solo si el producto tiene 1 modelo)." },
  { key: "stock", header: "Stock *", width: 10, hint: "Piezas disponibles (0 si no hay)." },
  { key: "photo", header: "URL foto", width: 36, hint: "Opcional. Enlace https:// de la imagen. Vacío = no cambia la foto." },
  { key: "vid", header: "ID modelo", width: 14, hint: "NO LO CAMBIES. Déjalo vacío si el modelo es nuevo." },
] as const;
type ColKey = (typeof COLS)[number]["key"];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- celdas de Excel → texto ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v.richText))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return v.richText.map((r: any) => r.text).join("").trim();
    if ("result" in v) return cellText(v.result);
    if ("text" in v) return cellText(v.text);
    if ("hyperlink" in v) return String(v.hyperlink).trim();
    return "";
  }
  return String(v).trim();
}

function parseNumber(s: string): number | null {
  const clean = s.replace(/[$\s,]/g, "");
  if (!clean || !/^\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

function download(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- construir el libro ---------- */

async function buildWorkbook(products: Product[], categories: string[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Office GaMa";

  const ws = wb.addWorksheet(SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((cell, i) => {
    const isId = COLS[i - 1].key === "pid" || COLS[i - 1].key === "vid";
    cell.font = { bold: true, color: { argb: isId ? "FF6B7280" : "FF1A1523" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isId ? "FFE5E7EB" : "FFD6A8FF" },
    };
    cell.alignment = { vertical: "middle" };
    cell.note = COLS[i - 1].hint;
  });

  // Datos actuales (una fila por modelo)
  for (const p of products) {
    const vs = p.product_variants ?? [];
    const base = {
      pid: p.id,
      name: p.name,
      category: p.category ?? "",
      price: Number(p.price),
      description: p.description ?? "",
    };
    if (vs.length === 0) {
      ws.addRow({ ...base, model: "", stock: 0, photo: "", vid: "" });
    } else {
      for (const v of vs) {
        ws.addRow({
          ...base,
          model: v.model_name ?? "",
          stock: v.stock ?? 0,
          photo: v.image_url ?? "",
          vid: v.id,
        });
      }
    }
  }

  // Formato y listas desplegables (hasta la fila 2000)
  const lists = wb.addWorksheet("Listas", { state: "hidden" });
  categories.forEach((c, i) => (lists.getCell(i + 1, 1).value = c));
  const catCol = COLS.findIndex((c) => c.key === "category") + 1;
  const priceCol = COLS.findIndex((c) => c.key === "price") + 1;
  const stockCol = COLS.findIndex((c) => c.key === "stock") + 1;
  for (let r = 2; r <= MAX_ROWS + 1; r++) {
    ws.getCell(r, catCol).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`Listas!$A$1:$A$${categories.length}`],
      showErrorMessage: true,
      errorTitle: "Categoría",
      error: "Elige una categoría de la lista.",
    };
    ws.getCell(r, priceCol).dataValidation = {
      type: "decimal",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      error: "Escribe un número (sin $).",
    };
    ws.getCell(r, stockCol).dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      error: "Escribe un número entero (0 si no hay).",
    };
    ws.getCell(r, priceCol).numFmt = "0.00";
  }
  ws.autoFilter = { from: "A1", to: { row: 1, column: COLS.length } };

  // Instrucciones
  const ins = wb.addWorksheet("Instrucciones");
  ins.columns = [{ width: 22 }, { width: 90 }];
  const lines: [string, string][] = [
    ["CÓMO USAR ESTE ARCHIVO", ""],
    ["", "Cada fila es UN MODELO (color o diseño) de un producto. Si un producto tiene 3 modelos, escribe 3 filas con el mismo nombre, categoría, precio y descripción."],
    ["", "Las columnas con * son obligatorias."],
    ["", ""],
    ["COLUMNA", "QUÉ PONER"],
    ...COLS.map((c) => [c.header, c.hint] as [string, string]),
    ["", ""],
    ["PRODUCTO NUEVO", "Deja vacíos ID producto e ID modelo. Llena nombre, categoría, precio, modelo (si tiene varios) y stock."],
    ["ACTUALIZAR", "Exporta el inventario, cambia precios/stock/etc. y vuelve a subirlo. No toques las columnas gris (ID producto / ID modelo): con ellas el sistema sabe qué actualizar."],
    ["PRECIO / CATEGORÍA", "En un producto con varios modelos, el precio y la categoría deben ser iguales en todas sus filas: si los cambias, cámbialos en todas."],
    ["MODELO NUEVO", "Agrega una fila con el mismo ID producto (o el mismo nombre) y deja vacío ID modelo."],
    ["ELIMINAR", "La carga masiva NUNCA borra nada. Para eliminar o dejar sin existencias, hazlo desde el inventario."],
    ["FOTOS", "Opcional. Pega el enlace https:// de la imagen. También puedes agregar o cambiar fotos después desde Editar producto."],
    ["", ""],
    ["EJEMPLO", ""],
    ["Producto con 1 modelo", "Nombre: Sacapuntas gatito | Categoría: Sacapuntas | Precio: 25 | Modelo: (vacío) | Stock: 40"],
    ["Producto con 2 modelos", "Fila 1: Libreta flores | Libretas | 60 | Modelo: Rosa | Stock: 10    →    Fila 2: Libreta flores | Libretas | 60 | Modelo: Azul | Stock: 8"],
  ];
  lines.forEach((l, i) => {
    const row = ins.addRow(l);
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    if (i === 0 || l[0] === "COLUMNA" || l[0] === "EJEMPLO") row.font = { bold: true };
  });

  return wb;
}

/* ---------- leer el Excel subido ---------- */

type PlanVariant = {
  vid: string | null;
  model_name: string;
  stock: number;
  photo: string | null;
  row: number;
};
type PlanProduct = {
  pid: string | null;
  name: string;
  category: string;
  price: number;
  description: string | null;
  variants: PlanVariant[];
};
type Plan = {
  products: PlanProduct[];
  errors: string[];
  newProducts: number;
  updProducts: number;
  newVariants: number;
  updVariants: number;
};

async function parseFile(
  file: File,
  products: Product[],
  categories: string[]
): Promise<Plan> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(SHEET) ?? wb.worksheets[0];
  const errors: string[] = [];
  const empty: Plan = { products: [], errors, newProducts: 0, updProducts: 0, newVariants: 0, updVariants: 0 };
  if (!ws) {
    errors.push("El archivo no tiene hojas.");
    return empty;
  }

  // Encabezados → columna
  const colOf: Partial<Record<ColKey, number>> = {};
  const headRow = ws.getRow(1);
  headRow.eachCell((cell, i) => {
    const h = norm(cellText(cell.value));
    const c = COLS.find((x) => norm(x.header) === h);
    if (c) colOf[c.key] = i;
  });
  const missing = COLS.filter(
    (c) => ["name", "category", "price", "stock"].includes(c.key) && !colOf[c.key]
  );
  if (missing.length) {
    errors.push(
      `Faltan columnas: ${missing.map((m) => m.header).join(", ")}. Usa la plantilla o el archivo exportado.`
    );
    return empty;
  }

  const get = (row: ReturnType<typeof ws.getRow>, k: ColKey) =>
    colOf[k] ? cellText(row.getCell(colOf[k]!).value) : "";

  const catMap = new Map(categories.map((c) => [norm(c), c]));
  const byId = new Map(products.map((p) => [p.id, p]));

  type Row = { n: number; pid: string; name: string; category: string; price: string; description: string; model: string; stock: string; photo: string; vid: string };
  const rows: Row[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const r: Row = {
      n,
      pid: get(row, "pid"),
      name: get(row, "name"),
      category: get(row, "category"),
      price: get(row, "price"),
      description: get(row, "description"),
      model: get(row, "model"),
      stock: get(row, "stock"),
      photo: get(row, "photo"),
      vid: get(row, "vid"),
    };
    if (Object.entries(r).some(([k, v]) => k !== "n" && v !== "")) rows.push(r);
  });

  if (rows.length === 0) {
    errors.push("No hay filas con datos para cargar.");
    return empty;
  }
  if (rows.length > MAX_ROWS) {
    errors.push(`Máximo ${MAX_ROWS} filas por carga (el archivo trae ${rows.length}).`);
    return empty;
  }

  // Agrupar filas por producto
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    let key: string;
    if (r.pid) key = `id:${r.pid}`;
    else if (r.name) key = `n:${norm(r.name)}`;
    else {
      errors.push(`Fila ${r.n}: falta el nombre del producto.`);
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const plan: Plan = { ...empty, products: [] };

  for (const [, g] of groups) {
    const first = g[0];
    const pid = first.pid || null;
    const existing = pid ? byId.get(pid) : undefined;
    if (pid && !existing) {
      errors.push(`Fila ${first.n}: el ID de producto "${pid}" no existe. Déjalo vacío si es un producto nuevo.`);
      continue;
    }

    const name = (first.name || existing?.name || "").trim();
    if (!name) {
      errors.push(`Fila ${first.n}: falta el nombre.`);
      continue;
    }
    const catRaw = first.category || existing?.category || "";
    const category = catMap.get(norm(catRaw));
    if (!category) {
      errors.push(`Fila ${first.n}: la categoría "${catRaw}" no es válida. Elige una de la lista.`);
      continue;
    }
    const price = first.price !== "" ? parseNumber(first.price) : existing ? Number(existing.price) : null;
    if (price === null) {
      errors.push(`Fila ${first.n}: el precio "${first.price}" no es un número válido.`);
      continue;
    }
    // Mismo precio/categoría en todas las filas del producto
    let conflict = false;
    for (const r of g.slice(1)) {
      const p2: number | null = r.price !== "" ? parseNumber(r.price) : price;
      const c2: string | undefined = r.category ? catMap.get(norm(r.category)) : category;
      if (p2 !== price || c2 !== category) {
        errors.push(`Fila ${r.n}: el precio o la categoría no coincide con las otras filas de "${name}".`);
        conflict = true;
      }
    }
    if (conflict) continue;

    const variants: PlanVariant[] = [];
    const seen = new Set<string>();
    let bad = false;
    for (const r of g) {
      const stock = /^\d+$/.test(r.stock) ? parseInt(r.stock, 10) : NaN;
      if (Number.isNaN(stock)) {
        errors.push(`Fila ${r.n}: el stock "${r.stock}" debe ser un número entero (0 si no hay).`);
        bad = true;
        continue;
      }
      let model = r.model.trim();
      if (!model) {
        if (g.length > 1) {
          errors.push(`Fila ${r.n}: "${name}" tiene varios modelos, escribe el nombre del modelo.`);
          bad = true;
          continue;
        }
        model = SINGLE_NAME;
      }
      if (seen.has(norm(model))) {
        errors.push(`Fila ${r.n}: el modelo "${model}" está repetido en "${name}".`);
        bad = true;
        continue;
      }
      seen.add(norm(model));

      let vid: string | null = r.vid || null;
      if (vid && !existing?.product_variants?.some((v) => v.id === vid)) {
        errors.push(`Fila ${r.n}: el ID de modelo "${vid}" no pertenece a ese producto.`);
        bad = true;
        continue;
      }
      // Sin ID pero ya existe un modelo con ese nombre: actualiza ese, no lo duplica
      if (!vid && existing) {
        const same = existing.product_variants?.find((v) => norm(v.model_name ?? "") === norm(model));
        if (same) vid = same.id;
      }
      if (r.photo && !/^https:\/\//i.test(r.photo)) {
        errors.push(`Fila ${r.n}: la URL de la foto debe empezar con https://`);
        bad = true;
        continue;
      }
      variants.push({ vid, model_name: model, stock, photo: r.photo || null, row: r.n });
    }
    if (bad) continue;

    plan.products.push({
      pid: existing ? existing.id : null,
      name,
      category,
      price,
      description: first.description || null,
      variants,
    });
    if (existing) plan.updProducts++;
    else plan.newProducts++;
    for (const v of variants) {
      if (v.vid) plan.updVariants++;
      else plan.newVariants++;
    }
  }
  return plan;
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function InventoryExcel({
  products,
  categories,
  onDone,
}: {
  products: Product[];
  categories: string[];
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"" | "export" | "template" | "read" | "apply">("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (busy === "apply") return;
    setOpen(false);
    setPlan(null);
    setError("");
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const doExport = async (template: boolean) => {
    setError("");
    setBusy(template ? "template" : "export");
    try {
      const wb = await buildWorkbook(template ? [] : products, categories);
      const buf = await wb.xlsx.writeBuffer();
      download(buf as ArrayBuffer, template ? "plantilla-inventario.xlsx" : `inventario-${stamp()}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel.");
    } finally {
      setBusy("");
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setError("");
    setPlan(null);
    if (!/\.xlsx$/i.test(file.name)) {
      setError("Sube un archivo .xlsx (Excel). Si es .xls o .csv, guárdalo como .xlsx.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo pesa más de 5 MB.");
      return;
    }
    setBusy("read");
    try {
      setPlan(await parseFile(file, products, categories));
    } catch {
      setError("No se pudo leer el archivo. Verifica que sea un Excel (.xlsx) válido.");
    } finally {
      setBusy("");
    }
  };

  const apply = async () => {
    if (!plan || plan.products.length === 0) return;
    setBusy("apply");
    setError("");
    const failures: string[] = [];
    let done = 0;
    for (const p of plan.products) {
      done++;
      setProgress(`Guardando ${done} de ${plan.products.length}…`);
      try {
        let pid = p.pid;
        const data = {
          name: p.name,
          price: p.price,
          category: p.category,
          ...(p.description !== null ? { description: p.description } : {}),
        };
        if (pid) {
          const { error: e } = await supabase.from("products").update(data).eq("id", pid);
          if (e) throw new Error(e.message);
        } else {
          const { data: created, error: e } = await supabase
            .from("products")
            .insert({ description: "", ...data })
            .select("id")
            .single();
          if (e || !created) throw new Error(e?.message ?? "sin respuesta");
          pid = created.id as string;
        }
        for (const v of p.variants) {
          if (v.vid) {
            const { error: e } = await supabase
              .from("product_variants")
              .update({
                model_name: v.model_name,
                stock: v.stock,
                ...(v.photo ? { image_url: v.photo } : {}),
              })
              .eq("id", v.vid);
            if (e) throw new Error(e.message);
          } else {
            const { error: e } = await supabase.from("product_variants").insert({
              product_id: pid,
              model_name: v.model_name,
              stock: v.stock,
              image_url: v.photo,
            });
            if (e) throw new Error(e.message);
          }
        }
      } catch (e) {
        failures.push(`"${p.name}": ${e instanceof Error ? e.message : "error"}`);
      }
    }
    await revalidateStore();
    setBusy("");
    setProgress("");
    const ok = plan.products.length - failures.length;
    if (failures.length) {
      setError(`Se guardaron ${ok} de ${plan.products.length} productos. No se pudieron guardar: ${failures.join(" · ")}`);
      setPlan(null);
      onDone(`Carga masiva: ${ok} productos guardados, ${failures.length} con error.`);
    } else {
      onDone(`Carga masiva lista: ${ok} ${ok === 1 ? "producto" : "productos"} guardados.`);
      setOpen(false);
      setPlan(null);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-outline">
        <FileSpreadsheet size={18} aria-hidden="true" />
        Excel
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Excel e importación masiva"
        >
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-6">
            <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-lg font-bold">Excel y carga masiva</h2>
                <button
                  onClick={close}
                  aria-label="Cerrar"
                  className="w-9 h-9 grid place-items-center rounded-full hover:bg-brand-soft"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-5 pb-6 space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">1. Descargar</p>
                  <p className="text-xs text-muted leading-relaxed">
                    Una fila por modelo. Trae encabezados, listas desplegables y
                    una hoja de instrucciones que dice dónde va cada dato.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => doExport(false)}
                      disabled={!!busy || products.length === 0}
                      className="btn-outline text-sm py-2! px-4!"
                    >
                      {busy === "export" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Exportar inventario actual
                    </button>
                    <button
                      onClick={() => doExport(true)}
                      disabled={!!busy}
                      className="btn-outline text-sm py-2! px-4!"
                    >
                      {busy === "template" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Plantilla vacía
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-line pt-5">
                  <p className="text-sm font-semibold">2. Subir Excel lleno</p>
                  <p className="text-xs text-muted leading-relaxed">
                    Crea productos nuevos y actualiza los que ya existen (por su
                    ID). Nunca borra nada. Primero verás un resumen para
                    confirmar.
                  </p>
                  <label className="btn-primary text-sm py-2! px-4! cursor-pointer inline-flex">
                    {busy === "read" ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                    Elegir archivo .xlsx
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sr-only"
                      disabled={!!busy}
                      onChange={(e) => {
                        onFile(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {error && (
                  <div role="alert" className="flex gap-2 text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                {plan && (
                  <div className="space-y-3 border-t border-line pt-5">
                    {plan.products.length > 0 && (
                      <div className="flex gap-2 text-sm bg-green-50 border border-green-200 text-green-900 rounded-xl px-4 py-3">
                        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                        <p>
                          Listo para guardar: <strong>{plan.newProducts}</strong> productos nuevos y{" "}
                          <strong>{plan.updProducts}</strong> por actualizar (
                          {plan.newVariants} modelos nuevos, {plan.updVariants} por actualizar).
                        </p>
                      </div>
                    )}
                    {plan.errors.length > 0 && (
                      <div className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3">
                        <p className="font-semibold mb-1">
                          {plan.errors.length} {plan.errors.length === 1 ? "fila con problema" : "filas con problemas"} (no se cargarán):
                        </p>
                        <ul className="list-disc pl-5 space-y-0.5 max-h-40 overflow-y-auto text-[13px]">
                          {plan.errors.slice(0, 50).map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                          {plan.errors.length > 50 && <li>…y {plan.errors.length - 50} más</li>}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => setPlan(null)} disabled={busy === "apply"} className="btn-outline flex-1">
                        Cancelar
                      </button>
                      <button
                        onClick={apply}
                        disabled={busy === "apply" || plan.products.length === 0}
                        className="btn-primary flex-1"
                      >
                        {busy === "apply" ? (
                          <>
                            <Loader2 size={18} className="animate-spin" /> {progress || "Guardando…"}
                          </>
                        ) : (
                          "Guardar en el inventario"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
