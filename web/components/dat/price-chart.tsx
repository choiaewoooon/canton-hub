"use client";

import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
    Legend,
} from "recharts";
import type { DatPricePoint } from "@/lib/types";

const EMPTY: Record<string, string> = {
    ko: "주가 데이터 없음",
    en: "No price data",
    ja: "株価データなし",
    zh: "无股价数据",
};

const L = {
    stock: { ko: "주가", en: "Stock", ja: "株価", zh: "股价" },
    cc: { ko: "$CC", en: "$CC", ja: "$CC", zh: "$CC" },
    dat: { ko: "DAT 전환", en: "DAT pivot", ja: "DAT転換", zh: "DAT转型" },
};
const t = (m: Record<string, string>, lang: string) => m[lang] ?? m.en;

export default function PriceChart({
    data,
    lang = "en",
    inception,
}: {
    data: DatPricePoint[];
    lang?: string;
    inception?: string;
}) {
    if (!data || data.length < 2) {
        return (
            <div className="ch-skel" style={{ height: 200 }}>
                {EMPTY[lang] ?? EMPTY.en}
            </div>
        );
    }
    const up = data[data.length - 1].close >= data[0].close;
    const stockColor = up ? "var(--canton-up)" : "var(--canton-down)";
    const series = data.map((p) => ({ t: p.ts, close: p.close, cc: p.cc }));
    // DAT 전환일 마커: price_history의 ts와 정확히 일치하는 가장 가까운 날짜 사용
    const incLabel = inception && data.some((p) => p.ts >= inception) ? inception : null;

    return (
        <div className="ch-chart" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
                    <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--canton-border)" }}
                        minTickGap={44}
                        tickFormatter={(v) => String(v).slice(5)}
                    />
                    {/* 좌축: 주가 */}
                    <YAxis
                        yAxisId="stock"
                        tick={{ fontSize: 10, fill: "var(--zinc-500)" }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `$${Number(v).toFixed(1)}`}
                    />
                    {/* 우축: $CC */}
                    <YAxis
                        yAxisId="cc"
                        orientation="right"
                        tick={{ fontSize: 10, fill: "var(--canton-lime)" }}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `$${Number(v).toFixed(3)}`}
                    />
                    {incLabel && (
                        <ReferenceLine
                            yAxisId="stock"
                            x={incLabel}
                            stroke="var(--canton-private)"
                            strokeDasharray="3 3"
                            label={{
                                value: t(L.dat, lang),
                                fontSize: 9,
                                fill: "var(--canton-private)",
                                position: "insideTopLeft",
                            }}
                        />
                    )}
                    <Tooltip
                        contentStyle={{
                            background: "var(--canton-card)",
                            border: "1px solid var(--canton-border)",
                            borderRadius: 6,
                            fontSize: 12,
                        }}
                        formatter={(v, name) =>
                            name === "cc"
                                ? [`$${Number(v).toFixed(4)}`, t(L.cc, lang)]
                                : [`$${Number(v).toFixed(2)}`, t(L.stock, lang)]
                        }
                    />
                    <Legend
                        verticalAlign="top"
                        height={20}
                        iconType="plainline"
                        wrapperStyle={{ fontSize: 10 }}
                        formatter={(value) => (value === "cc" ? t(L.cc, lang) : t(L.stock, lang))}
                    />
                    <Line
                        yAxisId="stock"
                        type="monotone"
                        dataKey="close"
                        name="close"
                        stroke={stockColor}
                        strokeWidth={2}
                        dot={false}
                    />
                    <Line
                        yAxisId="cc"
                        type="monotone"
                        dataKey="cc"
                        name="cc"
                        stroke="var(--canton-lime)"
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                        connectNulls
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
