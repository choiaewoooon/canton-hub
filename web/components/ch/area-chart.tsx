import { areaChartSVG, type AreaChartOpts } from "./chart-svg";

interface Props extends AreaChartOpts {
  data: number[];
  color: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function AreaChart({ data, color, className = "", style, ...opts }: Props) {
  if (!data || data.length === 0) return <div className={className} style={style} />;
  const html = areaChartSVG(data, color, opts);
  return (
    <div
      className={`ch-chart ${className}`}
      style={{ height: opts.height ?? 200, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
