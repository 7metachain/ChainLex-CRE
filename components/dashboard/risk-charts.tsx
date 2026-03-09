"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Users } from "lucide-react";
import type { OracleAttestation } from "@/lib/oracle-attestations";

const HIGH_THRESHOLD = 600;

type RiskChartsProps = {
  attestations: OracleAttestation[];
};

function RiskScoreTrend({ attestations }: RiskChartsProps) {
  const raw = attestations.slice(0, 10).reverse();
  const chartData = raw.length > 0 ? raw.map((a) => a.score) : [];
  const labels = raw.length > 0
    ? raw.map((a) =>
        new Date(a.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      )
    : [];

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />Risk Score Trend
          </CardTitle>
          <CardDescription>Recent oracle assessments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            No data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...chartData, HIGH_THRESHOLD + 100);
  const chartWidth = 280;
  const chartHeight = 120;
  const pad = { top: 20, right: 10, bottom: 20, left: 10 };
  const startX = pad.left;
  const startY = pad.top + chartHeight;

  const points = chartData.map((value, index) => {
    const x = startX + (index / Math.max(chartData.length - 1, 1)) * chartWidth;
    const y = startY - (value / maxValue) * chartHeight;
    return { x, y, value, label: labels[index] ?? "" };
  });

  const pointsString = points.map((p) => `${p.x},${p.y}`).join(" ");
  const thresholdY = startY - (HIGH_THRESHOLD / maxValue) * chartHeight;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />Risk Score Trend
        </CardTitle>
        <CardDescription>Recent oracle assessments (threshold: {HIGH_THRESHOLD})</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full relative">
          <svg width="100%" height="100%" viewBox="0 0 300 160" className="absolute inset-0">
            <defs>
              <linearGradient id="oracleAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0.0)" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={pad.left} y1={pad.top + i * 30} x2={startX + chartWidth} y2={pad.top + i * 30} stroke="#f3f4f6" strokeWidth="1" />
            ))}
            {/* Threshold line */}
            <line
              x1={pad.left}
              y1={thresholdY}
              x2={startX + chartWidth}
              y2={thresholdY}
              stroke="#ef4444"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <text x={startX + chartWidth - 2} y={thresholdY - 4} textAnchor="end" fill="#ef4444" fontSize="8" opacity="0.8">
              HIGH
            </text>
            {/* Area fill */}
            <polygon
              points={`${startX},${startY} ${pointsString} ${startX + chartWidth},${startY}`}
              fill="url(#oracleAreaGrad)"
            />
            {/* Line */}
            <polyline points={pointsString} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Points */}
            {points.map((point, index) => (
              <g key={index}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredPoint === index ? 6 : 3}
                  fill={point.value >= HIGH_THRESHOLD ? "#ef4444" : "#3b82f6"}
                  stroke="#fff"
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredPoint(index)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {hoveredPoint === index && (
                  <g>
                    <rect x={point.x - 35} y={point.y - 30} width="70" height="22" fill="#1f2937" rx="4" />
                    <text x={point.x} y={point.y - 15} textAnchor="middle" fill="white" fontSize="10" fontWeight="500">
                      Score {point.value}
                    </text>
                  </g>
                )}
              </g>
            ))}
          </svg>
          <div className="absolute bottom-1 left-0 right-0 flex justify-between px-3 text-[9px] text-muted-foreground">
            {labels.map((label, i) => (
              <span key={i} className={hoveredPoint === i ? "text-primary font-medium" : ""}>{label}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskDistribution({ attestations }: RiskChartsProps) {
  const lowCount = attestations.filter((a) => a.level === "LOW").length;
  const medCount = attestations.filter((a) => a.level === "MEDIUM").length;
  const highCount = attestations.filter((a) => a.level === "HIGH").length;
  const blockedCount = attestations.filter((a) => a.level === "BLOCKED").length;
  const total = attestations.length;

  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />Risk Distribution
          </CardTitle>
          <CardDescription>Across all attestations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            No data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const segments = [
    { name: "Low", count: lowCount, pct: Math.round((lowCount / total) * 100), color: "#10b981" },
    { name: "Medium", count: medCount, pct: Math.round((medCount / total) * 100), color: "#f59e0b" },
    { name: "High", count: highCount, pct: Math.round((highCount / total) * 100), color: "#ef4444" },
    { name: "Blocked", count: blockedCount, pct: Math.round((blockedCount / total) * 100), color: "#7c3aed" },
  ];
  const totalPercent = segments.reduce((s, x) => s + x.pct, 0) || 1;

  const radius = 50;
  const innerRadius = 25;
  const cx = 100;
  const cy = 50;

  const paths = segments.map((item, index) => {
    const startAngle = segments.slice(0, index).reduce((sum, prev) => sum + (prev.pct / totalPercent) * 360, -90);
    const angle = (item.pct / totalPercent) * 360;
    if (angle === 0) return null;
    const endAngle = startAngle + angle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const x3 = cx + innerRadius * Math.cos(startRad);
    const y3 = cy + innerRadius * Math.sin(startRad);
    const x4 = cx + innerRadius * Math.cos(endRad);
    const y4 = cy + innerRadius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x3} ${y3} Z`;
    return { d, item, index };
  }).filter(Boolean) as { d: string; item: typeof segments[number]; index: number }[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />Risk Distribution
        </CardTitle>
        <CardDescription>Across {total} attestations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full relative">
          <svg width="100%" height="70%" viewBox="0 0 200 120" className="absolute top-0 left-0">
            {paths.map((seg) => (
              <path
                key={seg.index}
                d={seg.d}
                fill={seg.item.color}
                stroke="#fff"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200"
                style={{
                  opacity: hoveredSegment === null || hoveredSegment === seg.index ? 1 : 0.6,
                  transform: hoveredSegment === seg.index ? "scale(1.05)" : "scale(1)",
                  transformOrigin: `${cx}px ${cy}px`,
                }}
                onMouseEnter={() => setHoveredSegment(seg.index)}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            ))}
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-3 text-xs">
            {segments.map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200 cursor-pointer ${
                  hoveredSegment === index ? "bg-muted/80 shadow-sm" : "hover:bg-muted/40"
                }`}
                onMouseEnter={() => setHoveredSegment(index)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium">{item.count}</span>
                <span className="text-muted-foreground">({item.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { RiskScoreTrend, RiskDistribution };
