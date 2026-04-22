interface Props {
  source: string;
  sourceColor: string;
  sourceBg?: string;
  category: string;
  categoryColor: string;
  time: string;
  title: string;
  aiSummary: string;
  url?: string;
}

export default function FeedArticle({
  source,
  sourceColor,
  sourceBg,
  category,
  categoryColor,
  time,
  title,
  aiSummary,
  url,
}: Props) {
  return (
    <article className="ch-feed-article">
      <div className="ch-fa-meta">
        <span
          className="ch-src-badge"
          style={{
            background: sourceBg ?? `color-mix(in oklab, ${sourceColor} 15%, transparent)`,
            color: sourceColor,
          }}
        >
          {source}
        </span>
        <span
          className="ch-chip ch-chip-xs"
          style={{
            color: categoryColor,
            background: `color-mix(in oklab, ${categoryColor} 14%, transparent)`,
          }}
        >
          {category}
        </span>
        <span className="time">{time}</span>
      </div>
      <a
        className="ch-fa-title"
        href={url || "#"}
        target={url ? "_blank" : undefined}
        rel="noopener noreferrer"
      >
        {title}
      </a>
      <div className="ch-fa-ai-summary">
        <span className="tag">AI</span>
        <span>{aiSummary}</span>
      </div>
    </article>
  );
}
