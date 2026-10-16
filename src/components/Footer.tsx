import Link from "next/link";
import { Facebook, Instagram, MapPin, Phone } from "lucide-react";

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Calle+Chalco+26+Santa+Barbara+Ixtapaluca+Estado+de+Mexico+56538";

const linkClass =
  "flex items-center gap-3 text-neutral-600 hover:text-brand-strong transition";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-line mt-16 sm:mt-24">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Marca */}
        <div className="space-y-4 lg:col-span-1">
          <h3 className="text-2xl font-extrabold tracking-tight">
            Office <span className="text-brand-strong">GaMa</span>
          </h3>
          <p className="text-neutral-600 text-sm leading-relaxed max-w-xs">
            Papelería importada con diseños únicos y artículos que elevan tu
            creatividad.
          </p>
          <div className="flex gap-2 pt-1">
            {["VISA", "Mastercard"].map((m) => (
              <span
                key={m}
                className="border border-line px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-700"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Tienda */}
        <nav aria-label="Tienda">
          <h4 className="font-bold mb-5">Tienda</h4>
          <ul className="space-y-3 text-sm text-neutral-600">
            <li>
              <Link href="/" className="hover:text-brand-strong transition">
                Catálogo
              </Link>
            </li>
            <li>
              <Link href="/carrito" className="hover:text-brand-strong transition">
                Mi carrito
              </Link>
            </li>
            <li>
              <Link href="/cuenta" className="hover:text-brand-strong transition">
                Mis pedidos
              </Link>
            </li>
          </ul>
        </nav>

        {/* Contacto */}
        <div>
          <h4 className="font-bold mb-5">Contacto</h4>
          <div className="space-y-3.5 text-sm">
            <a
              href="https://wa.me/525618060088"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <Phone size={16} /> WhatsApp
            </a>
            <a
              href="https://www.facebook.com/OfficeGaMa"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <Facebook size={16} /> Facebook
            </a>
            <a
              href="https://www.instagram.com/office_gama/"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <Instagram size={16} /> Instagram
            </a>
          </div>
        </div>

        {/* Ubicación */}
        <div>
          <h4 className="font-bold mb-5">Ubicación</h4>
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 text-sm text-neutral-600 hover:text-brand-strong transition"
          >
            <MapPin size={16} className="mt-0.5 shrink-0" />
            <span>
              Calle Chalco 26, Santa Bárbara, Ixtapaluca, Estado de México
              56538
            </span>
          </a>
        </div>
      </div>

      <div className="border-t border-line text-center py-6 px-6 text-sm text-neutral-500">
        © {new Date().getFullYear()} Office GaMa · Creado por Giovanni Garcia
        Morales
      </div>
    </footer>
  );
}
