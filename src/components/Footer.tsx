"use client";

import { Facebook, Instagram, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200 mt-24">

      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">

        {/* Marca */}
        <div className="space-y-5">
          <h3 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Office GaMa
          </h3>

          <p className="text-neutral-500 text-sm leading-relaxed max-w-sm">
            Papelería importada con diseños únicos, estética premium y artículos
            que elevan tu creatividad.
          </p>

          {/* Métodos de pago */}
          <div className="flex gap-3 pt-4">
            <div className="border border-neutral-300 px-4 py-1.5 rounded-xl text-xs font-semibold text-neutral-700">
              VISA
            </div>
            <div className="border border-neutral-300 px-4 py-1.5 rounded-xl text-xs font-semibold text-neutral-700">
              Mastercard
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div>
          <h4 className="font-semibold mb-6 text-lg text-neutral-900">
            Contacto
          </h4>

          <div className="space-y-4 text-neutral-500 text-sm">

            <a
              href="https://wa.me/52561806008"
              target="_blank"
              className="flex items-center gap-3 hover:text-[#d6a8ff] transition"
            >
              <Phone size={16} />
              WhatsApp
            </a>

            <a
              href="https://www.facebook.com/OfficeGaMa"
              target="_blank"
              className="flex items-center gap-3 hover:text-[#d6a8ff] transition"
            >
              <Facebook size={16} />
              Facebook
            </a>

            <a
              href="https://www.instagram.com/office_gama/"
              target="_blank"
              className="flex items-center gap-3 hover:text-[#d6a8ff] transition"
            >
              <Instagram size={16} />
              Instagram
            </a>

          </div>
        </div>

        {/* Ubicación */}
        <div>
          <h4 className="font-semibold mb-6 text-lg text-neutral-900">
            Ubicación
          </h4>

          <a
            href="https://www.google.com/maps/search/?api=1&query=Calle+Chalco+26+Santa+Barbara+Ixtapaluca+Estado+de+Mexico+56538"
            target="_blank"
            className="flex items-start gap-3 text-neutral-500 text-sm hover:text-[#d6a8ff] transition"
          >
            <MapPin size={16} className="mt-1" />
            Calle Chalco 26, Santa Barbara,
            Ixtapaluca, Estado de México 56538
          </a>
        </div>

      </div>

      {/* Línea inferior */}
      <div className="border-t border-neutral-200 text-center py-6 text-sm text-neutral-400">
        © {new Date().getFullYear()} Office GaMa · Creado por Giovanni Garcia Morales
      </div>
    </footer>
  );
}