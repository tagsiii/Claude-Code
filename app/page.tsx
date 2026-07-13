import { content } from "./content";
import Nav from "./components/Nav";
import Reveal from "./components/Reveal";

export default function Home() {
  const { hero, journal, about, work, contact, footer } = content;
  const [featured, ...rest] = journal.posts;

  return (
    <>
      <Nav />

      <main>
        {/* ── Hero ───────────────────────────────── */}
        <section className="hero">
          <div className="hero__bg" aria-hidden="true" />
          <div className="container">
            <Reveal>
              <p className="eyebrow eyebrow--light">{hero.eyebrow}</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="hero__headline">{hero.headline}</h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="hero__subhead">{hero.subhead}</p>
            </Reveal>
            <Reveal delay={240}>
              <div className="hero__cta">
                <a className="btn btn--primary" href={`#${hero.ctaPrimary.id}`}>
                  {hero.ctaPrimary.label}
                </a>
                <a className="btn btn--ghost" href={`#${hero.ctaSecondary.id}`}>
                  {hero.ctaSecondary.label} <span aria-hidden="true">→</span>
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Journal (blog) ─────────────────────── */}
        <section id={journal.id} className="section section--journal">
          <div className="container">
            <Reveal>
              <p className="eyebrow">{journal.eyebrow}</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="section__headline">{journal.headline}</h2>
            </Reveal>

            <Reveal delay={120}>
              <a className="post post--featured" href={featured.link}>
                <div className="post__media" aria-hidden="true">
                  <span className="post__initial">
                    {featured.title.replace("Placeholder: ", "").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="post__body">
                  <div className="post__meta">
                    <span className="post__category">{featured.category}</span>
                    <span className="post__date">{featured.date}</span>
                  </div>
                  <h3 className="post__title">{featured.title}</h3>
                  <p className="post__excerpt">{featured.excerpt}</p>
                  <span className="post__read">Read the post →</span>
                </div>
              </a>
            </Reveal>

            <div className="post__grid">
              {rest.map((post, i) => (
                <Reveal key={post.title} delay={80 * i} className="post-wrap">
                  <a className="post" href={post.link}>
                    <div className="post__body">
                      <div className="post__meta">
                        <span className="post__category">{post.category}</span>
                        <span className="post__date">{post.date}</span>
                      </div>
                      <h3 className="post__title post__title--small">{post.title}</h3>
                      <p className="post__excerpt">{post.excerpt}</p>
                      <span className="post__read">Read →</span>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── About ──────────────────────────────── */}
        <section id={about.id} className="section">
          <div className="container container--narrow">
            <Reveal>
              <p className="eyebrow">{about.eyebrow}</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="section__headline">{about.headline}</h2>
            </Reveal>
            <div className="about__body">
              {about.paragraphs.map((p, i) => (
                <Reveal key={i} delay={120 + i * 60} as="p">
                  {p}
                </Reveal>
              ))}
            </div>
            <div className="stats">
              {about.stats.map((s, i) => (
                <Reveal key={s.label} delay={100 + i * 80} className="stat">
                  <span className="stat__value">{s.value}</span>
                  <span className="stat__label">{s.label}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Work ───────────────────────────────── */}
        <section id={work.id} className="section section--alt">
          <div className="container">
            <Reveal>
              <p className="eyebrow">{work.eyebrow}</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="section__headline">{work.headline}</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="section__intro">{work.intro}</p>
            </Reveal>
            <div className="work__grid">
              {work.projects.map((proj, i) => (
                <Reveal key={proj.title} delay={80 * (i % 2)} className="card-wrap">
                  <a className="card" href={proj.link}>
                    <div className="card__media" aria-hidden="true">
                      <span className="card__initial">{proj.title.charAt(0)}</span>
                    </div>
                    <div className="card__body">
                      <span className="card__category">{proj.category}</span>
                      <h3 className="card__title">{proj.title}</h3>
                      <p className="card__desc">{proj.description}</p>
                      <span className="card__link">
                        View <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contact ────────────────────────────── */}
        <section id={contact.id} className="section section--contact">
          <div className="container container--narrow center">
            <Reveal>
              <p className="eyebrow">{contact.eyebrow}</p>
            </Reveal>
            <Reveal delay={60}>
              <h2 className="section__headline">{contact.headline}</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="section__intro">{contact.subhead}</p>
            </Reveal>
            <Reveal delay={180}>
              <a className="btn btn--primary btn--lg" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </Reveal>
            <Reveal delay={240}>
              <div className="contact__links">
                {contact.links.map((l) => (
                  <a key={l.label} href={l.href}>
                    {l.label}
                  </a>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">{footer.text}</div>
      </footer>
    </>
  );
}
