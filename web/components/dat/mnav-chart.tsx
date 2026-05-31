"use client";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    ReferenceLine,
    Tooltip,
} from "recharts";

interface Point {
    ts: string;
    mnav: number;
}

export default function MnavChart({ data }: { data: Point[] }) {
    if (!data || data.length < 2) {
        return (
            <div className="ch-skel" style={{ height: 160 }}>
                데이터 축적 중
            </div>
        );
    }
    const series = data.map((p) => ({
        t: p.ts.slice(5, 10), // MM-DD
        mnav: p.mnav,
    }));
    return (
        <div className="ch-chart" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--canton-border)" }}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        domain={["auto", "auto"]}
                    />
                    <ReferenceLine
                        y={1.0}
                        stroke="var(--canton-down)"
                        strokeDasharray="4 4"
                        label={{ value: "1.0x", fontSize: 10, fill: "var(--canton-down)", position: "right" }}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--canton-card)",
                            border: "1px solid var(--canton-border)",
                            borderRadius: 6,
                            fontSize: 12,
                        }}
                        formatter={(v) => [`${Number(v).toFixed(2)}x`, "mNAV"]}
                    />
                    <Line
                        type="monotone"
                        dataKey="mnav"
                        stroke="var(--canton-lime)"
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
