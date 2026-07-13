// ─────────────────────────────────────────────────────────────
// EDIT YOUR SITE HERE
// This file holds every piece of text and every link on the page.
// Change the values below and the site updates. No other file needed
// for normal copy edits. (Ask Claude Code: "update my content.ts")
// ─────────────────────────────────────────────────────────────

export const content = {
  // Shows in the browser tab + social previews
  meta: {
    title: "Trey Seabrooke",
    description: "Personal site of Trey Seabrooke.",
  },

  // Top navigation. `id` must match a section id below.
  nav: {
    brand: "Trey Seabrooke",
    links: [
      { label: "About", id: "about" },
      { label: "Work", id: "work" },
      { label: "Contact", id: "contact" },
    ],
  },

  // Full-height opening section
  hero: {
    eyebrow: "Portfolio",
    headline: "Trey Seabrooke",
    subhead:
      "A short, confident line about who you are and what you do. Replace this with one sentence that would make a stranger want to keep scrolling.",
    ctaPrimary: { label: "See the work", id: "work" },
    ctaSecondary: { label: "Get in touch", id: "contact" },
  },

  about: {
    id: "about",
    eyebrow: "About",
    headline: "A little about me.",
    paragraphs: [
      "Replace this with your real bio. Two or three short paragraphs work best — who you are, what you focus on, and what you care about.",
      "Keep sentences tight. This section is where a recruiter or client decides whether to keep reading, so lead with the most important thing about you.",
    ],
    stats: [
      { value: "5+", label: "Years experience" },
      { value: "20+", label: "Projects shipped" },
      { value: "∞", label: "Cups of coffee" },
    ],
  },

  work: {
    id: "work",
    eyebrow: "Work",
    headline: "Selected projects.",
    intro: "A few things I'm proud of. Swap these for your real work.",
    projects: [
      {
        title: "Project One",
        category: "Category",
        description:
          "One or two sentences on what this project was and your role in it.",
        link: "#",
      },
      {
        title: "Project Two",
        category: "Category",
        description:
          "One or two sentences on what this project was and your role in it.",
        link: "#",
      },
      {
        title: "Project Three",
        category: "Category",
        description:
          "One or two sentences on what this project was and your role in it.",
        link: "#",
      },
      {
        title: "Project Four",
        category: "Category",
        description:
          "One or two sentences on what this project was and your role in it.",
        link: "#",
      },
    ],
  },

  contact: {
    id: "contact",
    eyebrow: "Contact",
    headline: "Let's talk.",
    subhead:
      "The best way to reach me is by email. Replace the address and links below with your own.",
    email: "treyseabrooke@gmail.com",
    links: [
      { label: "LinkedIn", href: "#" },
      { label: "GitHub", href: "#" },
      { label: "Twitter / X", href: "#" },
    ],
  },

  footer: {
    text: "© " + new Date().getFullYear() + " Trey Seabrooke",
  },
};
