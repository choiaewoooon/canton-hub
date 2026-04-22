// Ported from design_handoff_canton_hub/designs/v2/shared.js
// Returns SVG markup strings that are injected via dangerouslySetInnerHTML in React components.

export interface SparklineOpts {
  height?: number;
  fill?: boolean;
  refLine?: number | null;
}

export function sparklineSVG(data: number[], color: string, opts: SparklineOpts = {}): string {
  const { height = 32, fill = true, refLine = null } = opts;
  const W = 100;
  const H = height;
  const padT = 2;
  const padB = 2;
  const innerH = H - padT - padB;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const n = data.length;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  let path = `M ${x(0)} ${y(data[0])}`;
  for (let i = 1; i < n; i++) path += ` L ${x(i)} ${y(data[i])}`;
  const area = path + ` L ${W} ${H - padB} L 0 ${H - padB} Z`;
  const gid = "sg-" + Math.random().toString(36).slice(2, 8);

  const refStr =
    refLine !== null
      ? `<line x1="0" y1="${y(refLine)}" x2="${W}" y2="${y(refLine)}" stroke="${color}" stroke-dasharray="2 2" stroke-opacity="0.35"/>`
      : "";

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${refStr}
    ${fill ? `<path d="${area}" fill="url(#${gid})"/>` : ""}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

export interface AreaChartOpts {
  height?: number;
  showAxes?: boolean;
  refLine?: number | null;
  barMode?: boolean;
}

export function areaChartSVG(data: number[], color: string, opts: AreaChartOpts = {}): string {
  const { height = 200, showAxes = true, refLine = null, barMode = false } = opts;
  const W = 800;
  const H = height;
  const padL = showAxes ? 36 : 8;
  const padR = 12;
  const padT = 10;
  const padB = showAxes ? 22 : 8;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const min = Math.min(...data, refLine !== null ? refLine * 0.96 : Infinity);
  const max = Math.max(...data, refLine !== null ? refLine * 1.04 : -Infinity);
  const range = max - min || 1;
  const x = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const gridY = showAxes ? [0, 0.5, 1].map((f) => padT + f * innerH) : [];
  const yTicks = showAxes
    ? [0, 0.5, 1].map((f) => {
        const val = min + (1 - f) * range;
        return { y: padT + f * innerH, label: val < 1 ? val.toFixed(4) : val.toFixed(2) };
      })
    : [];

  if (barMode) {
    const gap = 3;
    const barW = (innerW - gap * (data.length - 1)) / data.length;
    const bars = data
      .map((v, i) => {
        const h = ((v - min) / range) * innerH;
        const xp = padL + i * (barW + gap);
        const yp = padT + innerH - h;
        return `<rect x="${xp}" y="${yp}" width="${barW}" height="${h}" rx="2" fill="${color}" fill-opacity="0.7"/>`;
      })
      .join("");
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      ${gridY.map((gy) => `<line x1="${padL}" y1="${gy}" x2="${padL + innerW}" y2="${gy}" stroke="var(--canton-border)" stroke-dasharray="3 3"/>`).join("")}
      ${bars}
      ${yTicks.map((t) => `<text x="${padL - 6}" y="${t.y + 3}" text-anchor="end" font-size="10" fill="var(--zinc-500)">${t.label}</text>`).join("")}
    </svg>`;
  }

  let path = `M ${x(0)} ${y(data[0])}`;
  for (let i = 1; i < data.length; i++) path += ` L ${x(i)} ${y(data[i])}`;
  const area = path + ` L ${x(data.length - 1)} ${padT + innerH} L ${x(0)} ${padT + innerH} Z`;

  const refStr =
    refLine !== null
      ? `<line x1="${padL}" y1="${y(refLine)}" x2="${padL + innerW}" y2="${y(refLine)}" stroke="${color}" stroke-dasharray="4 4" stroke-opacity="0.4"/>
         <text x="${padL + innerW + 2}" y="${y(refLine) + 3}" font-size="9" fill="${color}" opacity="0.6">${refLine}</text>`
      : "";

  const gid = "ag-" + Math.random().toString(36).slice(2, 8);

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${gridY.map((gy) => `<line x1="${padL}" y1="${gy}" x2="${padL + innerW}" y2="${gy}" stroke="var(--canton-border)" stroke-dasharray="3 3"/>`).join("")}
    ${refStr}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    ${yTicks.map((t) => `<text x="${padL - 6}" y="${t.y + 3}" text-anchor="end" font-size="10" fill="var(--zinc-500)">${t.label}</text>`).join("")}
  </svg>`;
}
