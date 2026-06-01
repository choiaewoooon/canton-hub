"use client";

import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
} from "recharts";
import type { DatPricePoint } from "@/lib/types";

const EMPTY: Record<string, string> = {
    ko: "주가 데이터 없음",
    en: "No price data",
    ja: "株価データなし",
    zh: "无株价データ",
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
    stockColor: stockColorProp,
}: {
    data: DatPricePoint[];
    lang?: string;
    inception?: string;
    stockColor?: string;
}) {
    if (!data || data.length < 2) {
        return (
            <div className="ch-skel" style={{ height: 200 }}>
                {EMPTY[lang] ?? EMPTY.en}
            </div>
        );
    }
    const up = data[data.length - 1].close >= data[0].close;
    const stockColor = stockColorProp ?? (up ? "var(--canton-up)" : "var(--canton-down)");
    const series = data.map((p) => ({ t: p.ts, close: p.close, cc: p.cc }));

    // DAT 전환일에 해당하는 실제 데이터 포인트(처음으로 inception 이상인 날짜)
    const incTs = inception
        ? data.find((p) => p.ts >= inception)?.ts ?? null
        : null;

    return (
        <div className="ch-chart" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                {/* top margin 22: DAT 라벨이 데이터선 위 여백에 앉도록 */}
                <ComposedChart data={series} margin={{ top: 22, right: 6, bottom: 0, left: -10 }}>
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
                        width={50}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => `$${Number(v).toFixed(3)}`}
                    />
                    {incTs && (
                        <ReferenceLine
                            yAxisId="stock"
                            x={incTs}
                            stroke="var(--canton-private)"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            label={{
                                value: `◆ ${t(L.dat, lang)}`,
                                fontSize: 9.5,
                                fontWeight: 600,
                                fill: "var(--canton-private)",
                                position: "top",
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
                        labelFormatter={(l) => String(l)}
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
                    <Line
                        yAxisId="stock"
                        type="monotone"
                        dataKey="close"
                        name="close"
                        stroke={stockColor}
                        strokeWidth={2}
                        dot={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
