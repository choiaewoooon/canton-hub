import { sparklineSVG, type SparklineOpts } from "./chart-svg";

interface Props extends SparklineOpts {
  data: number[];
  color: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Sparkline({ data, color, className = "", style, ...opts }: Props) {
  if (!data || data.length === 0) return <div className={className} style={style} />;
  const html = sparklineSVG(data, color, opts);
  return (
    <div
      className={`ch-chart ${className}`}
      style={{ height: opts.height ?? 32, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
