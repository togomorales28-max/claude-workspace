export default function PageHeader({ titulo, descripcion, accion }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-prose text-sm text-tinta-suave">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}
