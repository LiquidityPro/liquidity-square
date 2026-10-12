import Image from 'next/image'

export function Logo() {
  return (
    <div
      role="img"
      aria-label="Liquidity Square"
      className="flex items-center gap-2"
      style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '-0.05em' }}
    >
      <Image src="/favicon.svg" alt="" width={32} height={32} className="shrink-0" />
      <span>
        Liquidity<span style={{ color: 'var(--primary-color)' }}>Square</span>
      </span>
    </div>
  );
}
