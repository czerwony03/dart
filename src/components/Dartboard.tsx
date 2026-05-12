import { memo, useMemo } from 'react';
import { useLang } from '../context';
import { BOARD } from '../constants';

interface DartboardProps {
  onHit: (score: number, label: string) => void;
}

type SegDatum =
  | { type: 'path'; key: string; d: string; fill: string; score: number; label: string }
  | { type: 'text'; key: string; x: string; y: string; label: string };

const CX = 180, CY = 180, DEG = 18;
const R  = { BOARD: 175, NUM: 164, DBL_O: 155, DBL_I: 140,
             TPL_O: 98,  TPL_I: 83, BULL_O: 26, BULL_I: 12 };

function buildSegData(): SegDatum[] {
  const pts = (r: number, deg: number) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };
  const arc = (rIn: number, rOut: number, a1: number, a2: number): string => {
    const p1 = pts(rOut, a1), p2 = pts(rOut, a2);
    const p3 = pts(rIn,  a2), p4 = pts(rIn,  a1);
    const lg = (a2 - a1) > 180 ? 1 : 0;
    const f  = (v: number) => v.toFixed(2);
    return `M${f(p1.x)} ${f(p1.y)} A${rOut} ${rOut} 0 ${lg} 1 ${f(p2.x)} ${f(p2.y)} `
         + `L${f(p3.x)} ${f(p3.y)} A${rIn} ${rIn} 0 ${lg} 0 ${f(p4.x)} ${f(p4.y)} Z`;
  };
  const data: SegDatum[] = [];
  BOARD.forEach((num, i) => {
    const a1 = i * DEG - DEG / 2, a2 = a1 + DEG;
    const light = i % 2 === 0;
    const bc    = light ? '#1e1e1e' : '#f0d9a8';
    const rc    = light ? '#c0392b' : '#27ae60';
    const lp    = pts(R.NUM, i * DEG);
    data.push(
      { type: 'path', key: `si${num}`, d: arc(R.TPL_O, R.DBL_I, a1, a2), fill: bc, score: num,     label: String(num) },
      { type: 'path', key: `so${num}`, d: arc(R.BULL_O, R.TPL_I, a1, a2), fill: bc, score: num,     label: String(num) },
      { type: 'path', key: `t${num}`,  d: arc(R.TPL_I, R.TPL_O, a1, a2), fill: rc, score: num * 3, label: `T${num}` },
      { type: 'path', key: `d${num}`,  d: arc(R.DBL_I, R.DBL_O, a1, a2), fill: rc, score: num * 2, label: `D${num}` },
      { type: 'text', key: `n${num}`,  x: lp.x.toFixed(1), y: lp.y.toFixed(1), label: String(num) },
    );
  });
  return data;
}

export const Dartboard = memo(function Dartboard({ onHit }: DartboardProps) {
  const { t } = useLang();

  /* Stable geometry — computed once regardless of onHit reference */
  const segData = useMemo(buildSegData, []);

  return (
    <svg className="dartboard-svg" viewBox="0 0 360 360"
         role="img" aria-label={t('dartboardLabel')}>
      <circle cx={CX} cy={CY} r={R.BOARD} fill="#111" stroke="#444" strokeWidth="1.5" />
      {segData.map(seg =>
        seg.type === 'text'
          ? <text key={seg.key} x={seg.x} y={seg.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#fff" fontSize="13" fontWeight="700"
                  pointerEvents="none">{seg.label}</text>
          : <path key={seg.key} className="dseg" d={seg.d} fill={seg.fill}
                  onClick={() => onHit(seg.score, seg.label)}
                  aria-label={seg.label} />
      )}
      <circle className="dseg" cx={CX} cy={CY} r={R.BULL_O}
              fill="#27ae60" onClick={() => onHit(25, 'Bull')}  aria-label="Bull 25" />
      <circle className="dseg" cx={CX} cy={CY} r={R.BULL_I}
              fill="#c0392b" onClick={() => onHit(50, 'BULL')}  aria-label="BULL 50" />
      <circle cx={CX} cy={CY} r={R.DBL_O} fill="none" stroke="#222" strokeWidth="1.5" />
    </svg>
  );
});
