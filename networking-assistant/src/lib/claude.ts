import Anthropic from "@anthropic-ai/sdk";
import type { Contact, Interaction, UserProfile } from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

type Model = "claude-sonnet-4-20250514" | "claude-opus-4-0-20250514";

async function callClaude(
  prompt: string,
  systemPrompt: string,
  model: Model = "claude-sonnet-4-20250514",
  maxTokens = 4096
): Promise<string> {
  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }
  throw new Error("Unexpected response type from Claude");
}

// ─── Interaction Processor ───────────────────────────────────────────────────

export interface ProcessedInteraction {
  ai_summary: string;
  key_topics: string[];
  commitments_made: string[];
  follow_up_items: string[];
  sentiment: string;
  relationship_strength_delta: number;
  networking_opportunities: string[];
}

export async function processInteraction(
  rawNotes: string,
  contact: Contact,
  userProfile: UserProfile,
  recentInteractions: Interaction[]
): Promise<ProcessedInteraction> {
  const systemPrompt = `You are an expert networking analyst and relationship intelligence engine. Your job is to analyze meeting notes and extract structured insights that help the user build and maintain meaningful professional relationships.

Always respond with valid JSON matching the requested schema. Be specific and actionable in your analysis.`;

  const interactionHistory = recentInteractions
    .slice(0, 5)
    .map(
      (i) =>
        `- ${i.occurred_at}: ${i.interaction_type} — ${i.ai_summary || i.raw_notes?.slice(0, 200) || "No notes"}`
    )
    .join("\n");

  const prompt = `Analyze this interaction and extract structured insights.

## My Profile
- Name: ${userProfile.full_name}
- Role: ${userProfile.current_role} at ${userProfile.company}
- Goals: ${userProfile.goals.join(", ")}
- What I offer: ${userProfile.what_i_offer || "Not specified"}
- What I need: ${userProfile.what_i_need || "Not specified"}

## Contact: ${contact.full_name}
- Role: ${contact.role} at ${contact.company}
- Relationship tier: ${contact.relationship_tier}
- Industries: ${contact.industries.join(", ")}
- How we met: ${contact.how_we_met || "Unknown"}
- Current AI summary: ${contact.context_summary || "None yet"}

## Recent Interaction History
${interactionHistory || "No previous interactions recorded."}

## Raw Notes from This Interaction
${rawNotes}

Respond with JSON in this exact format:
{
  "ai_summary": "A concise 2-3 sentence summary of the interaction highlighting what matters for the relationship",
  "key_topics": ["topic1", "topic2"],
  "commitments_made": ["commitment1", "commitment2"],
  "follow_up_items": ["follow_up1", "follow_up2"],
  "sentiment": "very_positive|positive|neutral|negative|very_negative",
  "relationship_strength_delta": <-2 to 2, integer>,
  "networking_opportunities": ["opportunity1", "opportunity2"]
}`;

  const result = await callClaude(prompt, systemPrompt);
  return JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());
}

// ─── Context Summary Generator ───────────────────────────────────────────────

export async function generateContextSummary(
  contact: Contact,
  interactions: Interaction[],
  userProfile: UserProfile
): Promise<string> {
  const systemPrompt = `You are a relationship intelligence engine. Generate a concise, living summary of who this person is to the user — their background, the nature of the relationship, key shared interests, mutual value exchange, and current status. Write in second person ("they").`;

  const interactionLog = interactions
    .slice(0, 20)
    .map(
      (i) =>
        `[${i.occurred_at}] ${i.interaction_type}: ${i.ai_summary || i.raw_notes?.slice(0, 300) || "No notes"}`
    )
    .join("\n");

  const prompt = `Generate a living context summary for this contact.

## Contact: ${contact.full_name}
- Role: ${contact.role || "Unknown"} at ${contact.company || "Unknown"}
- Location: ${contact.location || "Unknown"}
- Industries: ${contact.industries.join(", ") || "Unknown"}
- Tags: ${contact.tags.join(", ") || "None"}
- How you met: ${contact.how_we_met || "Unknown"}
- Relationship tier: ${contact.relationship_tier}

## My Goals
${userProfile.goals.join("\n")}

## Interaction History (most recent first)
${interactionLog || "No interactions yet."}

Write a 3-5 sentence summary that captures who this person is to me, the current state of our relationship, and why they matter to my network. Be specific — reference actual conversations and commitments.`;

  return callClaude(prompt, systemPrompt);
}

// ─── Call Prep Agent (Multi-Step Chain) ──────────────────────────────────────

export interface CallPrepResult {
  contact_summary: string;
  agenda: string;
  potential_outcomes: string;
  full_document: string;
}

export async function generateCallPrep(
  contact: Contact,
  interactions: Interaction[],
  userProfile: UserProfile,
  meetingPurpose: string
): Promise<CallPrepResult> {
  const systemPrompt = `You are an elite networking strategist and meeting preparation expert. You draw on frameworks from "Never Eat Alone" by Keith Ferrazzi, "Give and Take" by Adam Grant, and "Supercommunicators" by Charles Duhigg. Your prep documents are specific, actionable, and reference real context from the relationship.`;

  const interactionLog = interactions
    .slice(0, 15)
    .map(
      (i) =>
        `[${i.occurred_at}] ${i.interaction_type}: ${i.ai_summary || i.raw_notes?.slice(0, 300) || "No notes"}
  Topics: ${i.key_topics.join(", ") || "N/A"}
  Commitments: ${i.commitments_made.join(", ") || "N/A"}`
    )
    .join("\n\n");

  // Step 1: Contact summary
  const step1Prompt = `## Step 1: Contact Background & Relationship Summary

Contact: ${contact.full_name}
Role: ${contact.role || "Unknown"} at ${contact.company || "Unknown"}
Industries: ${contact.industries.join(", ") || "Unknown"}
Relationship tier: ${contact.relationship_tier}
How we met: ${contact.how_we_met || "Unknown"}
Current context: ${contact.context_summary || "None"}

Interaction History:
${interactionLog || "No previous interactions."}

Write a comprehensive but concise summary covering:
1. Who they are and what they do
2. Our relationship history and current status
3. Key things I know about their interests, challenges, and goals
4. Any outstanding commitments or follow-ups between us`;

  const contactSummary = await callClaude(step1Prompt, systemPrompt);

  // Step 2: Agenda with networking framework references
  const step2Prompt = `## Step 2: Meeting Agenda

My profile:
- Name: ${userProfile.full_name}
- Role: ${userProfile.current_role} at ${userProfile.company}
- Goals: ${userProfile.goals.join(", ")}
- What I offer: ${userProfile.what_i_offer || "Not specified"}
- What I need: ${userProfile.what_i_need || "Not specified"}

Contact summary (from step 1):
${contactSummary}

Meeting purpose: ${meetingPurpose}

Generate a meeting agenda that:
1. Opens with a personal connection point (reference something specific from our history)
2. Based on the "Give and Take" framework, suggest specific value I can lead with for them
3. Per "Never Eat Alone," identify a specific connector behavior opportunity
4. Includes 3-4 specific talking points with recommended phrasing
5. Ends with a clear ask or next step aligned with my goals

Format as a clean, readable agenda with headers.`;

  const agenda = await callClaude(step2Prompt, systemPrompt);

  // Step 3: Potential outcomes ranked by ambition
  const step3Prompt = `## Step 3: Potential Outcomes

Contact summary:
${contactSummary}

Meeting purpose: ${meetingPurpose}
Agenda:
${agenda}

My goals: ${userProfile.goals.join(", ")}

Generate 3 potential outcomes for this meeting, ranked from most to least ambitious:

For each outcome provide:
- **Outcome name** (1 line)
- **What this looks like**: Specific description
- **How to get there**: Specific language/asks to use
- **Key phrase to deploy**: An exact sentence I could say
- **Why this matters**: How this advances my networking goals

Be bold with the ambitious outcome but realistic with all three.`;

  const potentialOutcomes = await callClaude(
    step3Prompt,
    systemPrompt,
    "claude-opus-4-0-20250514",
    6000
  );

  // Step 4: Compile full document
  const step4Prompt = `## Step 4: Compile Prep Document

Compile the following into a clean, professional meeting prep document with clear sections and formatting. Use markdown.

**Meeting with:** ${contact.full_name} (${contact.role} at ${contact.company})
**Purpose:** ${meetingPurpose}

### Contact Summary
${contactSummary}

### Agenda
${agenda}

### Potential Outcomes
${potentialOutcomes}

Add a "Quick Reference" section at the top with:
- 3 bullet points I absolutely must remember
- 1 thing to avoid (based on relationship history)
- The single most important goal for this meeting

Format the entire document for easy scanning. Use bold, bullets, and headers.`;

  const fullDocument = await callClaude(step4Prompt, systemPrompt);

  return {
    contact_summary: contactSummary,
    agenda,
    potential_outcomes: potentialOutcomes,
    full_document: fullDocument,
  };
}

// ─── Follow-Up Engine ────────────────────────────────────────────────────────

export interface FollowUpRecommendation {
  contact_id: string;
  contact_name: string;
  priority: number;
  reason: string;
  suggested_message: string;
  type: "follow_up" | "introduction_request" | "content_to_share";
}

export async function generateFollowUps(
  contacts: (Contact & { recent_interactions?: Interaction[] })[],
  userProfile: UserProfile
): Promise<FollowUpRecommendation[]> {
  const systemPrompt = `You are a strategic networking advisor. Analyze the user's contacts and generate prioritized follow-up recommendations. Focus on maintaining relationship momentum, fulfilling commitments, and advancing the user's goals. Always respond with valid JSON.`;

  const contactList = contacts
    .map((c) => {
      const lastInteraction = c.recent_interactions?.[0];
      return `- ${c.full_name} (${c.role || "?"} at ${c.company || "?"})
    ID: ${c.id}
    Tier: ${c.relationship_tier}
    Last interaction: ${c.last_interaction_at || "Never"}
    Last summary: ${lastInteraction?.ai_summary || "N/A"}
    Outstanding follow-ups: ${lastInteraction?.follow_up_items?.join("; ") || "None"}
    Tags: ${c.tags.join(", ") || "None"}`;
    })
    .join("\n\n");

  const prompt = `Review my network and suggest who I should reach out to this week.

## My Profile
- Goals: ${userProfile.goals.join(", ")}
- What I offer: ${userProfile.what_i_offer || "Not specified"}
- What I need: ${userProfile.what_i_need || "Not specified"}
- Today's date: ${new Date().toISOString().split("T")[0]}

## My Contacts
${contactList}

Return a JSON array of up to 10 recommendations, ordered by priority (1 = highest):
[
  {
    "contact_id": "uuid",
    "contact_name": "Name",
    "priority": 1,
    "reason": "Specific reason why now is the right time to reach out",
    "suggested_message": "A draft message I could send them",
    "type": "follow_up|introduction_request|content_to_share"
  }
]

Prioritize:
1. People with outstanding commitments or follow-ups
2. Strong relationships going dormant (no contact in 30+ days)
3. People aligned with my current goals
4. Moderate/acquaintance contacts worth investing in`;

  const result = await callClaude(prompt, systemPrompt, "claude-sonnet-4-20250514", 6000);
  return JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());
}

// ─── Network Expander ────────────────────────────────────────────────────────

export interface NetworkExpansion {
  existing_intros: { contact_name: string; reason: string }[];
  network_requests: { description: string; ask_phrasing: string }[];
  value_adds: { content_or_topic: string; why: string }[];
}

export async function analyzeNetworkExpansion(
  newContact: Contact,
  existingContacts: Contact[],
  userProfile: UserProfile
): Promise<NetworkExpansion> {
  const systemPrompt = `You are a network strategy expert. Analyze how a new contact fits into the user's existing network and identify mutual value opportunities. Respond with valid JSON.`;

  const existingList = existingContacts
    .slice(0, 30)
    .map(
      (c) =>
        `- ${c.full_name}: ${c.role || "?"} at ${c.company || "?"} (${c.industries.join(", ")}) [${c.relationship_tier}]`
    )
    .join("\n");

  const prompt = `I just added a new contact. Analyze how they fit into my network.

## New Contact: ${newContact.full_name}
- Role: ${newContact.role || "Unknown"} at ${newContact.company || "Unknown"}
- Industries: ${newContact.industries.join(", ") || "Unknown"}
- How we met: ${newContact.how_we_met || "Unknown"}
- Tags: ${newContact.tags.join(", ") || "None"}

## My Profile
- Goals: ${userProfile.goals.join(", ")}
- What I offer: ${userProfile.what_i_offer || "Not specified"}
- What I need: ${userProfile.what_i_need || "Not specified"}

## My Existing Network
${existingList}

Respond with JSON:
{
  "existing_intros": [
    {"contact_name": "Name from existing network", "reason": "Why this intro makes sense for both parties"}
  ],
  "network_requests": [
    {"description": "Type of person in their network I should ask for intro to", "ask_phrasing": "How to ask naturally"}
  ],
  "value_adds": [
    {"content_or_topic": "Something I could share or discuss", "why": "Why this adds value to them specifically"}
  ]
}`;

  const result = await callClaude(prompt, systemPrompt);
  return JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());
}

// ─── Weekly Brief ────────────────────────────────────────────────────────────

export async function generateWeeklyBrief(
  contacts: Contact[],
  recentInteractions: Interaction[],
  userProfile: UserProfile
): Promise<string> {
  const systemPrompt = `You are a strategic networking advisor preparing a weekly "State of Your Network" brief. Be direct, specific, and actionable. Use markdown formatting.`;

  const contactSummary = contacts
    .map(
      (c) =>
        `- ${c.full_name} (${c.relationship_tier}): Last interaction ${c.last_interaction_at || "never"}, ${c.role || "?"} at ${c.company || "?"}`
    )
    .join("\n");

  const recentLog = recentInteractions
    .slice(0, 20)
    .map(
      (i) =>
        `- ${i.occurred_at}: ${i.ai_summary || i.raw_notes?.slice(0, 150) || "No notes"}`
    )
    .join("\n");

  const prompt = `Generate my weekly "State of Your Network" brief.

## My Profile
- Goals: ${userProfile.goals.join(", ")}
- Industries: ${userProfile.industries.join(", ")}

## All Contacts (${contacts.length} total)
${contactSummary}

## Recent Interactions (past 7 days)
${recentLog || "No interactions this week."}

## Today's Date: ${new Date().toISOString().split("T")[0]}

Write a brief covering:
1. **This Week's Highlights**: Key relationship developments
2. **Relationships Growing**: Who you're building momentum with
3. **Relationships Cooling**: Contacts going dormant that matter
4. **Network Gaps**: Types of connections missing relative to my goals
5. **Over/Under-Invested**: Am I spending time with the right people?
6. **Top 3 Actions This Week**: Specific, named recommendations

Keep it under 800 words. Be candid — if I'm neglecting important relationships, say so.`;

  return callClaude(
    prompt,
    systemPrompt,
    "claude-opus-4-0-20250514",
    4000
  );
}
