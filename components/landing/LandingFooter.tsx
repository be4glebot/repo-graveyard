/**
 * Landing footer: "Built with Kiro", the repository link and the AI-art
 * disclosure. The GitHub link is the last tab stop on the page.
 *
 * Requirements: 2.9, 2.10, 2.11
 */
export const REPO_URL = "https://github.com/be4glebot/repo-graveyard";
export const ART_DISCLOSURE = "Art generated with ChatGPT; planning help from Claude";

export default function LandingFooter() {
  return (
    <footer
      data-testid="landing-footer"
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-2 px-4 py-6 text-center font-ui text-sm text-scene-fg"
    >
      <p>
        Built with Kiro ·{" "}
        <a
          href={REPO_URL}
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 focus-visible:ring-offset-2 focus-visible:ring-offset-night-sky"
        >
          GitHub
        </a>
      </p>
      <p>{ART_DISCLOSURE}</p>
    </footer>
  );
}
