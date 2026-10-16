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
    <div className="space-y-7 sm:space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl sm:rounded-[2rem] bg-gradient-to-br from-brand-soft via-white to-peach-soft border border-line px-5 py-7 sm:px-10 sm:py-9 text-center">
        <div
          aria-hidden="true"
          className="absolute -top-16 -left-16 w-40 h-40 sm:w-56 sm:h-56 rounded-full bg-brand/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -right-10 w-44 h-44 sm:w-64 sm:h-64 rounded-full bg-peach/60 blur-3xl"
        />

        <div className="relative max-w-2xl mx-auto space-y-3.5 sm:space-y-3 animate-fade-up">
          <p className="inline-block text-[11px] sm:text-sm font-semibold tracking-wide uppercase text-brand-strong bg-white/80 px-3 sm:px-3.5 py-1 rounded-full border border-line">
            Papelería importada
          </p>

          <h1 className="text-[1.65rem] sm:text-4xl font-extrabold leading-[1.1]">
            Diseños que hacen
            <span className="block text-brand-strong">tu escritorio feliz</span>
          </h1>

          <p className="text-neutral-600 text-sm sm:text-base max-w-lg mx-auto leading-snug sm:leading-normal">
            Libretas, plumas, stickers, washi tapes y mucho más, elegidos uno
            por uno para ti.
          </p>

          <div className="pt-1 sm:pt-2">
            <a href="#catalogo" className="btn-primary text-[15px] sm:text-base px-7 py-2.5 sm:px-7 sm:py-2.5">
              Ver catálogo
            </a>
          </div>

          <ul className="pt-3 sm:pt-3 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2 text-[11px] leading-tight sm:text-sm text-neutral-600">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                <Icon size={18} className="text-brand-strong shrink-0" />
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
