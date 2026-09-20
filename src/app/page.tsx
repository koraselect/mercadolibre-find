import { Crosshair } from "lucide-react";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Crosshair className="size-7" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        MercadoLibre Opportunity Finder
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Encuentra productos equivalentes a menor precio y calcula la oportunidad.
      </p>
      <div className="mt-10 rounded-xl border bg-card p-8 text-sm text-muted-foreground">
        El analizador se habilita en esta pantalla. Pega la URL de una publicación
        de MercadoLibre Venezuela y presiona Analizar.
      </div>
    </div>
  );
}