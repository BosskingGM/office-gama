"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Promo = {
  id: string;
  title: string | null;
  subtitle: string | null;
  button_text: string | null;
  link_url: string | null;
  image_url: string | null;
  theme: string | null;
};

// Colores disponibles para promociones sin foto (o con foto y texto encima).
export const THEMES = {
  lila: {
    label: "Lila",
    bg: "bg-gradient-to-br from-[#f3e8ff] via-white to-[#fff1ea]",
    swatch: "bg-[#d6a8ff]",
    title: "text-ink",
    text: "text-neutral-600",
    btn: "bg-brand text-ink",
  },
  durazno: {
    label: "Durazno",
    bg: "bg-gradient-to-br from-[#ffd9c7] via-[#fff1ea] to-white",
    swatch: "bg-[#ffb89a]",
    title: "text-ink",
    text: "text-neutral-700",
    btn: "bg-ink text-white",
  },
  rosa: {
    label: "Rosa",
    bg: "bg-gradient-to-br from-[#fbcfe8] via-[#fdf2f8] to-white",
    swatch: "bg-[#f9a8d4]",
    title: "text-ink",
    text: "text-neutral-700",
    btn: "bg-ink text-white",
  },
  menta: {
    label: "Menta",
    bg: "bg-gradient-to-br from-[#bbf7d0] via-[#f0fdf4] to-white",
    swatch: "bg-[#86efac]",
    title: "text-ink",
    text: "text-neutral-700",
    btn: "bg-ink text-white",
  },
  oscuro: {
    label: "Oscuro",
    bg: "bg-gradient-to-br from-[#1a1523] via-[#2f2740] to-[#4c1d95]",
    swatch: "bg-[#2f2740]",
    title: "text-white",
    text: "text-white/80",
    btn: "bg-white text-ink",
  },
} as const;
export type ThemeKey = keyof typeof THEMES;

/* Una promoción. Se usa en la portada y en la vista previa del admin. */
export function PromoSlide({ promo }: { promo: Promo }) {
  const theme = THEMES[(promo.theme as ThemeKey) ?? "lila"] ?? THEMES.lila;
  const hasImg = !!promo.image_url;
  const hasText = !!(promo.title || promo.subtitle || promo.button_text);

  const body = (
    <div
      className={`relative h-44 sm:h-56 lg:h-60 w-full overflow-hidden ${
        hasImg ? "bg-brand-soft" : theme.bg
      }`}
    >
      {hasImg && (
        <img
          src={promo.image_url!}
          alt={promo.title ?? "Promoción"}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {hasImg && hasText && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
      )}

      {hasText && (
        <div className="relative h-full flex flex-col justify-center items-start text-left gap-1.5 sm:gap-2.5 px-5 sm:px-12 max-w-[80%] sm:max-w-xl">
          {promo.title && (
            <h2
              className={`text-xl sm:text-4xl font-extrabold leading-tight line-clamp-3 ${
                hasImg ? "text-white" : theme.title
              }`}
            >
              {promo.title}
            </h2>
          )}
          {promo.subtitle && (
            <p
              className={`text-[13px] sm:text-base leading-snug line-clamp-2 ${
                hasImg ? "text-white/90" : theme.text
              }`}
            >
              {promo.subtitle}
            </p>
          )}
          {promo.button_text && (
            <span
              className={`mt-1 inline-flex items-center rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-[13px] sm:text-sm font-semibold shadow-sm ${
                hasImg ? "bg-white text-ink" : theme.btn
              }`}
            >
              {promo.button_text}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const href = promo.link_url?.trim();
  if (!href) return body;
  if (href.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  const external = /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      className="block"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {body}
    </a>
  );
}

/* Carrusel de la portada: se desliza con el dedo y avanza solo cada 5 s. */
export default function PromoBanner({ promos }: { promos: Promo[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [index, setIndex] = useState(0);
  const n = promos.length;

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = ref.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || paused.current || el.clientWidth === 0) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      el.scrollTo({ left: ((cur + 1) % n) * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(t);
  }, [n]);

  if (n === 0) return null;

  return (
    <section
      aria-label="Promociones"
      className="relative rounded-3xl overflow-hidden border border-line shadow-[var(--shadow-card)]"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={() => (paused.current = true)}
      onTouchEnd={() => setTimeout(() => (paused.current = false), 4000)}
    >
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {promos.map((p) => (
          <div key={p.id} className="w-full shrink-0 snap-center">
            <PromoSlide promo={p} />
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button
            onClick={() => goTo((index - 1 + n) % n)}
            aria-label="Promoción anterior"
            className="hidden sm:grid absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white transition"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => goTo((index + 1) % n)}
            aria-label="Promoción siguiente"
            className="hidden sm:grid absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 place-items-center rounded-full bg-white/90 shadow hover:bg-white transition"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
            {promos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => goTo(i)}
                aria-label={`Ir a la promoción ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/60"
                } shadow-[0_0_2px_rgba(0,0,0,0.4)]`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
