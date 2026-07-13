import Link from "next/link";
import { dashboard } from "../content";
import LogoutButton from "./LogoutButton";
// The Economic Statecraft Monitor tile is intentionally offline for now.
// Restore it from git history when ready to bring the monitor online.

export const metadata = { title: "Dashboard — Trey Seabrooke" };

export default function Dashboard() {
  const d = dashboard;

  return (
    <div className="dash">
      <header className="dash__nav">
        <div className="dash__nav-inner">
          <Link href="/" className="dash__brand">
            Trey Seabrooke
          </Link>
          <span className="dash__nav-label">Dashboard</span>
          <LogoutButton />
        </div>
      </header>

      <main className="dash__main">
        <div className="dash__head">
          <h1 className="dash__greeting">{d.greeting}</h1>
          <p className="dash__subhead">{d.subhead}</p>
        </div>

        <div className="dash__grid">
          {/* Interesting Reads */}
          <section className="tile">
            <span className="tile__kicker">{d.reads.title}</span>
            <p className="tile__blurb">{d.reads.blurb}</p>
            <ul className="tile__list">
              {d.reads.items.map((r) => (
                <li key={r.title}>
                  <a href={r.link}>{r.title}</a>
                  <span className="tile__meta">{r.source}</span>
                </li>
              ))}
            </ul>
            <span className="tile__soon">Placeholder — build me next</span>
          </section>

          {/* Meal Plan → Training & Fuel app */}
          <Link href="/dashboard/train" className="tile">
            <span className="tile__kicker">{d.meals.title}</span>
            <p className="tile__blurb">Weekly generator with grocery list — inside Training &amp; Fuel.</p>
            <ul className="tile__rows">
              {d.meals.days.map((m) => (
                <li key={m.day}>
                  <span className="tile__day">{m.day}</span>
                  <span>{m.meal}</span>
                </li>
              ))}
            </ul>
            <span className="tile__soon">Open Training &amp; Fuel →</span>
          </Link>

          {/* Workout Plan → Training & Fuel app */}
          <Link href="/dashboard/train" className="tile">
            <span className="tile__kicker">{d.workouts.title}</span>
            <p className="tile__blurb">Guided lift player with rest timers — inside Training &amp; Fuel.</p>
            <ul className="tile__rows">
              {d.workouts.days.map((w) => (
                <li key={w.day}>
                  <span className="tile__day">{w.day}</span>
                  <span>{w.focus}</span>
                </li>
              ))}
            </ul>
            <span className="tile__soon">Open Training &amp; Fuel →</span>
          </Link>

          {/* Calendar */}
          <section className="tile tile--wide">
            <span className="tile__kicker">{d.calendar.title}</span>
            {d.calendar.embedUrl ? (
              <div className="tile__embed">
                <iframe
                  src={d.calendar.embedUrl}
                  title="Calendar"
                  frameBorder="0"
                  scrolling="no"
                />
              </div>
            ) : (
              <div className="tile__embed tile__embed--empty">
                <p>{d.calendar.blurb}</p>
                <code>app/content.ts → dashboard.calendar.embedUrl</code>
              </div>
            )}
          </section>

          {/* Fun Events */}
          <section className="tile">
            <span className="tile__kicker">{d.events.title}</span>
            <p className="tile__blurb">{d.events.blurb}</p>
            <ul className="tile__list">
              {d.events.items.map((e) => (
                <li key={e.name}>
                  <span>{e.name}</span>
                  <span className="tile__meta">
                    {e.when} · {e.where}
                  </span>
                </li>
              ))}
            </ul>
            <span className="tile__soon">Placeholder — build me next</span>
          </section>

          {/* People to Meet */}
          <section className="tile">
            <span className="tile__kicker">{d.people.title}</span>
            <p className="tile__blurb">{d.people.blurb}</p>
            <ul className="tile__list">
              {d.people.items.map((p, i) => (
                <li key={i}>
                  <span>{p.name}</span>
                  <span className="tile__meta">{p.why}</span>
                </li>
              ))}
            </ul>
            <span className="tile__soon">Placeholder — build me next</span>
          </section>

          {/* Sports Events */}
          <section className="tile">
            <span className="tile__kicker">{d.sports.title}</span>
            <p className="tile__blurb">{d.sports.blurb}</p>
            <ul className="tile__list">
              {d.sports.items.map((s, i) => (
                <li key={i}>
                  <span>{s.matchup}</span>
                  <span className="tile__meta">{s.when}</span>
                </li>
              ))}
            </ul>
            <span className="tile__soon">Placeholder — build me next</span>
          </section>
        </div>
      </main>
    </div>
  );
}
