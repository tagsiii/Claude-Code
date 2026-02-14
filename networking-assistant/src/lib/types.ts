export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  bio: string | null;
  job_title: string | null;
  company: string | null;
  industries: string[];
  goals: string[];
  what_i_offer: string | null;
  what_i_need: string | null;
  networking_style: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  location: string | null;
  industries: string[];
  tags: string[];
  how_we_met: string | null;
  relationship_tier: "inner_circle" | "strong" | "moderate" | "acquaintance" | "dormant";
  context_summary: string | null;
  last_interaction_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  interaction_type: "meeting" | "call" | "email" | "coffee" | "event" | "message" | "other";
  occurred_at: string;
  raw_notes: string | null;
  ai_summary: string | null;
  key_topics: string[];
  commitments_made: string[];
  follow_up_items: string[];
  sentiment: "very_positive" | "positive" | "neutral" | "negative" | "very_negative" | null;
  relationship_strength_delta: number;
  calendar_event_id: string | null;
  created_at: string;
}

export interface RelationshipEdge {
  id: string;
  user_id: string;
  contact_a_id: string;
  contact_b_id: string;
  relationship_type: string;
  strength: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIRecommendation {
  id: string;
  user_id: string;
  contact_id: string | null;
  type: "follow_up" | "introduction_request" | "prep_brief" | "content_to_share" | "network_gap" | "relationship_alert";
  priority: number;
  title: string;
  description: string;
  suggested_message: string | null;
  reasoning: string | null;
  status: "pending" | "accepted" | "dismissed" | "completed";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  contact?: Contact;
}

export interface CallPrep {
  id: string;
  user_id: string;
  contact_id: string;
  calendar_event_id: string | null;
  meeting_purpose: string | null;
  contact_summary: string | null;
  agenda: string | null;
  potential_outcomes: string | null;
  full_document: string | null;
  status: "draft" | "generating" | "ready" | "used";
  meeting_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  contact?: Contact;
}
