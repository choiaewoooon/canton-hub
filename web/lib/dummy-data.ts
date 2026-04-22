// Deterministic dummy data — ported from design_handoff_canton_hub/designs/v2/shared.js.
// Used where the backend endpoint doesn't yet supply a series, so the page matches the
// handoff mockup visually. Replace with real SWR hooks as backend endpoints are added.

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function genSeries(seed: number, n: number, base: number, vol: number, trend: number): number[] {
  const rng = mulberry32(seed);
  const arr: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (rng() - 0.5) * vol + trend;
    arr.push(Math.max(0.001, v));
  }
  return arr;
}

export const CH_DATA = {
  price: 0.0382,
  priceChangePct: 4.72,
  priceDir: "up" as const,
  high24: 0.0401,
  low24: 0.0359,
  vol24: 12_400_000,
  mcap: 286_000_000,

  bmRatio: 1.2847,
  bmStatus: "deflationary" as const,

  activeAddrs: 24318,
  activeDelta: 12.3,
  dailyBurnUsd: 184_200,
  burnDelta: 8.1,
  privateTxPct: 67.4,
  privateTxCount: 18204,

  totalSupply: "7.54B CC",
  superValidators: 42,
  validatorNodes: 218,
  transfers24: 1_082_443,
  cumBurned: "412.8M CC",
  burnRate: 5.2,
  dailyMint: 3_820_000,
  dailyBurn: 4_910_000,

  priceSeries: genSeries(7, 30, 0.034, 0.0018, 0.00016),
  priceSpark: genSeries(17, 24, 0.034, 0.0014, 0.00014),
  burnSeries: [
    122, 98, 145, 178, 132, 188, 210, 165, 198, 152, 220, 201, 176, 240, 212, 255, 198, 223, 270,
    248, 201, 268, 244, 292, 265, 310, 285, 320, 298, 332,
  ],
  bmSeries: genSeries(11, 30, 1.05, 0.06, 0.006),
  addrSeries: genSeries(3, 14, 20000, 900, 320),
  privateSeries: genSeries(5, 24, 58, 2.2, 0.4),
  privateSpark: genSeries(9, 24, 58, 2.0, 0.4),
  burnSpark: [
    140, 155, 162, 148, 172, 180, 195, 210, 198, 212, 232, 220, 245, 260, 276, 265, 288, 301, 295,
    320,
  ],
};

export type CHData = typeof CH_DATA;
