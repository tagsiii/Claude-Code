"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MessageSquare,
  TrendingUp,
  UserPlus,
  RefreshCw,
  Brain,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Network,
} from "lucide-react";
import Link from "next/link";
import type { AIRecommendation, CallPrep, Contact } from "@/lib/types";

export default function Dashboard() {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [upcomingPreps, setUpcomingPreps] = useState<CallPrep[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [weeklyBrief, setWeeklyBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingFollowUps, setGeneratingFollowUps] = useState(false);
  const [generatingBrief, setGeneratingBrief] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [recsRes, prepsRes, contactsRes] = await Promise.all([
        fetch("/api/recommendations?status=pending&limit=10"),
        fetch("/api/claude/call-prep"),
        fetch("/api/contacts"),
      ]);

      if (recsRes.ok) setRecommendations(await recsRes.json());
      if (prepsRes.ok) setUpcomingPreps(await prepsRes.json());
      if (contactsRes.ok) setContacts(await contactsRes.json());
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
    setLoading(false);
  }

  async function generateFollowUps() {
    setGeneratingFollowUps(true);
    try {
      const res = await fetch("/api/claude/follow-up", { method: "POST" });
      if (res.ok) {
        await loadDashboard();
      }
    } catch (err) {
      console.error("Failed to generate follow-ups:", err);
    }
    setGeneratingFollowUps(false);
  }

  async function generateBrief() {
    setGeneratingBrief(true);
    try {
      const res = await fetch("/api/claude/weekly-brief", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setWeeklyBrief(data.brief);
      }
    } catch (err) {
      console.error("Failed to generate brief:", err);
    }
    setGeneratingBrief(false);
  }

  async function updateRecommendation(id: string, status: "accepted" | "dismissed") {
    await fetch("/api/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }

  const tierCounts = contacts.reduce(
    (acc, c) => {
      acc[c.relationship_tier] = (acc[c.relationship_tier] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const recentContacts = contacts.filter(
    (c) =>
      c.last_interaction_at &&
      new Date(c.last_interaction_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );

  const dormantContacts = contacts.filter(
    (c) =>
      c.last_interaction_at &&
      new Date(c.last_interaction_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="text-zinc-500 mt-1">
            Your AI-powered networking command center
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={generateFollowUps}
            disabled={generatingFollowUps}
          >
            <RefreshCw
              className={`h-4 w-4 ${generatingFollowUps ? "animate-spin" : ""}`}
            />
            {generatingFollowUps ? "Analyzing..." : "Generate Follow-ups"}
          </Button>
          <Button
            variant="outline"
            onClick={generateBrief}
            disabled={generatingBrief}
          >
            <Brain className={`h-4 w-4 ${generatingBrief ? "animate-pulse" : ""}`} />
            {generatingBrief ? "Generating..." : "Weekly Brief"}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{contacts.length}</p>
                <p className="text-sm text-zinc-500">Total Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-green-50 p-2 dark:bg-green-950">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentContacts.length}</p>
                <p className="text-sm text-zinc-500">Active This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dormantContacts.length}</p>
                <p className="text-sm text-zinc-500">Going Dormant</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950">
                <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recommendations.length}</p>
                <p className="text-sm text-zinc-500">Action Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Follow-up Queue */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Follow-up Queue
              </CardTitle>
              <CardDescription>
                Claude-generated recommendations based on your network and goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No pending recommendations.</p>
                  <p className="text-sm mt-1">
                    Click &quot;Generate Follow-ups&quot; to have Claude analyze
                    your network.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-start gap-4 rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{rec.title}</p>
                          <Badge
                            variant={
                              rec.type === "follow_up"
                                ? "secondary"
                                : rec.type === "introduction_request"
                                  ? "success"
                                  : "warning"
                            }
                          >
                            {rec.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                          {rec.description}
                        </p>
                        {rec.suggested_message && (
                          <div className="rounded bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            <p className="text-xs font-medium text-zinc-500 mb-1">
                              Suggested message:
                            </p>
                            {rec.suggested_message}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => updateRecommendation(rec.id, "accepted")}
                          title="Accept"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => updateRecommendation(rec.id, "dismissed")}
                          title="Dismiss"
                        >
                          <XCircle className="h-4 w-4 text-zinc-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Brief */}
          {weeklyBrief && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  State of Your Network
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm prose-zinc dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(weeklyBrief) }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Upcoming Preps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Upcoming Meetings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingPreps.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">
                  No upcoming meeting preps
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingPreps.slice(0, 5).map((prep) => (
                    <Link
                      key={prep.id}
                      href={`/prep/${prep.id}`}
                      className="block rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <p className="font-medium text-sm">
                        {prep.contact?.full_name || "Unknown"}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {prep.meeting_purpose || "No purpose set"}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge
                          variant={
                            prep.status === "ready" ? "success" : "secondary"
                          }
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relationship Tiers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Relationship Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { tier: "inner_circle", label: "Inner Circle", color: "bg-purple-500" },
                  { tier: "strong", label: "Strong", color: "bg-blue-500" },
                  { tier: "moderate", label: "Moderate", color: "bg-green-500" },
                  { tier: "acquaintance", label: "Acquaintance", color: "bg-zinc-400" },
                  { tier: "dormant", label: "Dormant", color: "bg-zinc-300" },
                ].map(({ tier, label, color }) => (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${color}`} />
                      <span className="text-sm">{label}</span>
                    </div>
                    <span className="text-sm font-medium">
                      {tierCounts[tier] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/contacts?new=true">
                <Button variant="outline" className="w-full justify-start">
                  <UserPlus className="h-4 w-4" />
                  Add Contact
                </Button>
              </Link>
              <Link href="/contacts">
                <Button variant="outline" className="w-full justify-start mt-2">
                  <Users className="h-4 w-4" />
                  View All Contacts
                </Button>
              </Link>
              <Link href="/network">
                <Button variant="outline" className="w-full justify-start mt-2">
                  <Network className="h-4 w-4" />
                  Network Map
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Simple markdown-to-HTML converter for the brief
function formatMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "<br/><br/>");
}

