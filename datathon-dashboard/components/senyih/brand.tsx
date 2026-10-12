const SIZES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl md:text-5xl',
} as const;

/** The solution wordmark: "MY" carries the Malaysia flag fill, "Pulau" uses the dashboard's sky-to-teal gradient. */
export function MyPulauMark({ size = 'md', className = '' }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.26em] font-black leading-none tracking-tight ${SIZES[size]} ${className}`}>
      <span className="sr-only">MY Pulau</span>
      <span
        aria-hidden="true"
        className="bg-cover bg-center bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(8,47,73,0.22)]"
        style={{ backgroundImage: "url('/malaysia.jpg')", WebkitBackgroundClip: 'text' }}
      >
        MY
      </span>
      <span aria-hidden="true" className="bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
        Pulau
      </span>
    </span>
  );
}
