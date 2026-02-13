"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  UserPlus,
  Search,
  X,
  Building2,
  MapPin,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import type { Contact } from "@/lib/types";

const tierColors: Record<string, string> = {
  inner_circle: "bg-purple-500",
  strong: "bg-blue-500",
  moderate: "bg-green-500",
  acquaintance: "bg-zinc-400",
  dormant: "bg-zinc-300",
};

const tierLabels: Record<string, string> = {
  inner_circle: "Inner Circle",
  strong: "Strong",
  moderate: "Moderate",
  acquaintance: "Acquaintance",
  dormant: "Dormant",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // New contact form
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    company: "",
    role: "",
    location: "",
    how_we_met: "",
    relationship_tier: "acquaintance",
    industries: "",
    tags: "",
  });

  useEffect(() => {
    loadContacts();
    if (new URLSearchParams(window.location.search).get("new") === "true") {
      setShowForm(true);
    }
  }, []);

  async function loadContacts() {
    setLoading(true);
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) setContacts(await res.json());
    } catch (err) {
      console.error("Failed to load contacts:", err);
    }
    setLoading(false);
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          industries: form.industries
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          tags: form.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({
          full_name: "",
          email: "",
          company: "",
          role: "",
          location: "",
          how_we_met: "",
          relationship_tier: "acquaintance",
          industries: "",
          tags: "",
        });
        await loadContacts();
      }
    } catch (err) {
      console.error("Failed to create contact:", err);
    }
  }

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      !search ||
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase()) ||
      c.role?.toLowerCase().includes(search.toLowerCase());
    const matchesTier = !tierFilter || c.relationship_tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Contacts
          </h1>
          <p className="text-zinc-500 mt-1">
            {contacts.length} people in your network
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Contact"}
        </Button>
      </div>

      {/* Add Contact Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createContact} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                placeholder="Full Name *"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
              <Input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
              <Input
                placeholder="Role / Title"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
              <Input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <Select
                value={form.relationship_tier}
                onChange={(e) =>
                  setForm({ ...form, relationship_tier: e.target.value })
                }
              >
                <option value="acquaintance">Acquaintance</option>
                <option value="moderate">Moderate</option>
                <option value="strong">Strong</option>
                <option value="inner_circle">Inner Circle</option>
              </Select>
              <Input
                placeholder="Industries (comma-separated)"
                value={form.industries}
                onChange={(e) => setForm({ ...form, industries: e.target.value })}
              />
              <Input
                placeholder="Tags (comma-separated)"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
              <Textarea
                placeholder="How did you meet?"
                className="sm:col-span-2"
                value={form.how_we_met}
                onChange={(e) => setForm({ ...form, how_we_met: e.target.value })}
              />
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit">Create Contact</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search contacts..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="w-44"
        >
          <option value="">All Tiers</option>
          <option value="inner_circle">Inner Circle</option>
          <option value="strong">Strong</option>
          <option value="moderate">Moderate</option>
          <option value="acquaintance">Acquaintance</option>
          <option value="dormant">Dormant</option>
        </Select>
      </div>

      {/* Contact Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((contact) => (
          <Link key={contact.id} href={`/contacts/${contact.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {contact.full_name}
                    </h3>
                    {contact.role && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {contact.role}
                      </p>
                    )}
                  </div>
                  <div
                    className={`h-3 w-3 rounded-full ${tierColors[contact.relationship_tier]}`}
                    title={tierLabels[contact.relationship_tier]}
                  />
                </div>

                {contact.company && (
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500 mb-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {contact.company}
                  </div>
                )}
                {contact.location && (
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500 mb-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {contact.location}
                  </div>
                )}
                {contact.last_interaction_at && (
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500 mb-3">
                    <Calendar className="h-3.5 w-3.5" />
                    Last: {new Date(contact.last_interaction_at).toLocaleDateString()}
                  </div>
                )}

                {contact.context_summary && (
                  <p className="text-xs text-zinc-500 line-clamp-2 mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    {contact.context_summary}
                  </p>
                )}

                {contact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {contact.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg">No contacts found</p>
          <p className="text-sm mt-1">
            {contacts.length === 0
              ? "Add your first contact to get started"
              : "Try adjusting your search or filters"}
          </p>
        </div>
      )}
    </div>
  );
}
