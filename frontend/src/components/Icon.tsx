const paths = {
  activity: 'M2 12h5l3-8 4 16 3-8h5',
  finding: 'M4 8V4h4m8 0h4v4M4 16v4h4m8 0h4v-4M8 12h8',
  network: 'M3 9h6v6H3zM16 3h5v5h-5zM16 16h5v5h-5zM9 12h3V5.5h4M12 12v6.5h4',
  index: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h4',
  shield: 'M12 2 21 6v6c0 4.5-4 8-9 10-5-2-9-5.5-9-10V6z',
  route: 'M3 12h17m-5-5 5 5-5 5',
  filter: 'M3 6h18M6 12h12m-9 6h6',
} as const;

export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}
