"use client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export default function Heatmap() {
  const rng = seededRng(42);
  const rows = DAYS.map((day, di) => {
    const cells: number[] = [];
    for (let h = 0; h < 24; h++) {
      let base = rng();
      if (h >= 13 && h <= 21) base = base * 0.4 + 0.6;
      if (di >= 5) base = base * 0.5;
      cells.push(Math.max(0.05, Math.min(0.95, base)));
    }
    return { day, cells };
  });

  return (
    <div>
      <div>
        {rows.map(({ day, cells }) => (
          <div key={day} className="ch-heat-row">
            <div className="ch-heat-row-label">{day}</div>
            {cells.map((op, h) => (
              <div
                key={h}
                className="ch-heat-cell"
                style={{ opacity: op.toFixed(2) }}
                title={`${day} ${h}:00`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="ch-heat-axis">
        <span />
        {Array.from({ length: 24 }).map((_, h) => (
          <span key={h}>{h % 6 === 0 ? h : ""}</span>
        ))}
      </div>
    </div>
  );
}
