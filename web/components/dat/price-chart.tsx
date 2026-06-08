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
    avg: { ko: "평단", en: "Avg", ja: "平均", zh: "均价" },
};
const t = (m: Record<string, string>, lang: string) => m[lang] ?? m.en;

export default function PriceChart({
    data,
    lang = "en",
    inception,
    inceptionTip,
    avgBuy,
    stockColor: stockColorProp,
}: {
    data: DatPricePoint[];
    lang?: string;
    inception?: string;
    inceptionTip?: string; // 마커 위 작은 요약 (예: "3.68B CC @ $0.147")
    avgBuy?: number | null; // $CC 평단 → 우축 수평 기준선
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

    // DAT 전환일 마커: 전환일이 보이는 구간 안일 때만 표시.
    // (1M/3M로 줄이면 전환일이 구간 시작보다 과거 → 마커를 시작점에 잘못 찍지 않게 숨김)
    const incTs =
        inception && inception >= data[0].ts
            ? data.find((p) => p.ts >= inception)?.ts ?? null
            : null;

    return (
        <div className="ch-chart" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
                {/* top margin 30: DAT 배지 2줄(라벨+요약)이 데이터선 위에 앉도록 */}
                <ComposedChart data={series} margin={{ top: 30, right: 6, bottom: 0, left: -10 }}>
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
                    {/* $CC 평단 수평 기준선 (우축) — 현재가가 평단 위/아래인지 */}
                    {avgBuy != null && avgBuy > 0 && (
                        <ReferenceLine
                            yAxisId="cc"
                            y={avgBuy}
                            stroke="var(--canton-lime)"
                            strokeDasharray="2 3"
                            strokeOpacity={0.6}
                            label={{
                                value: `${t(L.avg, lang)} $${avgBuy.toFixed(3)}`,
                                fontSize: 9,
                                fill: "var(--canton-lime)",
                                position: "insideBottomRight",
                            }}
                        />
                    )}
                    {/* DAT 전환 마커 — 세로선 + 2줄 배지(라벨 + 요약) */}
                    {incTs && (
                        <ReferenceLine
                            yAxisId="stock"
                            x={incTs}
                            stroke="var(--canton-private)"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            label={(props) => {
                                const vb = props.viewBox as { x: number; y: number };
                                return (
                                    <g>
                                        <text
                                            x={vb.x}
                                            y={vb.y - 18}
                                            textAnchor="middle"
                                            fontSize={9.5}
                                            fontWeight={600}
                                            fill="var(--canton-private)"
                                        >
                                            ◆ {t(L.dat, lang)}
                                        </text>
                                        {inceptionTip && (
                                            <text
                                                x={vb.x}
                                                y={vb.y - 6}
                                                textAnchor="middle"
                                                fontSize={8.5}
                                                fill="var(--zinc-400)"
                                            >
                                                {inceptionTip}
                                            </text>
                                        )}
                                    </g>
                                );
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
