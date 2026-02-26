"use client";

import { Facebook, Instagram, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white border-t mt-20">

      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">

        {/* Marca */}
        <div className="space-y-4">
          <h3 className="text-2xl font-bold text-pink-500">
            Office GaMa
          </h3>

          <p className="text-gray-600 text-sm leading-relaxed">
            Papelería importada con diseños únicos y calidad premium.
          </p>

          {/* Métodos de pago */}
          <div className="flex gap-3 pt-4">
            <div className="border px-3 py-1 rounded text-xs font-semibold text-gray-700">
              VISA
            </div>
            <div className="border px-3 py-1 rounded text-xs font-semibold text-gray-700">
              Mastercard
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div>
          <h4 className="font-semibold mb-4 text-lg text-black">
            Contacto
          </h4>

          <div className="space-y-3 text-gray-600 text-sm">

            <a
              href="https://wa.me/52561806008"
              target="_blank"
              className="flex items-center gap-2 hover:text-pink-500 transition-all duration-300"
            >
              <Phone size={16} />
              WhatsApp
            </a>

            <a
              href="https://www.facebook.com/OfficeGaMa"
              target="_blank"
              className="flex items-center gap-2 hover:text-pink-500 transition-all duration-300"
            >
              <Facebook size={16} />
              Facebook
            </a>

            <a
              href="https://www.instagram.com/office_gama/"
              target="_blank"
              className="flex items-center gap-2 hover:text-pink-500 transition-all duration-300"
            >
              <Instagram size={16} />
              Instagram
            </a>

          </div>
        </div>

        {/* Ubicación */}
        <div>
          <h4 className="font-semibold mb-4 text-lg text-black">
            Ubicación
          </h4>

          <a
            href="https://www.google.com/maps/search/?api=1&query=Calle+Chalco+26+Santa+Barbara+Ixtapaluca+Estado+de+Mexico+56538"
            target="_blank"
            className="flex items-start gap-2 text-gray-600 text-sm hover:text-pink-500 transition-all duration-300"
          >
            <MapPin size={16} className="mt-1" />
            Calle Chalco 26, Santa Barbara,
            Ixtapaluca, Estado de México 56538
          </a>
        </div>

      </div>

      {/* Línea inferior minimalista */}
      <div className="border-t text-center py-5 text-sm text-gray-500">
        Página creada por Giovanni Garcia Morales © {new Date().getFullYear()} Office GaMa
      </div>
    </footer>
  );
}