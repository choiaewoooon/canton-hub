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

import type { DatMnavPoint } from "@/lib/types";

const ACCRUING: Record<string, string> = {
    ko: "데이터 축적 중",
    en: "Accruing data…",
    ja: "データ蓄積中",
    zh: "数据累积中",
};

export default function MnavChart({
    data,
    lang = "en",
}: {
    data: DatMnavPoint[];
    lang?: string;
}) {
    if (!data || data.length < 2) {
        return (
            <div className="ch-skel" style={{ height: 200 }}>
                {ACCRUING[lang] ?? ACCRUING.en}
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
                        width={44}
                        domain={[0, (max: number) => Math.max(1.1, Math.ceil(max * 10) / 10)]}
                        tickFormatter={(v) => `${Number(v).toFixed(2)}x`}
                    />
                    <ReferenceLine
                        y={1.0}
                        stroke="var(--canton-down)"
                        strokeDasharray="4 4"
                        label={{ value: "1.0x NAV", fontSize: 10, fill: "var(--canton-down)", position: "insideTopRight" }}
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
