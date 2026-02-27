"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InventarioPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

const categories = [
  "Sacapuntas","Libretas","Washi Tapes","Stickers","Tintas","Sellos","Post It",
  "Plumones","Folders","Plumas","Pegamento","Extras","Marca Textos","Cutters",
  "Lapiceras","Crayolas","Lacre","Gises","Colores","Correctores",
  "Juegos Geométricos","Liquidación",
].sort((a, b) => a.localeCompare(b, "es"));

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    setProducts(data || []);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setDescription("");
    setCategory("");
    setVariants([]);
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        id: null,
        model_name: "",
        stock: "",
        imageFile: null,
        existingImageUrl: null,
      },
    ]);
  };

  const removeVariant = async (index: number) => {
    const variant = variants[index];

    if (variant.id) {
      await supabase
        .from("product_variants")
        .delete()
        .eq("id", variant.id);
    }

    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const handleEdit = async (product: any) => {
    setEditingId(product.id);
    setName(product.name);
    setPrice(product.price.toString());
    setDescription(product.description);
    setCategory(product.category || "");

    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id);

    if (data) {
      setVariants(
        data.map((v: any) => ({
          id: v.id,
          model_name: v.model_name,
          stock: v.stock.toString(),
          imageFile: null,
          existingImageUrl: v.image_url,
        }))
      );
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("¿Eliminar producto?")) return;

    await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId);

    await supabase.from("products").delete().eq("id", productId);

    fetchProducts();
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    try {
      let productId = editingId;

      if (editingId) {
        await supabase
          .from("products")
          .update({
            name,
            price: parseFloat(price),
            description,
            category,
          })
          .eq("id", editingId);
      } else {
        const { data } = await supabase
          .from("products")
          .insert({
            name,
            price: parseFloat(price),
            description,
            category,
          })
          .select()
          .single();

        productId = data?.id;
      }

      if (!productId) return;

      for (const variant of variants) {
        if (!variant.model_name || !variant.stock) continue;

        let imageUrl = variant.existingImageUrl;

        if (variant.imageFile) {
          const fileName = `${Date.now()}-${variant.imageFile.name}`;

          await supabase.storage
            .from("products")
            .upload(fileName, variant.imageFile);

          const { data } = supabase.storage
            .from("products")
            .getPublicUrl(fileName);

          imageUrl = data.publicUrl;
        }

        if (variant.id) {
          await supabase
            .from("product_variants")
            .update({
              model_name: variant.model_name,
              stock: parseInt(variant.stock),
              image_url: imageUrl,
            })
            .eq("id", variant.id);
        } else {
          await supabase
            .from("product_variants")
            .insert({
              product_id: productId,
              model_name: variant.model_name,
              stock: parseInt(variant.stock),
              image_url: imageUrl,
            });
        }
      }

      resetForm();
      fetchProducts();
      alert(editingId ? "Producto actualizado" : "Producto creado");
    } catch (error) {
      console.error(error);
      alert("Error guardando producto");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      search.trim() === "" ||
      product.name.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      filterCategory === "" ||
      product.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#faf9ff] px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-12">

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
            Inventario
          </h1>

          {editingId && (
            <button
              onClick={resetForm}
              className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-xl hover:opacity-90"
            >
              + Crear nuevo producto
            </button>
          )}
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-10 space-y-6"
        >

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nombre del producto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-neutral-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-[#d6a8ff]"
            />

            <input
              type="number"
              placeholder="Precio"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border border-neutral-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-[#d6a8ff]"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-neutral-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-[#d6a8ff]"
          >
            <option value="">Seleccionar categoría</option>
            {categories.map((cat, i) => (
              <option key={i} value={cat}>{cat}</option>
            ))}
          </select>

          <textarea
            placeholder="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-neutral-300 px-4 py-3 rounded-xl w-full focus:ring-2 focus:ring-[#d6a8ff]"
          />

          <h2 className="text-lg font-semibold text-neutral-900">
            Variantes
          </h2>

          {variants.map((variant, index) => (
            <div
              key={index}
              className="bg-neutral-50 border border-neutral-200 p-5 rounded-2xl space-y-4 relative"
            >
              <button
                type="button"
                onClick={() => removeVariant(index)}
                className="absolute top-3 right-4 text-neutral-400 hover:text-black"
              >
                ✕
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Modelo"
                  value={variant.model_name}
                  onChange={(e) =>
                    updateVariant(index, "model_name", e.target.value)
                  }
                  className="border border-neutral-300 px-4 py-2 rounded-xl"
                />

                <input
                  type="number"
                  placeholder="Stock"
                  value={variant.stock}
                  onChange={(e) =>
                    updateVariant(index, "stock", e.target.value)
                  }
                  className="border border-neutral-300 px-4 py-2 rounded-xl"
                />
              </div>

              {variant.existingImageUrl && (
                <img
                  src={variant.existingImageUrl}
                  className="w-24 h-24 object-cover rounded-xl border border-neutral-200"
                />
              )}

              {/* FILE CUSTOM */}
              <label className="block">
                <span className="text-sm text-neutral-600">
                  Imagen del modelo
                </span>
                <div className="mt-2 flex items-center gap-4">
                  <input
                    type="file"
                    onChange={(e) =>
                      updateVariant(
                        index,
                        "imageFile",
                        e.target.files?.[0] || null
                      )
                    }
                    className="hidden"
                    id={`file-${index}`}
                  />
                  <label
                    htmlFor={`file-${index}`}
                    className="cursor-pointer bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm hover:opacity-90"
                  >
                    Seleccionar imagen
                  </label>
                  {variant.imageFile && (
                    <span className="text-xs text-neutral-500 truncate max-w-[120px]">
                      {variant.imageFile.name}
                    </span>
                  )}
                </div>
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={addVariant}
            className="text-[#b784f7] font-semibold"
          >
            + Agregar variante
          </button>

          <button
            type="submit"
            disabled={loading}
            className="bg-[#b784f7] text-black px-6 py-4 rounded-2xl w-full font-semibold hover:opacity-90 transition"
          >
            {loading
              ? "Guardando..."
              : editingId
              ? "Actualizar Producto"
              : "Crear Producto"}
          </button>
        </form>

        {/* FILTROS */}
<div className="bg-white border border-neutral-200 p-6 rounded-3xl flex flex-col sm:flex-row gap-4">
  <input
    type="text"
    placeholder="Buscar producto..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="border border-neutral-300 px-5 py-3 rounded-2xl text-neutral-900 w-full focus:ring-2 focus:ring-[#d6a8ff]"
  />

  <select
    value={filterCategory}
    onChange={(e) => setFilterCategory(e.target.value)}
    className="border border-neutral-300 px-5 py-3 rounded-2xl text-neutral-900 w-full sm:w-60 focus:ring-2 focus:ring-[#d6a8ff]"
  >
    <option value="">Todas las categorías</option>
    {categories.map((cat, i) => (
      <option key={i} value={cat}>
        {cat}
      </option>
    ))}
  </select>
</div>

{/* LISTA */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  {filteredProducts.map((product) => (
    <div
      key={product.id}
      className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition"
    >
      <h3 className="font-semibold text-neutral-900 text-lg">
        {product.name}
      </h3>

      <p className="text-neutral-500 text-sm mt-1">
        {product.category || "Sin categoría"}
      </p>

      <p className="text-neutral-900 font-bold mt-2">
        ${product.price} MXN
      </p>

      <div className="flex gap-3 mt-5">
        <button
          onClick={() => handleEdit(product)}
          className="bg-neutral-900 text-white px-4 py-2 rounded-2xl w-full hover:opacity-90 transition"
        >
          Modificar
        </button>

        <button
          onClick={() => handleDelete(product.id)}
          className="bg-neutral-200 text-neutral-800 px-4 py-2 rounded-2xl w-full hover:bg-neutral-300 transition"
        >
          Eliminar
        </button>
      </div>
    </div>
  ))}
</div>

      </div>
    </div>
  );
}