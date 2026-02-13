"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Brain,
  RefreshCw,
  Loader2,
  CheckCircle,
  FileText,
  Target,
  MessageSquare,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import type { CallPrep } from "@/lib/types";

export default function PrepViewPage() {
  const params = useParams();
  const prepId = params.id as string;

  const [prep, setPrep] = useState<CallPrep | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"full" | "summary" | "agenda" | "outcomes">("full");
  const [regenerating, setRegenerating] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");

  useEffect(() => {
    loadPrep();
  }, [prepId]);

  async function loadPrep() {
    setLoading(true);
    try {
      const res = await fetch(`/api/claude/call-prep?id=${prepId}`);
      if (res.ok) {
        const data = await res.json();
        setPrep(data);
        setNewPurpose(data.meeting_purpose || "");
      }
    } catch (err) {
      console.error("Failed to load prep:", err);
    }
    setLoading(false);
  }

  async function regeneratePrep() {
    if (!prep) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/claude/call-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: prep.contact_id,
          meeting_purpose: newPurpose,
          meeting_at: prep.meeting_at,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reload with new ID
        window.location.href = `/prep/${data.id}`;
      }
    } catch (err) {
      console.error("Failed to regenerate:", err);
    }
    setRegenerating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mx-auto" />
          <p className="text-sm text-zinc-500 mt-2">Loading prep document...</p>
        </div>
      </div>
    );
  }

  if (!prep) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500">Prep document not found</p>
      </div>
    );
  }

  const tabs = [
    { id: "full" as const, label: "Full Document", icon: FileText },
    { id: "summary" as const, label: "Contact Summary", icon: Brain },
    { id: "agenda" as const, label: "Agenda", icon: Target },
    { id: "outcomes" as const, label: "Outcomes", icon: Lightbulb },
  ];

  const content: Record<string, string | null> = {
    full: prep.full_document,
    summary: prep.contact_summary,
    agenda: prep.agenda,
    outcomes: prep.potential_outcomes,
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={prep.contact_id ? `/contacts/${prep.contact_id}` : "/contacts"}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Call Prep: {prep.contact?.full_name || "Unknown"}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge
              variant={
                prep.status === "ready"
                  ? "success"
                  : prep.status === "generating"
                    ? "warning"
                    : "secondary"
              }
            >
              {prep.status === "ready" && <CheckCircle className="h-3 w-3 mr-1" />}
              {prep.status === "generating" && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {prep.status}
            </Badge>
            {prep.meeting_at && (
              <span className="text-sm text-zinc-500">
                {new Date(prep.meeting_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Purpose editor + regenerate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Meeting Purpose
          </CardTitle>
          <CardDescription>
            Edit the purpose and regenerate for a fresh prep document
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Textarea
              value={newPurpose}
              onChange={(e) => setNewPurpose(e.target.value)}
              placeholder="What's the purpose of this meeting?"
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={regeneratePrep}
              disabled={regenerating || !newPurpose}
              className="self-end"
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {prep.status === "generating" ? (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 mx-auto text-zinc-400 animate-pulse" />
              <p className="text-zinc-500 mt-3">
                Claude is running the 4-step prep chain...
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Step 1: Contact summary → Step 2: Agenda → Step 3: Outcomes →
                Step 4: Compile
              </p>
            </div>
          ) : content[activeTab] ? (
            <div
              className="prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: formatMarkdown(content[activeTab]!),
              }}
            />
          ) : (
            <p className="text-zinc-500 text-center py-8">
              No content available for this section
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMarkdown(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/\n\n/g, "<br/><br/>");
}
