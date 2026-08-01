export default function Header() {
  return (
    <header className="border-b bg-card">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1 px-4 py-8 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Godhaar Analytics Dashboard
        </h1>
        <p className="text-sm text-balance text-muted-foreground">
          Farmer and animal registration totals per field user.
        </p>
      </section>
    </header>
  );
}
