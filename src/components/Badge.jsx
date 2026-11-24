export default function Badge({ tone, children }) {
  const tones = {
    urgent: 'bg-urgent/15 text-urgent ring-urgent/30',
    warn: 'bg-warn/15 text-warn ring-warn/30',
    fresh: 'bg-fresh/15 text-fresh ring-fresh/30',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}
