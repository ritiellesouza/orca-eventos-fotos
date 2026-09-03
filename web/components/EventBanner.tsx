export function EventBanner({ eventName }: { eventName: string }) {
  return (
    <div className="bg-orca-azul-escuro py-12 px-4 text-center">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{eventName}</h1>
    </div>
  )
}
