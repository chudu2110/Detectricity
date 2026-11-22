import { useId, type ReactNode } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

import { AppIcon, deviceIcon, type AppIconName } from '@/components/app-icon';
import { toCssColor } from '@/lib/nav-theme';

const tokens = [
  '--art-light',
  '--art-ink',
  '--art-mint',
  '--art-moss',
  '--art-sky',
  '--art-lake',
  '--art-clay',
  '--art-plum',
  '--art-honey',
  '--art-amber',
];

type Paint = {
  porcelain: string;
  mint: string;
  sky: string;
  clay: string;
  honey: string;
  glass: string;
  light: string;
  moss: string;
  lake: string;
  plum: string;
  amber: string;
};

const artwork: Partial<Record<AppIconName, (paint: Paint) => ReactNode>> = {
  home: (p) => (
    <>
      <Path d="M41 23l11-4v23l-11 9-6-7Z" fill={p.moss} />
      <Path d="M13 28 32 13l13 14v18q0 6-6 6H19q-6 0-6-6Z" fill={p.porcelain} />
      <Rect transform="translate(28 34)" width={10} height={17} rx={3} fill={p.honey} />
      <Rect transform="translate(17 32)" width={8} height={9} rx={2} fill={p.sky} />
      <Path d="M9 26 28 9q3-3 6-1l22 15-8 8-17-15-17 15q-5 4-5-5Z" fill={p.moss} />
      <Path
        d="M8 24 27 7q3-3 7 0l18 15q3 3 0 6-2 2-5 0L31 15 13 30q-4 3-6-1-1-3 1-5Z"
        fill={p.mint}
      />
      <Path
        d="m12 24 17-15q2-2 4 0l9 8"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.66}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </>
  ),
  devices: (p) => (
    <>
      <Rect transform="translate(9 11)" width={31} height={42} rx={9} fill={p.lake} />
      <Rect transform="translate(8 8)" width={30} height={42} rx={9} fill={p.sky} />
      <Path
        d="M14 16q1-3 5-3h12"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.75}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Rect transform="translate(14 21)" width={17} height={4} rx={2} fill={p.lake} />
      <Circle cx={24} cy={36} r={9} fill={p.lake} />
      <Circle cx={24} cy={36} r={6} fill={p.glass} />
      <Rect transform="translate(35 22)" width={21} height={32} rx={7} fill={p.moss} />
      <Rect transform="translate(34 20)" width={20} height={31} rx={7} fill={p.mint} />
      <Rect transform="translate(39 26)" width={10} height={12} rx={3} fill={p.glass} />
      <Circle cx={44} cy={44} r={2} fill={p.honey} />
    </>
  ),
  chart: (p) => (
    <>
      <Rect transform="translate(9 10)" width={46} height={42} rx={11} fill={p.lake} />
      <Rect transform="translate(8 7)" width={46} height={42} rx={11} fill={p.porcelain} />
      <Path
        d="M15 16q1-5 7-5h19"
        fill="none"
        stroke={p.light}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Rect transform="translate(15 30)" width={8} height={13} rx={3} fill={p.mint} />
      <Rect transform="translate(27 23)" width={8} height={20} rx={3} fill={p.sky} />
      <Rect transform="translate(39 16)" width={8} height={27} rx={3} fill={p.clay} />
      <Path
        d="M18 32v3m12-10v4m12-11v5"
        stroke={p.light}
        strokeOpacity={0.65}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </>
  ),
  chat: (p) => (
    <>
      <Path d="M22 12h17a18 18 0 0 1 0 36H25l-10 7q-3 1-3-2l2-9a18 18 0 0 1 8-32Z" fill={p.plum} />
      <Path d="M21 8h17a18 18 0 0 1 0 36H24l-10 7q-4 2-3-3l2-7A18 18 0 0 1 21 8Z" fill={p.clay} />
      <Path
        d="M12 22q2-9 12-10h12"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.68}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M28 17q2 8 9 9-7 2-9 10-2-8-9-10 7-1 9-9Zm14-1q1 4 5 5-4 1-5 5-1-4-5-5 4-1 5-5Z"
        fill={p.light}
      />
      <Circle cx={41} cy={32} r={2.2} fill={p.honey} />
    </>
  ),
  user: (p) => (
    <>
      <Path d="M10 48q0-17 22-17t22 17q0 6-6 6H16q-6 0-6-6Z" fill={p.moss} />
      <Path d="M9 45q0-16 22-16t22 16q0 6-6 6H15q-6 0-6-6Z" fill={p.mint} />
      <Circle cx={32} cy={20} r={14} fill={p.amber} />
      <Circle cx={30} cy={18} r={13} fill={p.honey} />
      <Ellipse
        cx={26}
        cy={12}
        rx={5.5}
        ry={2.7}
        transform="rotate(-31 26 12)"
        fill={p.light}
        opacity={0.64}
      />
      <Path
        d="M14 44q2-7 9-9"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.67}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </>
  ),
  fridge: (p) => (
    <>
      <Path d="M40 6h5q7 1 7 8v32q0 6-5 8l-8 2-7-7Z" fill={p.lake} />
      <Rect transform="translate(13 5)" width={31} height={50} rx={8} fill={p.sky} />
      <Rect transform="translate(13 5)" width={31} height={17} rx={7} fill={p.porcelain} />
      <Rect transform="translate(13 23)" width={31} height={30} rx={6} fill={p.porcelain} />
      <Path
        d="M19 13q0-4 5-4h12M18 28h19"
        fill="none"
        stroke={p.light}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Rect transform="translate(34 12)" width={3} height={6} rx={1.5} fill={p.lake} />
      <Rect transform="translate(34 31)" width={3} height={10} rx={1.5} fill={p.lake} />
      <Circle cx={22} cy={36} r={2.1} fill={p.clay} />
      <Rect transform="translate(20 40)" width={6} height={4} rx={1.2} fill={p.honey} />
    </>
  ),
  washer: (p) => (
    <>
      <Path d="M43 10h5q7 0 7 8v28q0 7-6 9l-6 1-9-7Z" fill={p.lake} />
      <Rect transform="translate(10 9)" width={39} height={47} rx={9} fill={p.porcelain} />
      <Path d="M11 20h37" stroke={p.lake} strokeOpacity={0.48} strokeWidth={1.5} />
      <Rect transform="translate(16 13)" width={12} height={4} rx={2} fill={p.sky} />
      <Circle cx={40} cy={15} r={2.7} fill={p.mint} />
      <Circle cx={29} cy={37} r={13} fill={p.lake} />
      <Circle cx={29} cy={37} r={10} fill={p.glass} />
      <Path d="M20 39q6-4 11 0t8-1a10 10 0 0 1-19 1Z" fill={p.sky} opacity={0.72} />
      <Path
        d="M22 35q2-5 7-6"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.77}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </>
  ),
  plug: (p) => (
    <G transform="rotate(24 32 32)">
      <Path
        d="M32 42v6q0 7 8 9"
        fill="none"
        stroke={p.moss}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Rect transform="translate(21 7)" width={7} height={19} rx={3} fill={p.honey} />
      <Rect transform="translate(36 7)" width={7} height={19} rx={3} fill={p.honey} />
      <Path d="M18 22h28v11a14 14 0 0 1-28 0Z" fill={p.moss} />
      <Path d="M16 21h30v10a15 15 0 0 1-30 0Z" fill={p.mint} />
      <Rect transform="translate(13 18)" width={36} height={9} rx={4} fill={p.porcelain} />
      <Path
        d="M21 29q0 7 5 10"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.62}
        strokeWidth={2.1}
        strokeLinecap="round"
      />
    </G>
  ),
  kettle: (p) => (
    <>
      <Path d="M43 23c18-6 19 21 2 20" fill="none" stroke={p.plum} strokeWidth={7} />
      <Path d="M43 21c16-5 18 19 2 20" fill="none" stroke={p.clay} strokeWidth={4} />
      <Path d="m18 24-12-4 8 17 8 1Z" fill={p.clay} />
      <Path d="M21 18h16q6 1 7 10l5 15q3 10-8 11H20q-10-1-8-11l5-19q1-5 4-6Z" fill={p.clay} />
      <Ellipse cx={29} cy={20} rx={13} ry={4} fill={p.plum} />
      <Rect transform="translate(23 12)" width={12} height={7} rx={3.5} fill={p.honey} />
      <Path
        d="M20 27q-2 11-3 17"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.76}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path d="M15 49q12 5 32 0-1 6-8 6H23q-7 0-8-6Z" fill={p.plum} />
    </>
  ),
  sun: (p) => (
    <>
      <Path
        d="M32 8v5m0 36v5M9 31h5m36 0h5M16 15l3 3m26 26 3 3M16 47l3-3m26-26 3-3"
        stroke={p.amber}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <Circle cx={32} cy={33} r={17} fill={p.amber} />
      <Circle cx={31} cy={30} r={17} fill={p.honey} />
      <Path
        d="M19 29q2-8 10-10"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.76}
        strokeWidth={2.7}
        strokeLinecap="round"
      />
    </>
  ),
  bolt: (p) => (
    <>
      <Path d="M36 6q4-3 4 2l-3 19h13q5 0 2 5L29 57q-4 4-4-1l4-20H15q-4 0-2-4Z" fill={p.amber} />
      <Path d="M33 5q4-3 4 2l-3 18h13q5 0 2 5L26 54q-4 4-4-1l4-20H12q-4 0-2-4Z" fill={p.honey} />
      <Path
        d="m15 27 16-17"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.78}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </>
  ),
  leaf: (p) => (
    <>
      <Path d="M53 9C37 14 17 9 12 26 6 45 24 56 39 47 54 40 50 23 53 9Z" fill={p.moss} />
      <Path d="M53 8C35 11 15 9 10 25 5 40 19 51 35 46 53 41 50 22 53 8Z" fill={p.mint} />
      <Path
        d="M12 54c5-14 14-22 31-35M23 36l-1-10m8 4 11-1"
        fill="none"
        stroke={p.moss}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M16 25q5-10 16-10"
        fill="none"
        stroke={p.light}
        strokeOpacity={0.68}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </>
  ),
};

export function IllustratedIcon({ name, size = 48 }: { name: AppIconName; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const values = useCSSVariable(tokens);
  const [light, ink, mint, moss, sky, lake, clay, plum, honey, amber] = values.map((value) =>
    typeof value === 'string' ? toCssColor(value) : undefined,
  );
  const draw = artwork[name];
  if (
    !draw ||
    !light ||
    !ink ||
    !mint ||
    !moss ||
    !sky ||
    !lake ||
    !clay ||
    !plum ||
    !honey ||
    !amber
  ) {
    return <AppIcon name={name} size={size} />;
  }

  const gradient = (name: string) => `url(#${id}-${name})`;
  const materials = [
    ['porcelain', light, sky, lake],
    ['mint', light, mint, moss],
    ['sky', light, sky, lake],
    ['clay', light, clay, plum],
    ['honey', light, honey, amber],
    ['glass', sky, lake, ink],
  ];

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Defs>
        {materials.map(([name, highlight, body, shade]) => (
          <LinearGradient key={name} id={`${id}-${name}`} x1="12%" y1="0%" x2="86%" y2="100%">
            <Stop offset={0} stopColor={highlight} />
            <Stop offset={name === 'porcelain' ? 0.82 : 0.42} stopColor={body} />
            <Stop offset={1} stopColor={shade} stopOpacity={name === 'porcelain' ? 0.72 : 1} />
          </LinearGradient>
        ))}
        <RadialGradient id={`${id}-shadow`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset={0} stopColor={ink} stopOpacity={0.34} />
          <Stop offset={1} stopColor={ink} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={33} cy={54} rx={25} ry={6.5} fill={gradient('shadow')} />
      {draw({
        porcelain: gradient('porcelain'),
        mint: gradient('mint'),
        sky: gradient('sky'),
        clay: gradient('clay'),
        honey: gradient('honey'),
        glass: gradient('glass'),
        light,
        moss,
        lake,
        plum,
        amber,
      })}
    </Svg>
  );
}

export function DeviceIllustration({ type, size = 52 }: { type: string; size?: number }) {
  return <IllustratedIcon name={deviceIcon(type)} size={size} />;
}
