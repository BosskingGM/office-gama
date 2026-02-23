"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InventarioPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [variants, setVariants] = useState([
    { model_name: "", stock: "", imageFile: null as File | null },
  ]);

  const [loading, setLoading] = useState(false);

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
    setVariants([{ model_name: "", stock: "", imageFile: null }]);
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      { model_name: "", stock: "", imageFile: null },
    ]);
  };

  const removeVariant = (index: number) => {
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

    const { data } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id);

    if (data) {
      setVariants(
        data.map((v: any) => ({
          model_name: v.model_name,
          stock: v.stock.toString(),
          imageFile: null,
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
          })
          .eq("id", editingId);
      } else {
        const { data } = await supabase
          .from("products")
          .insert({
            name,
            price: parseFloat(price),
            description,
          })
          .select()
          .single();

        productId = data?.id;
      }

      if (!productId) return;

      if (editingId) {
        await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", productId);
      }

      const variantsToInsert = [];

      for (const variant of variants) {
        if (!variant.model_name || !variant.stock) continue;

        let imageUrl = null;

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

        variantsToInsert.push({
          product_id: productId,
          model_name: variant.model_name,
          stock: parseInt(variant.stock),
          image_url: imageUrl,
        });
      }

      await supabase
        .from("product_variants")
        .insert(variantsToInsert);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-black">
            📦 Inventario
          </h1>

          {editingId && (
            <button
              onClick={resetForm}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-xl w-full sm:w-auto transition"
            >
              + Nuevo Producto
            </button>
          )}
        </div>

        {/* FORMULARIO */}
        <form
          onSubmit={handleSubmit}
          className={`bg-white p-6 sm:p-10 rounded-2xl shadow-sm space-y-6 ${
            editingId ? "border-2 border-blue-400" : ""
          }`}
        >
          {editingId && (
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-xl font-semibold text-sm">
              Estás editando este producto
            </div>
          )}

          {/* Datos básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input
              type="text"
              placeholder="Nombre del producto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border px-4 py-3 rounded-xl text-black w-full"
            />

            <input
              type="number"
              placeholder="Precio"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border px-4 py-3 rounded-xl text-black w-full"
            />
          </div>

          <textarea
            placeholder="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border px-4 py-3 rounded-xl text-black w-full"
          />

          {/* VARIANTES */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-black mb-4">
              Variantes
            </h2>

            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div
                  key={index}
                  className="bg-gray-50 p-5 rounded-xl border relative"
                >
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="absolute top-3 right-3 text-red-500 font-bold"
                  >
                    ✕
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Modelo"
                      value={variant.model_name}
                      onChange={(e) =>
                        updateVariant(index, "model_name", e.target.value)
                      }
                      className="border px-4 py-2 rounded-xl text-black w-full"
                    />

                    <input
                      type="number"
                      placeholder="Stock"
                      value={variant.stock}
                      onChange={(e) =>
                        updateVariant(index, "stock", e.target.value)
                      }
                      className="border px-4 py-2 rounded-xl text-black w-full"
                    />
                  </div>

                  <input
                    type="file"
                    onChange={(e) =>
                      updateVariant(
                        index,
                        "imageFile",
                        e.target.files?.[0] || null
                      )
                    }
                    className="mt-3 text-black w-full"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addVariant}
              className="mt-4 text-pink-600 font-semibold"
            >
              + Agregar variante
            </button>
          </div>

          {/* BOTONES */}
          <div className="flex flex-col sm:flex-row gap-4">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 rounded-xl w-full transition"
              >
                Cancelar edición
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-xl w-full transition disabled:bg-gray-400"
            >
              {loading
                ? "Guardando..."
                : editingId
                ? "Actualizar Producto"
                : "Crear Producto"}
            </button>
          </div>
        </form>

        {/* LISTA PRODUCTOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white p-6 rounded-xl shadow-sm"
            >
              <h3 className="font-semibold text-black text-lg">
                {product.name}
              </h3>

              <p className="text-pink-600 font-bold mt-1">
                ${product.price} MXN
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={() => handleEdit(product)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg w-full transition"
                >
                  Modificar
                </button>

                <button
                  onClick={() => handleDelete(product.id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg w-full transition"
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