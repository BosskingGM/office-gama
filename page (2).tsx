import { createClient } from "@supabase/supabase-js";
import { Package, ShieldCheck, Truck } from "lucide-react";
import Catalog from "@/components/Catalog";

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

const PERKS = [
  { icon: Truck, text: "Envíos a todo México" },
  { icon: Package, text: "Recoge gratis en tienda" },
  { icon: ShieldCheck, text: "Pago seguro con tarjeta" },
];

export default async function HomePage() {
  const { products, failed } = await getProducts();

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-soft via-white to-peach-soft border border-line px-6 py-12 sm:px-12 sm:py-20 text-center">
        <div
          aria-hidden="true"
          className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-brand/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -right-10 w-64 h-64 rounded-full bg-peach/60 blur-3xl"
        />

        <div className="relative max-w-2xl mx-auto space-y-5 animate-fade-up">
          <p className="inline-block text-xs sm:text-sm font-semibold tracking-wide uppercase text-brand-strong bg-white/80 px-3.5 py-1 rounded-full border border-line">
            Papelería importada
          </p>

          <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.1]">
            Diseños que hacen
            <span className="block text-brand-strong">tu escritorio feliz</span>
          </h1>

          <p className="text-neutral-600 text-base sm:text-lg max-w-lg mx-auto">
            Libretas, plumas, stickers, washi tapes y mucho más, elegidos uno
            por uno para ti.
          </p>

          <div className="pt-2">
            <a href="#catalogo" className="btn-primary text-base px-8 py-3.5">
              Ver catálogo
            </a>
          </div>

          <ul className="pt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-600">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon size={16} className="text-brand-strong" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

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
