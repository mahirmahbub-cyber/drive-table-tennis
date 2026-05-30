// Looping pixel-art table-tennis rally for the home hero.
// Pure SVG + CSS keyframes (defined in globals.css). No client JS.

function Paddle({ x, color, className }: { x: number; color: string; className: string }) {
  return (
    <g className={className}>
      {/* blade */}
      <rect x={x} y={44} width={20} height={30} rx={3} fill={color} />
      <rect x={x + 4} y={48} width={6} height={8} fill="#ffffff" opacity={0.35} />
      {/* handle */}
      <rect x={x + 6} y={72} width={8} height={18} rx={2} fill="#161616" />
    </g>
  )
}

export function PixelRally() {
  return (
    <svg
      viewBox="0 0 320 120"
      className="w-full h-auto"
      style={{ shapeRendering: 'crispEdges' as const }}
      role="img"
      aria-label="Animated pixel-art table-tennis rally"
    >
      {/* table surface */}
      <rect x={16} y={96} width={288} height={6} fill="var(--secondary)" />
      <rect x={16} y={96} width={288} height={2} fill="var(--primary)" opacity={0.5} />

      {/* net */}
      <rect x={158} y={72} width={4} height={24} fill="#a7a7a7" />
      {[74, 80, 86, 92].map((y) => (
        <rect key={y} x={157} y={y} width={6} height={2} fill="#cfcfcf" />
      ))}

      {/* road-lane dashes along the base — a nod to Drive */}
      {[24, 64, 104, 144, 184, 224, 264].map((x) => (
        <rect key={x} x={x} y={110} width={20} height={4} fill="var(--border)" />
      ))}

      <Paddle x={30} color="#2960c5" className="rally-paddle-l" />
      <Paddle x={270} color="#ff5e55" className="rally-paddle-r" />

      {/* ball: outer group sweeps X, inner group bounces Y */}
      <g className="rally-ball-x">
        <g className="rally-ball-y">
          {/* trail ghosts */}
          <rect className="rally-trail" x={40} y={84} width={6} height={6} fill="#3b97fa" />
          <rect className="rally-trail" x={46} y={84} width={6} height={6} fill="#3b97fa" opacity={0.4} />
          {/* ball */}
          <rect x={52} y={82} width={9} height={9} rx={1} fill="#ffffff" stroke="#161616" strokeWidth={1.5} />
        </g>
      </g>
    </svg>
  )
}
