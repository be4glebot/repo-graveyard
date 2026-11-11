import GateScene from "@/components/landing/GateScene";
import HowItWorks from "@/components/landing/HowItWorks";
import LandingFooter from "@/components/landing/LandingFooter";
import UsernameForm from "@/components/landing/UsernameForm";
import ThemedButton from "@/components/ui/ThemedButton";

/**
 * Landing page (server component). DOM order is the Tab order: username
 * input, "Open the gate", Estate link, footer link.
 *
 * Requirements: 1.2, 1.3, 1.4, 2.6, 2.10, 2.11
 */
export default function Home() {
  return (
    <GateScene>
      <main className="landing-main flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-16">
        <div className="landing-scrim flex w-full max-w-xl flex-col items-center gap-8 px-6 py-10 text-center">
          <div className="flex flex-col items-center gap-3">
            <h1 className="font-wordmark wordmark-glow text-5xl text-scene-fg sm:text-6xl">
              Repo Graveyard
            </h1>
            <p className="font-narrative text-lg italic text-scene-fg">
              Every abandoned repo leaves something behind.
            </p>
          </div>
          <UsernameForm />
          <ThemedButton href="/estate" variant="iron">
            Tour the Haunted Estate
          </ThemedButton>
        </div>
        <HowItWorks />
      </main>
      <LandingFooter />
    </GateScene>
  );
}
