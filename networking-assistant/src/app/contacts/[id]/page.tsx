"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Brain,
  Calendar,
  MessageSquare,
  Phone,
  Coffee,
  Mail,
  Users,
  Sparkles,
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { Contact, Interaction, AIRecommendation, CallPrep } from "@/lib/types";
import type { NetworkExpansion } from "@/lib/claude";

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [preps, setPreps] = useState<CallPrep[]>([]);
  const [networkExpansion, setNetworkExpansion] = useState<NetworkExpansion | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandingNetwork, setExpandingNetwork] = useState(false);

  // Interaction form
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    interaction_type: "meeting",
    raw_notes: "",
    occurred_at: new Date().toISOString().split("T")[0],
  });
  const [submittingInteraction, setSubmittingInteraction] = useState(false);

  // Call prep form
  const [showPrepForm, setShowPrepForm] = useState(false);
  const [prepForm, setPrepForm] = useState({
    meeting_purpose: "",
    meeting_at: "",
  });
  const [generatingPrep, setGeneratingPrep] = useState(false);

  useEffect(() => {
    loadContact();
  }, [contactId]);

  async function loadContact() {
    setLoading(true);
    try {
      const [contactRes, interactionsRes, recsRes, prepsRes] = await Promise.all([
        fetch(`/api/contacts?id=${contactId}`),
        fetch(`/api/interactions?contact_id=${contactId}`),
        fetch(`/api/recommendations?status=pending`),
        fetch(`/api/claude/call-prep?contact_id=${contactId}`),
      ]);

      if (contactRes.ok) {
        const data = await contactRes.json();
        setContact(Array.isArray(data) ? data[0] : data);
      }
      if (interactionsRes.ok) setInteractions(await interactionsRes.json());
      if (recsRes.ok) {
        const allRecs = await recsRes.json();
        setRecommendations(
          allRecs.filter((r: AIRecommendation) => r.contact_id === contactId)
        );
      }
      if (prepsRes.ok) setPreps(await prepsRes.json());
    } catch (err) {
      console.error("Failed to load contact:", err);
    }
    setLoading(false);
  }

  async function logInteraction(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingInteraction(true);
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          ...interactionForm,
          occurred_at: new Date(interactionForm.occurred_at).toISOString(),
        }),
      });
      if (res.ok) {
        setShowInteractionForm(false);
        setInteractionForm({
          interaction_type: "meeting",
          raw_notes: "",
          occurred_at: new Date().toISOString().split("T")[0],
        });
        await loadContact();
      }
    } catch (err) {
      console.error("Failed to log interaction:", err);
    }
    setSubmittingInteraction(false);
  }

  async function generateCallPrep(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingPrep(true);
    try {
      const res = await fetch("/api/claude/call-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          meeting_purpose: prepForm.meeting_purpose,
          meeting_at: prepForm.meeting_at
            ? new Date(prepForm.meeting_at).toISOString()
            : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowPrepForm(false);
        router.push(`/prep/${data.id}`);
      }
    } catch (err) {
      console.error("Failed to generate prep:", err);
    }
    setGeneratingPrep(false);
  }

  async function analyzeNetwork() {
    setExpandingNetwork(true);
    try {
      const res = await fetch("/api/claude/network-expander", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId }),
      });
      if (res.ok) setNetworkExpansion(await res.json());
    } catch (err) {
      console.error("Failed to analyze network:", err);
    }
    setExpandingNetwork(false);
  }

  const interactionIcons: Record<string, React.ReactNode> = {
    meeting: <Users className="h-4 w-4" />,
    call: <Phone className="h-4 w-4" />,
    email: <Mail className="h-4 w-4" />,
    coffee: <Coffee className="h-4 w-4" />,
    message: <MessageSquare className="h-4 w-4" />,
    event: <Calendar className="h-4 w-4" />,
    other: <MessageSquare className="h-4 w-4" />,
  };

  if (loading || !contact) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {contact.full_name}
          </h1>
          <p className="text-zinc-500">
            {[contact.role, contact.company].filter(Boolean).join(" at ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowInteractionForm(true)}>
            <MessageSquare className="h-4 w-4" />
            Log Interaction
          </Button>
          <Button variant="outline" onClick={() => setShowPrepForm(true)}>
            <FileText className="h-4 w-4" />
            Prep Call
          </Button>
          <Button variant="outline" onClick={analyzeNetwork} disabled={expandingNetwork}>
            <Sparkles className={`h-4 w-4 ${expandingNetwork ? "animate-pulse" : ""}`} />
            {expandingNetwork ? "Analyzing..." : "Network Analysis"}
          </Button>
        </div>
      </div>

      {/* Log Interaction Form */}
      {showInteractionForm && (
        <Card>
          <CardHeader>
            <CardTitle>Log Interaction</CardTitle>
            <CardDescription>
              Claude will analyze your notes and extract key insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={logInteraction} className="space-y-4">
              <div className="flex gap-4">
                <Select
                  value={interactionForm.interaction_type}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      interaction_type: e.target.value,
                    })
                  }
                  className="w-40"
                >
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="coffee">Coffee</option>
                  <option value="event">Event</option>
                  <option value="message">Message</option>
                  <option value="other">Other</option>
                </Select>
                <Input
                  type="date"
                  value={interactionForm.occurred_at}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      occurred_at: e.target.value,
                    })
                  }
                  className="w-44"
                />
              </div>
              <Textarea
                placeholder="What happened? Include key topics, commitments, follow-ups... Claude will structure this for you."
                rows={6}
                value={interactionForm.raw_notes}
                onChange={(e) =>
                  setInteractionForm({
                    ...interactionForm,
                    raw_notes: e.target.value,
                  })
                }
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowInteractionForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingInteraction}>
                  {submittingInteraction ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing with Claude...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4" />
                      Log & Analyze
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Call Prep Form */}
      {showPrepForm && (
        <Card>
          <CardHeader>
            <CardTitle>Generate Call Prep</CardTitle>
            <CardDescription>
              Claude will create a multi-step prep document with agenda, talking
              points, and potential outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={generateCallPrep} className="space-y-4">
              <Textarea
                placeholder="What's the purpose of this meeting? What do you want to accomplish?"
                required
                value={prepForm.meeting_purpose}
                onChange={(e) =>
                  setPrepForm({ ...prepForm, meeting_purpose: e.target.value })
                }
              />
              <Input
                type="datetime-local"
                value={prepForm.meeting_at}
                onChange={(e) =>
                  setPrepForm({ ...prepForm, meeting_at: e.target.value })
                }
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowPrepForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={generatingPrep}>
                  {generatingPrep ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating (4-step Claude chain)...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4" />
                      Generate Prep
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Context Summary */}
          {contact.context_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Relationship Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {contact.context_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Network Expansion Analysis */}
          {networkExpansion && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Network Expansion Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {networkExpansion.existing_intros.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">
                      Introduce them to:
                    </h4>
                    {networkExpansion.existing_intros.map((intro, i) => (
                      <div
                        key={i}
                        className="text-sm text-zinc-600 dark:text-zinc-400 mb-1"
                      >
                        <strong>{intro.contact_name}</strong>: {intro.reason}
                      </div>
                    ))}
                  </div>
                )}
                {networkExpansion.network_requests.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">
                      Ask for intros to:
                    </h4>
                    {networkExpansion.network_requests.map((req, i) => (
                      <div
                        key={i}
                        className="text-sm text-zinc-600 dark:text-zinc-400 mb-2"
                      >
                        <p>{req.description}</p>
                        <p className="text-xs text-zinc-500 italic mt-0.5">
                          &quot;{req.ask_phrasing}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {networkExpansion.value_adds.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">
                      Value you can add:
                    </h4>
                    {networkExpansion.value_adds.map((va, i) => (
                      <div
                        key={i}
                        className="text-sm text-zinc-600 dark:text-zinc-400 mb-1"
                      >
                        <strong>{va.content_or_topic}</strong>: {va.why}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Interaction Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Interaction Timeline</CardTitle>
              <CardDescription>
                {interactions.length} recorded interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {interactions.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-6">
                  No interactions recorded yet. Log your first one above.
                </p>
              ) : (
                <div className="space-y-4">
                  {interactions.map((interaction) => (
                    <div
                      key={interaction.id}
                      className="flex gap-4 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700"
                    >
                      <div className="flex-shrink-0 mt-0.5 text-zinc-400">
                        {interactionIcons[interaction.interaction_type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">
                            {interaction.interaction_type}
                          </Badge>
                          <span className="text-xs text-zinc-500">
                            {new Date(interaction.occurred_at).toLocaleDateString()}
                          </span>
                          {interaction.sentiment && (
                            <Badge
                              variant={
                                interaction.sentiment.includes("positive")
                                  ? "success"
                                  : interaction.sentiment.includes("negative")
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {interaction.sentiment.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>

                        {interaction.ai_summary && (
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">
                            {interaction.ai_summary}
                          </p>
                        )}

                        {interaction.raw_notes && !interaction.ai_summary && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                            {interaction.raw_notes}
                          </p>
                        )}

                        {interaction.key_topics.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {interaction.key_topics.map((topic) => (
                              <Badge key={topic} variant="outline" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {interaction.follow_up_items.length > 0 && (
                          <div className="text-xs text-zinc-500 mt-1">
                            Follow-ups: {interaction.follow_up_items.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {contact.email && (
                <div>
                  <span className="text-zinc-500">Email:</span>{" "}
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div>
                  <span className="text-zinc-500">Phone:</span>{" "}
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.location && (
                <div>
                  <span className="text-zinc-500">Location:</span>{" "}
                  <span>{contact.location}</span>
                </div>
              )}
              {contact.how_we_met && (
                <div>
                  <span className="text-zinc-500">How we met:</span>{" "}
                  <span>{contact.how_we_met}</span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">Tier:</span>{" "}
                <Badge variant="secondary">
                  {contact.relationship_tier.replace(/_/g, " ")}
                </Badge>
              </div>
              {contact.industries.length > 0 && (
                <div>
                  <span className="text-zinc-500">Industries:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.industries.map((ind) => (
                      <Badge key={ind} variant="outline" className="text-xs">
                        {ind}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Recommendations for this contact */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4" />
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="text-sm border-l-2 border-purple-300 pl-3"
                  >
                    <p className="font-medium">{rec.title}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {rec.description}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Call Preps */}
          {preps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Call Preps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {preps.map((prep) => (
                  <Link
                    key={prep.id}
                    href={`/prep/${prep.id}`}
                    className="block rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <p className="text-sm font-medium">
                      {prep.meeting_purpose || "Meeting prep"}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge
                        variant={prep.status === "ready" ? "success" : "secondary"}
                      >
                        {prep.status}
                      </Badge>
                      {prep.meeting_at && (
                        <span className="text-xs text-zinc-500">
                          {new Date(prep.meeting_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
