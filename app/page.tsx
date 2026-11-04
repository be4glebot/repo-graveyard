import UsernameForm from "@/components/landing/UsernameForm";

/**
 * Landing page (server component). Renders the static landing copy and mounts
 * the `UsernameForm` client component, which owns all form behavior and
 * navigation. The page itself has no client interactivity.
 *
 * Requirements: 9.1
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-24 font-sans text-foreground">
      <div className="flex w-full max-w-md flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">Repo Graveyard</h1>
          <p className="text-lg leading-7 text-foreground/70">
            Enter a GitHub username or organization to see their public
            repositories sorted into ghosts, zombies, tombstones, and more.
          </p>
        </header>
        <UsernameForm />
      </div>
    </main>
  );
}
