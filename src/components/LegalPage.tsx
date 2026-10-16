import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-3xl mx-auto">
      <nav className="text-sm text-muted mb-4" aria-label="Ruta">
        <Link href="/" className="hover:underline">
          Inicio
        </Link>{" "}
        / {title}
      </nav>
      <div className="card p-6 sm:p-10">
        <h1 className="text-2xl sm:text-4xl font-extrabold">{title}</h1>
        <p className="text-sm text-muted mt-2">
          Última actualización: {LEGAL.updated}
        </p>
        {intro && (
          <p className="mt-5 text-neutral-700 leading-relaxed">{intro}</p>
        )}
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-neutral-700 [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p+p]:mt-3 [&_p+ul]:mt-3 [&_a]:text-brand-strong [&_a]:underline">
          {children}
        </div>
      </div>
    </article>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
