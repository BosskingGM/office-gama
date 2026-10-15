import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-12 text-center space-y-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Este producto ya no está disponible</h1>
      <p className="text-sm text-muted">
        Puede que se haya retirado del catálogo o que el enlace sea incorrecto.
      </p>
      <Link href="/" className="btn-primary">
        Ver el catálogo
      </Link>
    </div>
  );
}
