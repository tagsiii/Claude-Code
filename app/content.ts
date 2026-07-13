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
    description: "Personal site and journal of Trey Seabrooke.",
  },

  // Top navigation. `id` must match a section id below.
  nav: {
    brand: "Trey Seabrooke",
    links: [
      { label: "Journal", id: "journal" },
      { label: "About", id: "about" },
      { label: "Work", id: "work" },
      { label: "Contact", id: "contact" },
    ],
    login: { label: "Log in", href: "/login" },
  },

  // Opening section — blog-style masthead
  hero: {
    eyebrow: "Journal",
    headline: "Trey Seabrooke",
    subhead:
      "Notes on what I'm building, reading, and thinking about. Replace this with one sentence that tells a stranger what they'll find here.",
    ctaPrimary: { label: "Read the journal", id: "journal" },
    ctaSecondary: { label: "About me", id: "about" },
  },

  // ── Blog / journal posts ──────────────────────
  // Newest first. The first post renders as the featured story.
  journal: {
    id: "journal",
    eyebrow: "Latest writing",
    headline: "The journal.",
    posts: [
      {
        title: "Placeholder: the first post",
        category: "Essay",
        date: "July 2026",
        excerpt:
          "This is your featured post slot. Replace it with your best or most recent piece — two or three sentences that make someone want to click through.",
        link: "#",
      },
      {
        title: "Placeholder: a shorter note",
        category: "Notes",
        date: "June 2026",
        excerpt:
          "A quick thought, a link with commentary, or a work-in-progress update.",
        link: "#",
      },
      {
        title: "Placeholder: something you read",
        category: "Reading",
        date: "June 2026",
        excerpt:
          "A book or article that changed your mind, and why it stuck with you.",
        link: "#",
      },
      {
        title: "Placeholder: a project log",
        category: "Building",
        date: "May 2026",
        excerpt:
          "What you shipped, what broke, and what you learned along the way.",
        link: "#",
      },
    ],
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

// ─────────────────────────────────────────────────────────────
// DASHBOARD CONTENT (behind /login)
// Each tool below is a placeholder — flesh them out one at a time.
// ─────────────────────────────────────────────────────────────

export const dashboard = {
  greeting: "Good to see you, Trey.",
  subhead: "Your day, your tools, one place.",

  reads: {
    title: "Interesting Reads",
    blurb: "A reading queue you actually get through.",
    items: [
      { title: "Placeholder article one", source: "Source", link: "#" },
      { title: "Placeholder article two", source: "Source", link: "#" },
      { title: "Placeholder longread three", source: "Source", link: "#" },
    ],
  },

  meals: {
    title: "Meal Plan",
    blurb: "This week's menu at a glance.",
    days: [
      { day: "Mon", meal: "Placeholder meal" },
      { day: "Tue", meal: "Placeholder meal" },
      { day: "Wed", meal: "Placeholder meal" },
      { day: "Thu", meal: "Placeholder meal" },
      { day: "Fri", meal: "Placeholder meal" },
    ],
  },

  workouts: {
    title: "Workout Plan",
    blurb: "The split. Show up, follow it.",
    days: [
      { day: "Mon", focus: "Push — placeholder" },
      { day: "Tue", focus: "Pull — placeholder" },
      { day: "Wed", focus: "Legs — placeholder" },
      { day: "Thu", focus: "Conditioning — placeholder" },
      { day: "Fri", focus: "Full body — placeholder" },
    ],
  },

  calendar: {
    title: "Calendar",
    blurb:
      "Paste a Google Calendar embed URL into embedUrl below and it will render here.",
    // Example: "https://calendar.google.com/calendar/embed?src=YOUR_ID&mode=WEEK"
    embedUrl: "",
  },

  events: {
    title: "Fun Events",
    blurb: "Things worth leaving the house for.",
    items: [
      { name: "Placeholder event", when: "Date TBD", where: "Venue" },
      { name: "Placeholder concert", when: "Date TBD", where: "Venue" },
      { name: "Placeholder festival", when: "Date TBD", where: "Venue" },
    ],
  },

  people: {
    name: "People to Meet",
    title: "People to Meet",
    blurb: "Your networking short-list.",
    items: [
      { name: "Placeholder person", why: "Why you want to connect" },
      { name: "Placeholder person", why: "Why you want to connect" },
      { name: "Placeholder person", why: "Why you want to connect" },
    ],
  },

  sports: {
    title: "Sports Events",
    blurb: "Games on the horizon.",
    items: [
      { matchup: "Placeholder vs. Placeholder", when: "Date TBD" },
      { matchup: "Placeholder vs. Placeholder", when: "Date TBD" },
      { matchup: "Placeholder vs. Placeholder", when: "Date TBD" },
    ],
  },

  statecraft: {
    title: "Economic Statecraft Monitor",
    blurb:
      "Your monitor will live here on this domain, behind its own login. This tile is the placeholder entry point.",
    href: "/dashboard/statecraft",
  },
};
