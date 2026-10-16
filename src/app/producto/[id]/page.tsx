import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ProductDetail from "@/components/ProductDetail";
import ProductCard from "@/components/ProductCard";

// Se genera en el servidor y se refresca cada minuto (SEO + carga rápida).
// El stock real siempre lo vuelve a validar el servidor al pagar.
export const revalidate = 60;

const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

// cache(): el título y la página comparten una sola consulta
const getProduct = cache(async (id: string) => {
  const supabase = db();

  const { data: product, error } = await supabase
    .from("products")
    .select("id, name, price, category, description")
    .eq("id", id)
    .maybeSingle();

  if (error || !product) return null;

  // extra_images = fotos adicionales por modelo. Si esa columna aún no existe
  // en la base de datos, se pide sin ella y la página sigue funcionando.
  let { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select("id, model_name, image_url, stock, extra_images")
    .eq("product_id", id);
  if (vErr) {
    const retry = await supabase
      .from("product_variants")
      .select("id, model_name, image_url, stock")
      .eq("product_id", id);
    variants = retry.data as typeof variants;
  }

  return { product, variants: variants ?? [] };
});

async function getRelated(category: string | null, excludeId: string) {
  if (!category) return [];
  const { data } = await db()
    .from("products")
    .select("id, name, price, category, product_variants ( id, image_url, model_name, stock )")
    .eq("category", category)
    .neq("id", excludeId)
    .limit(4);
  return data ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = await getProduct(id);
  if (!found) return { title: "Producto no encontrado" };

  const { product, variants } = found;
  const image = variants.find((v) => v.image_url)?.image_url;
  const description =
    product.description?.slice(0, 160) ||
    `${product.name} en Office GaMa. Papelería importada con envíos a todo México.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await getProduct(id);
  if (!found) notFound();

  const { product, variants } = found;
  const related = await getRelated(product.category, product.id);

  return (
    <div className="space-y-12">
      {/* Migas de pan */}
      <nav aria-label="Ruta" className="text-sm text-muted flex flex-wrap gap-x-2 gap-y-1">
        <Link href="/" className="hover:text-brand-strong transition">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        {product.category && (
          <>
            <span>{product.category}</span>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span className="text-ink font-medium line-clamp-1">{product.name}</span>
      </nav>

      <ProductDetail
        product={{
          id: product.id,
          name: product.name,
          price: Number(product.price),
          category: product.category,
          description: product.description,
        }}
        variants={variants}
      />

      {related.length > 0 && (
        <section aria-labelledby="relacionados">
          <h2 id="relacionados" className="text-xl sm:text-2xl font-bold mb-5">
            También te puede gustar
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
            {related.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
