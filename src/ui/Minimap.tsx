import type { RunView } from '../engine';

const BIOME_FILL: Record<string, string> = { meadow: '#6fbf5c', forest: '#3f8a57', river: '#55a8e0', highlands: '#a9b2c9' };
const DANGER: Record<string, string> = { calm: 'var(--good)', wary: 'var(--warn)', dangerous: 'var(--bad)' };
const H = 56; // the map is drawn 100 wide by 56 tall; place positions are 0 to 100 on both axes
const py = (y: number) => 6 + (y / 100) * (H - 18);
const px = (x: number) => 8 + (x / 100) * 84;

/** The world as dots and paths. Tap a neighbouring place to travel there. Fog hides what you cannot see yet. */
export function Minimap(p: { map: RunView['map']; emoji: string; canTravel: boolean; onTravel: (id: string) => void }) {
  const byId = Object.fromEntries(p.map.nodes.map((n) => [n.id, n]));
  return (
    <svg className="minimap" viewBox={`0 0 100 ${H}`} role="group" aria-label="Map of nearby places" data-panel="minimap">
      {p.map.paths.map(([a, b]) => {
        const A = byId[a]; const B = byId[b];
        const lit = (A.here || B.here);
        const faint = !A.known || !B.known;
        return <line key={`${a}-${b}`} x1={px(A.x)} y1={py(A.y)} x2={px(B.x)} y2={py(B.y)}
          className={`mpath${lit ? ' lit' : ''}${faint ? ' faint' : ''}`} />;
      })}
      {p.map.nodes.map((n) => {
        const x = px(n.x); const y = py(n.y);
        const go = n.adjacent && p.canTravel;
        const label = !n.known ? 'Unknown place' : n.here ? `${n.name}, you are here` : go ? `Travel to ${n.name}` : n.name;
        return (
          <g key={n.id} data-node={n.id} data-known={n.known} className={`mnode${go ? ' go' : ''}${n.here ? ' here' : ''}`}
            role={go ? 'button' : 'img'} tabIndex={go ? 0 : undefined} aria-label={label}
            onClick={go ? () => p.onTravel(n.id) : undefined}
            onKeyDown={go ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); p.onTravel(n.id); } } : undefined}>
            <title>{label}</title>
            {go && <circle cx={x} cy={y} r={8} fill="transparent" />}
            {n.danger && <circle cx={x} cy={y} r={5.2} fill="none" stroke={DANGER[n.danger]} strokeWidth={0.9} />}
            {n.here && <circle cx={x} cy={y} r={5.6} fill="none" stroke="var(--accent)" strokeWidth={1.2} className="herering" />}
            <circle cx={x} cy={y} r={3.6} fill={n.known ? BIOME_FILL[n.biome] : '#3a3f58'} stroke="#0c0e15" strokeWidth={0.7} />
            {!n.known && <text x={x} y={y + 1.5} className="mq">?</text>}
            {n.here && <text x={x} y={y + 1.7} className="memoji">{p.emoji}</text>}
            {n.goal && !n.here && <text x={x + 4.6} y={y - 2.6} className="mmark gold">★</text>}
            {n.exposed && <text x={x - 4.6} y={y - 2.6} className="mmark cold">❄</text>}
            {n.known && <text x={x} y={y + 8.6} className={`mlabel${n.here ? ' on' : ''}`}>{n.name}</text>}
          </g>
        );
      })}
    </svg>
  );
}
