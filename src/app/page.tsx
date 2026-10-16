import { createClient } from "@supabase/supabase-js";
import { Package, ShieldCheck, Truck } from "lucide-react";
import Catalog from "@/components/Catalog";
import PromoBanner, { type Promo } from "@/components/PromoBanner";

// La portada se genera en el servidor y se refresca sola cada minuto:
// el catálogo llega ya en el HTML (sin parpadeo y visible para Google).
export const revalidate = 60;

async function getProducts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      price,
      category,
      product_variants ( id, image_url, model_name, stock )
    `
    );

  if (error) {
    console.error("Error al cargar productos:", error.message);
    return { products: [], failed: true };
  }
  return { products: data ?? [], failed: false };
}

// Promociones activas (las administra la dueña desde /admin/promociones).
// Si la tabla aún no existe o falla, la portada simplemente no las muestra.
async function getPromos(): Promise<Promo[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await supabase
    .from("promotions")
    .select("id, title, subtitle, button_text, link_url, image_url, theme")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error al cargar promociones:", error.message);
    return [];
  }
  return (data ?? []) as Promo[];
}

// Se muestra cuando no hay ninguna promoción activa.
const DEFAULT_PROMO: Promo = {
  id: "default",
  title: "Diseños que hacen tu escritorio feliz",
  subtitle: "Papelería importada elegida uno por uno para ti.",
  button_text: "Ver catálogo",
  link_url: "#catalogo",
  image_url: null,
  theme: "lila",
};

const PERKS = [
  { icon: Truck, text: "Envíos a todo México" },
  { icon: Package, text: "Recoge gratis en tienda" },
  { icon: ShieldCheck, text: "Pago seguro con tarjeta" },
];

export default async function HomePage() {
  const [{ products, failed }, promos] = await Promise.all([
    getProducts(),
    getPromos(),
  ]);

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* PROMOCIONES */}
      <PromoBanner promos={promos.length > 0 ? promos : [DEFAULT_PROMO]} />

      {/* BENEFICIOS */}
      <ul className="grid grid-cols-3 gap-1.5 sm:flex sm:justify-center sm:gap-x-8 text-[11px] leading-tight sm:text-sm text-neutral-600">
        {PERKS.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex flex-col sm:flex-row items-center text-center gap-1 sm:gap-2"
          >
            <Icon size={18} className="text-brand-strong shrink-0" />
            {text}
          </li>
        ))}
      </ul>

      {/* CATÁLOGO */}
      <section id="catalogo" className="scroll-mt-24">
        {failed ? (
          <div className="card p-10 text-center space-y-2">
            <p className="font-semibold text-lg">
              No pudimos cargar los productos
            </p>
            <p className="text-sm text-muted">
              Intenta de nuevo en unos minutos.
            </p>
          </div>
        ) : (
          <Catalog products={products as any[]} />
        )}
      </section>
    </div>
  );
}
