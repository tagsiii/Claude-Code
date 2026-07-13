import Link from "next/link";

export const metadata = { title: "Economic Statecraft Monitor" };

// Placeholder shell for the Economic Statecraft Monitor.
// The real app will be mounted here behind its own login,
// separate from the dashboard session.
export default function StatecraftPlaceholder() {
  return (
    <main className="auth auth--statecraft">
      <div className="auth__card">
        <Link href="/dashboard" className="auth__back">
          ← Back to dashboard
        </Link>
        <p className="auth__kicker">Restricted tool</p>
        <h1 className="auth__title">Economic Statecraft Monitor</h1>
        <p className="auth__sub">
          This is the reserved home for your monitor. It will run here on your
          domain behind its own dedicated login, independent of the dashboard
          session.
        </p>
        <form className="auth__form" aria-disabled="true">
          <label className="auth__label" htmlFor="sc-user">
            Monitor ID
          </label>
          <input id="sc-user" className="auth__input" type="text" disabled placeholder="Coming soon" />
          <label className="auth__label" htmlFor="sc-pass">
            Passphrase
          </label>
          <input id="sc-pass" className="auth__input" type="password" disabled placeholder="••••••••" />
          <button className="btn btn--primary auth__submit" disabled>
            Not yet connected
          </button>
        </form>
        <p className="auth__note">
          Next step: wire the monitor's app into this route and swap this form
          for its real authentication.
        </p>
      </div>
    </main>
  );
}
