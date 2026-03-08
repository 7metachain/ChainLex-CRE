"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Search, TrendingUp, Users, FileText, Shield, Eye, Activity, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

type DeploymentRecord = {
  id: string;
  assetName: string;
  chain: string;
  status: "deployed" | "draft" | "pending";
  createdAt: string;
};

type OracleAttestation = {
  id: string;
  walletAddress: string;
  chain: string;
  provider: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  isBlacklisted: boolean;
  reason: string;
  status: "succeeded" | "failed";
  createdAt: string;
};

type OverviewSummary = {
  totalDeployments: number;
  deployedCount: number;
  oracleChecks: number;
  highRiskCount: number;
};

type OverviewData = {
  summary: OverviewSummary;
  deployments: DeploymentRecord[];
  attestations: OracleAttestation[];
};

function levelBadgeVariant(level: string): "secondary" | "destructive" | "outline" | "default" {
  switch (level) {
    case "LOW":
      return "secondary";
    case "MEDIUM":
      return "outline";
    case "HIGH":
    case "BLOCKED":
      return "destructive";
    default:
      return "default";
  }
}

export function DashboardOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentRecord | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<"monthly" | "sar">("monthly");
  const [reportedItems, setReportedItems] = useState<Set<string>>(new Set());
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [activeChart, setActiveChart] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/overview");
      if (!res.ok) throw new Error("Failed to fetch overview");
      const json: OverviewData = await res.json();
      setData(json);
      if (!selectedDeployment && json.deployments.length > 0) {
        setSelectedDeployment(json.deployments[0]);
      }
    } catch {
      // API unavailable — fallback to empty
      setData({ summary: { totalDeployments: 0, deployedCount: 0, oracleChecks: 0, highRiskCount: 0 }, deployments: [], attestations: [] });
    } finally {
      setLoading(false);
    }
  }, [selectedDeployment]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleReport = (reportId: string) => {
    setReportedItems(prev => {
      const newSet = new Set(prev);
      newSet.add(reportId);
      return newSet;
    });
    setReportDialogOpen(false);
  };

  const handlePreview = async (type: "monthly" | "sar", name: string) => {
    try {
      const filePath = type === "monthly" ? "/markdowns/Monthly.md" : "/markdowns/SAR.md";
      const response = await fetch(filePath);
      if (response.ok) {
        const content = await response.text();
        setPreviewContent(content);
        setPreviewTitle(`${name} ${type === "monthly" ? "Monthly Report" : "SAR"} Preview`);
        setPreviewDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to load preview content:", error);
    }
  };

  const summary = data?.summary ?? { totalDeployments: 0, deployedCount: 0, oracleChecks: 0, highRiskCount: 0 };
  const deployments = data?.deployments ?? [];
  const attestations = data?.attestations ?? [];

  const filteredDeployments = deployments.filter(d =>
    d.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.chain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deploymentAttestations = selectedDeployment
    ? attestations.filter(a => a.chain === selectedDeployment.chain)
    : attestations;

  // --- SVG Charts ---

  const LineChart = () => {
    const raw = attestations.slice(0, 7).reverse();
    const chartData = raw.length > 0 ? raw.map(a => a.score) : [120, 250, 180, 400, 310, 220, 350];
    const labels = raw.length > 0
      ? raw.map(a => new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }))
      : ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
    const maxValue = Math.max(...chartData, 1);
    const chartWidth = 280;
    const chartHeight = 120;
    const chartPadding = { top: 20, right: 10, bottom: 20, left: 10 };
    const startX = chartPadding.left;
    const startY = chartPadding.top + chartHeight;

    const points = chartData.map((value, index) => {
      const x = startX + (index / Math.max(chartData.length - 1, 1)) * chartWidth;
      const y = startY - (value / maxValue) * chartHeight;
      return { x, y, value, label: labels[index] ?? "" };
    });

    const pointsString = points.map(p => `${p.x},${p.y}`).join(" ");
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    return (
      <div className="h-48 w-full relative">
        <svg width="100%" height="100%" viewBox="0 0 300 160" className="absolute inset-0">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.0)" />
            </linearGradient>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          {[0, 1, 2, 3, 4].map(i => (
            <line key={i} x1={chartPadding.left} y1={chartPadding.top + i * 30} x2={startX + chartWidth} y2={chartPadding.top + i * 30} stroke="#f3f4f6" strokeWidth="1" />
          ))}
          <polygon points={`${startX},${startY} ${pointsString} ${startX + chartWidth},${startY}`} fill="url(#areaGradient)" />
          <polyline points={pointsString} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <g key={index}>
              <circle cx={point.x} cy={point.y} r={hoveredPoint === index ? "6" : "3"} fill="#3b82f6" stroke="#fff" strokeWidth="2" className="cursor-pointer transition-all duration-200" onMouseEnter={() => { setActiveChart("line"); setHoveredPoint(index); }} onMouseLeave={() => { setHoveredPoint(null); if (activeChart === "line") setActiveChart(null); }} filter={hoveredPoint === index && activeChart === "line" ? "url(#glow)" : ""} />
              {hoveredPoint === index && activeChart === "line" && (
                <g>
                  <rect x={point.x - 40} y={point.y - 35} width="80" height="25" fill="#1f2937" rx="4" stroke="#374151" strokeWidth="1" />
                  <text x={point.x} y={point.y - 18} textAnchor="middle" fill="white" fontSize="11" fontWeight="500">Score {point.value}</text>
                  <text x={point.x} y={point.y - 5} textAnchor="middle" fill="#9ca3af" fontSize="9">{point.label}</text>
                </g>
              )}
            </g>
          ))}
        </svg>
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-3 text-xs text-muted-foreground">
          {labels.map((label, i) => (
            <span key={i} className={`transition-colors duration-200 ${hoveredPoint === i && activeChart === "line" ? "text-primary font-medium" : ""}`}>{label}</span>
          ))}
        </div>
      </div>
    );
  };

  const RiskDistributionChart = () => {
    const lowCount = attestations.filter(a => a.level === "LOW").length;
    const medCount = attestations.filter(a => a.level === "MEDIUM").length;
    const highCount = attestations.filter(a => a.level === "HIGH").length;
    const blockedCount = attestations.filter(a => a.level === "BLOCKED").length;
    const total = attestations.length || 1;

    const segments = [
      { name: "Low Risk", value: Math.round((lowCount / total) * 100) || (attestations.length === 0 ? 60 : 0), color: "#10b981" },
      { name: "Medium", value: Math.round((medCount / total) * 100) || (attestations.length === 0 ? 20 : 0), color: "#f59e0b" },
      { name: "High", value: Math.round((highCount / total) * 100) || (attestations.length === 0 ? 15 : 0), color: "#ef4444" },
      { name: "Blocked", value: Math.round((blockedCount / total) * 100) || (attestations.length === 0 ? 5 : 0), color: "#7c3aed" },
    ];
    const totalPercent = segments.reduce((s, x) => s + x.value, 0) || 1;

    const radius = 50;
    const innerRadius = 25;
    const centerX = 100;
    const centerY = 50;
    const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

    const paths = segments.map((item, index) => {
      const startAngle = segments.slice(0, index).reduce((sum, prev) => sum + (prev.value / totalPercent) * 360, -90);
      const angle = (item.value / totalPercent) * 360;
      const endAngle = startAngle + angle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);
      const x3 = centerX + innerRadius * Math.cos(startRad);
      const y3 = centerY + innerRadius * Math.sin(startRad);
      const x4 = centerX + innerRadius * Math.cos(endRad);
      const y4 = centerY + innerRadius * Math.sin(endRad);
      const largeArc = angle > 180 ? 1 : 0;
      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x3} ${y3} Z`;
      return { d, item, index };
    });

    return (
      <div className="h-48 w-full relative">
        <svg width="100%" height="70%" viewBox="0 0 200 120" className="absolute top-0 left-0">
          {paths.map(seg => (
            <path key={seg.index} d={seg.d} fill={seg.item.color} stroke="#fff" strokeWidth="2" className="cursor-pointer transition-all duration-200" style={{ opacity: hoveredSegment === null || hoveredSegment === seg.index ? 1 : 0.7, transform: hoveredSegment === seg.index ? "scale(1.05)" : "scale(1)", transformOrigin: `${centerX}px ${centerY}px` }} onMouseEnter={() => { setActiveChart("doughnut"); setHoveredSegment(seg.index); }} onMouseLeave={() => { setHoveredSegment(null); if (activeChart === "doughnut") setActiveChart(null); }} />
          ))}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-3 text-xs">
          {segments.map((item, index) => (
            <div key={index} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200 cursor-pointer ${hoveredSegment === index ? "bg-muted/80 shadow-sm" : "hover:bg-muted/40"}`} onMouseEnter={() => { setActiveChart("doughnut"); setHoveredSegment(index); }} onMouseLeave={() => { setHoveredSegment(null); if (activeChart === "doughnut") setActiveChart(null); }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="text-muted-foreground">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // --- Loading state ---
  if (loading) {
    return (
      <section className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Activity className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{summary.totalDeployments}</p>
                <p className="text-sm text-muted-foreground">Total Deployments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2"><CheckCircle2 className="h-5 w-5 text-green-500" /></div>
              <div>
                <p className="text-2xl font-bold">{summary.deployedCount}</p>
                <p className="text-sm text-muted-foreground">Deployed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2"><Shield className="h-5 w-5 text-blue-500" /></div>
              <div>
                <p className="text-2xl font-bold">{summary.oracleChecks}</p>
                <p className="text-sm text-muted-foreground">Oracle Checks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{summary.highRiskCount}</p>
                <p className="text-sm text-muted-foreground">High Risk Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.3fr_0.7fr]">
        {/* Left side - Deployment list */}
        <Card className="border-muted-foreground/20">
          <CardHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search deployments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredDeployments.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {deployments.length === 0 ? "No deployments yet. Deploy a contract to see it here." : "No results."}
                </p>
              )}
              {filteredDeployments.map((dep) => (
                <button
                  key={dep.id}
                  onClick={() => setSelectedDeployment(dep)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedDeployment?.id === dep.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{dep.assetName}</div>
                    <Badge variant={dep.status === "deployed" ? "secondary" : "outline"} className="text-xs">{dep.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{dep.chain}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(dep.createdAt).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right side - Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{selectedDeployment?.assetName ?? "Select a Deployment"}</CardTitle>
            <CardDescription className="font-mono text-sm">
              {selectedDeployment ? `${selectedDeployment.chain} · ${selectedDeployment.id.slice(0, 16)}...` : "Deploy a contract first"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-2xl font-bold">{summary.totalDeployments}</div>
                <div className="text-sm text-muted-foreground">Contracts</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-2xl font-bold">{summary.oracleChecks}</div>
                <div className="text-sm text-muted-foreground">Oracle Checks</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-2xl font-bold">{summary.deployedCount}</div>
                <div className="text-sm text-muted-foreground">Deployed</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-2xl font-bold">{summary.highRiskCount}</div>
                <div className="text-sm text-muted-foreground">Risk Alerts</div>
              </div>
            </div>

            {/* Reports section */}
            <div>
              <h3 className="mb-4 text-lg font-medium">Reports</h3>
              <div className="mb-4 border-b">
                <nav className="flex space-x-8">
                  <button onClick={() => setActiveReportTab("monthly")} className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeReportTab === "monthly" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    <FileText className="inline h-4 w-4 mr-2" />Monthly Report
                  </button>
                  <button onClick={() => setActiveReportTab("sar")} className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeReportTab === "sar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    <Shield className="inline h-4 w-4 mr-2" />Suspicious Activity Report
                  </button>
                </nav>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-background text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Project Name</th>
                        <th className="px-4 py-3 font-medium">Report Type</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-4 py-3 font-medium">{selectedDeployment?.assetName ?? "N/A"} {activeReportTab === "sar" ? "SAR" : "Report"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{activeReportTab === "monthly" ? "Monthly" : "SAR"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{new Date().toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handlePreview(activeReportTab, selectedDeployment?.assetName ?? "Contract")}>
                              <Eye className="h-4 w-4 mr-1" />Preview
                            </Button>
                            <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="default" size="sm" disabled={reportedItems.has(`${selectedDeployment?.id}-${activeReportTab}`)}>
                                  {reportedItems.has(`${selectedDeployment?.id}-${activeReportTab}`) ? "Reported" : "Report"}
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Report to Authority</DialogTitle>
                                  <DialogDescription>Choose where you want to submit this report</DialogDescription>
                                </DialogHeader>
                                <div className="flex gap-4 mt-4">
                                  <Button onClick={() => handleReport(`${selectedDeployment?.id}-${activeReportTab}`)} className="flex-1">Exchange</Button>
                                  <Button onClick={() => handleReport(`${selectedDeployment?.id}-${activeReportTab}`)} className="flex-1" variant="outline">Regulatory Agency</Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Oracle Attestations table */}
            <div>
              <h3 className="mb-4 text-lg font-medium">Oracle Risk Attestations</h3>
              <div className="overflow-hidden rounded-lg border">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-background text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Wallet Address</th>
                        <th className="px-4 py-3 font-medium">Chain</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Level</th>
                        <th className="px-4 py-3 font-medium">Reason</th>
                        <th className="px-4 py-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deploymentAttestations.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No oracle attestations yet. Use the Oracle Monitor above to assess wallets.</td></tr>
                      )}
                      {deploymentAttestations.map((att) => (
                        <tr key={att.id} className="border-t">
                          <td className="px-4 py-3 font-mono text-xs">{att.walletAddress.slice(0, 6)}...{att.walletAddress.slice(-4)}</td>
                          <td className="px-4 py-3 text-xs">{att.chain}</td>
                          <td className="px-4 py-3 font-medium">{att.score}</td>
                          <td className="px-4 py-3"><Badge variant={levelBadgeVariant(att.level)}>{att.level}</Badge></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{att.reason}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(att.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Charts section */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Risk Score Trend</CardTitle>
                  <CardDescription>Recent oracle assessments</CardDescription>
                </CardHeader>
                <CardContent><LineChart /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Risk Distribution</CardTitle>
                  <CardDescription>Across all attestations</CardDescription>
                </CardHeader>
                <CardContent><RiskDistributionChart /></CardContent>
              </Card>
            </div>

            {/* Preview Dialog */}
            <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{previewTitle}</DialogTitle>
                  <DialogDescription>Preview of the report content</DialogDescription>
                </DialogHeader>
                <div className="mt-4"><MarkdownRenderer content={previewContent} /></div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
