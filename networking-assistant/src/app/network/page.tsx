"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { Contact, RelationshipEdge } from "@/lib/types";

const tierColors: Record<string, string> = {
  inner_circle: "#a855f7",
  strong: "#3b82f6",
  moderate: "#22c55e",
  acquaintance: "#a1a1aa",
  dormant: "#d4d4d8",
};

const tierRadius: Record<string, number> = {
  inner_circle: 16,
  strong: 13,
  moderate: 10,
  acquaintance: 8,
  dormant: 6,
};

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  tier: string;
  company: string | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  type: string;
  strength: number;
}

export default function NetworkMapPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [contactsRes, edgesRes] = await Promise.all([
        fetch("/api/contacts"),
        fetch("/api/relationships"),
      ]);
      if (contactsRes.ok) setContacts(await contactsRes.json());
      if (edgesRes.ok) setEdges(await edgesRes.json());
    } catch (err) {
      console.error("Failed to load network data:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!svgRef.current || contacts.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const nodes: GraphNode[] = contacts.map((c) => ({
      id: c.id,
      name: c.full_name,
      tier: c.relationship_tier,
      company: c.company,
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = edges
      .filter((e) => nodeIds.has(e.contact_a_id) && nodeIds.has(e.contact_b_id))
      .map((e) => ({
        source: e.contact_a_id,
        target: e.contact_b_id,
        type: e.relationship_type,
        strength: e.strength,
      }));

    // If no explicit edges, create implicit ones based on shared industries/tags
    if (links.length === 0 && contacts.length > 1) {
      for (let i = 0; i < contacts.length; i++) {
        for (let j = i + 1; j < contacts.length; j++) {
          const shared =
            contacts[i].industries.filter((ind) =>
              contacts[j].industries.includes(ind)
            ).length +
            contacts[i].tags.filter((t) => contacts[j].tags.includes(t)).length;
          if (shared > 0 || contacts[i].company === contacts[j].company) {
            links.push({
              source: contacts[i].id,
              target: contacts[j].id,
              type: "shared_context",
              strength: Math.min(shared + 1, 5),
            });
          }
        }
      }
    }

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => 120 - d.strength * 8)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(25));

    // Links
    const link = g
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#d4d4d8")
      .attr("stroke-width", (d) => Math.max(1, d.strength / 3))
      .attr("stroke-opacity", 0.4);

    // Node groups
    const node = g
      .selectAll<SVGGElement, GraphNode>("g.node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", (d) => tierRadius[d.tier] || 8)
      .attr("fill", (d) => tierColors[d.tier] || "#a1a1aa")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d) => d.name.split(" ")[0])
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (tierRadius[d.tier] || 8) + 14)
      .attr("font-size", "11px")
      .attr("fill", "#71717a");

    node.on("click", (_event, d) => {
      const contact = contacts.find((c) => c.id === d.id);
      setSelectedNode(contact || null);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [contacts, edges]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Network Map
        </h1>
        <p className="text-zinc-500 mt-1">
          Visual graph of your contacts and their connections
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-[600px]">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex items-center justify-center h-[600px] text-zinc-500">
                  <p>Add contacts to see your network map</p>
                </div>
              ) : (
                <svg
                  ref={svgRef}
                  className="w-full bg-zinc-50 dark:bg-zinc-900"
                  style={{ height: "600px" }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(tierColors).map(([tier, color]) => (
                <div key={tier} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm capitalize">
                    {tier.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Selected node detail */}
          {selectedNode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedNode.full_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {selectedNode.role && <p>{selectedNode.role}</p>}
                {selectedNode.company && (
                  <p className="text-zinc-500">{selectedNode.company}</p>
                )}
                <Badge variant="secondary">
                  {selectedNode.relationship_tier.replace(/_/g, " ")}
                </Badge>
                {selectedNode.context_summary && (
                  <p className="text-xs text-zinc-500 mt-2 border-t pt-2">
                    {selectedNode.context_summary}
                  </p>
                )}
                <Link href={`/contacts/${selectedNode.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    View Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Network Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Total contacts</span>
                <span className="font-medium">{contacts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Connections</span>
                <span className="font-medium">{edges.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Industries</span>
                <span className="font-medium">
                  {new Set(contacts.flatMap((c) => c.industries)).size}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
