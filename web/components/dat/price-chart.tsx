"use client";

import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts";
import type { DatPricePoint } from "@/lib/types";

const EMPTY: Record<string, string> = {
    ko: "주가 데이터 없음",
    en: "No price data",
    ja: "株価データなし",
    zh: "无股价数据",
};

export default function PriceChart({
    data,
    lang = "en",
}: {
    data: DatPricePoint[];
    lang?: string;
}) {
    if (!data || data.length < 2) {
        return (
            <div className="ch-skel" style={{ height: 200 }}>
                {EMPTY[lang] ?? EMPTY.en}
            </div>
        );
    }
    // 종가 등락 색: 마지막 ≥ 처음이면 up(초록), 아니면 down(빨강)
    const up = data[data.length - 1].close >= data[0].close;
    const stroke = up ? "var(--canton-up)" : "var(--canton-down)";
    const series = data.map((p) => ({ t: p.ts.slice(5), close: p.close }));
    return (
        <div className="ch-chart" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--canton-border)" }}
                        minTickGap={40}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `$${Number(v).toFixed(1)}`}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--canton-card)",
                            border: "1px solid var(--canton-border)",
                            borderRadius: 6,
                            fontSize: 12,
                        }}
                        formatter={(v) => [`$${Number(v).toFixed(2)}`, "Close"]}
                    />
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke={stroke}
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
