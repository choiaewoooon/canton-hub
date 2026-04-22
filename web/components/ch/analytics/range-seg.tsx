"use client";

const RANGES = ["24H", "7D", "30D", "90D", "1Y"] as const;
export type Range = (typeof RANGES)[number];

interface Props {
  value: Range;
  onChange: (r: Range) => void;
}

export default function RangeSeg({ value, onChange }: Props) {
  return (
    <div className="ch-seg" role="radiogroup" aria-label="Analytics 기간">
      {RANGES.map((r) => (
        <button
          key={r}
          role="radio"
          aria-checked={value === r}
          className={value === r ? "active" : ""}
          onClick={() => onChange(r)}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
