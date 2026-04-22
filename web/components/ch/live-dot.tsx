export default function LiveDot({ label = "Live" }: { label?: string }) {
  return (
    <div className="ch-live-dot">
      <span className="dot" />
      <span className="label">{label}</span>
    </div>
  );
}
