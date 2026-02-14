"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [form, setForm] = useState({
    full_name: "",
    bio: "",
    job_title: "",
    company: "",
    industries: "",
    goals: "",
    what_i_offer: "",
    what_i_need: "",
    networking_style: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setForm({
            full_name: data.full_name || "",
            bio: data.bio || "",
            job_title: data.job_title || "",
            company: data.company || "",
            industries: (data.industries || []).join(", "),
            goals: (data.goals || []).join("\n"),
            what_i_offer: data.what_i_offer || "",
            what_i_need: data.what_i_need || "",
            networking_style: data.networking_style || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
    setLoading(false);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          industries: form.industries
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          goals: form.goals
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
    setSaving(false);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="text-zinc-500 mt-1">
          Your profile powers Claude&apos;s recommendations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>
            Claude uses this context to generate personalized networking advice,
            follow-up suggestions, and call prep documents. The more detail you
            provide, the better the recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Full Name
                </label>
                <Input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Current Role
                </label>
                <Input
                  value={form.job_title}
                  onChange={(e) =>
                    setForm({ ...form, job_title: e.target.value })
                  }
                  placeholder="e.g., VP of Engineering"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Company
                </label>
                <Input
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                  placeholder="Where you work"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Industries (comma-separated)
                </label>
                <Input
                  value={form.industries}
                  onChange={(e) =>
                    setForm({ ...form, industries: e.target.value })
                  }
                  placeholder="e.g., SaaS, FinTech, AI"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Bio
              </label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Brief description of who you are and what you do"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Goals (one per line)
              </label>
              <Textarea
                value={form.goals}
                onChange={(e) => setForm({ ...form, goals: e.target.value })}
                placeholder={"Raise Series A by Q3\nHire a CTO\nBuild advisor network in fintech"}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  What I Offer
                </label>
                <Textarea
                  value={form.what_i_offer}
                  onChange={(e) =>
                    setForm({ ...form, what_i_offer: e.target.value })
                  }
                  placeholder="What value do you bring to relationships? Technical expertise, intros to investors, industry knowledge..."
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  What I Need
                </label>
                <Textarea
                  value={form.what_i_need}
                  onChange={(e) =>
                    setForm({ ...form, what_i_need: e.target.value })
                  }
                  placeholder="What are you looking for? Introductions to enterprise buyers, technical co-founders, marketing expertise..."
                  rows={3}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Networking Style
              </label>
              <Textarea
                value={form.networking_style}
                onChange={(e) =>
                  setForm({ ...form, networking_style: e.target.value })
                }
                placeholder="How do you prefer to network? e.g., 'I prefer 1-on-1 coffee meetings over large events. I'm an introvert who connects best through shared interests.'"
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saved ? "Saved!" : saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
