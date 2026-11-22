import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { withUniwind } from 'uniwind';

const StyledSvg = withUniwind(Svg);

const paths = {
  home: <Path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  devices: (
    <>
      <Rect transform="translate(3 3)" width="7" height="7" rx="2" />
      <Rect transform="translate(14 3)" width="7" height="7" rx="2" />
      <Rect transform="translate(3 14)" width="7" height="7" rx="2" />
      <Rect transform="translate(14 14)" width="7" height="7" rx="2" />
    </>
  ),
  chart: (
    <>
      <Path d="M4 20V10m8 10V4m8 16v-7" strokeWidth="3" />
    </>
  ),
  chat: (
    <Path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5ZM7 10h10M7 14h6" />
  ),
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  bolt: <Path d="m13 2-9 12h7l-1 8 10-13h-7Z" />,
  leaf: (
    <>
      <Path d="M20 3c-1 5 3 12-5 16C6 23 1 14 6 8c3-4 8-3 14-5Z" />
      <Path d="M5 21c1-5 5-9 10-12" />
    </>
  ),
  arrow: <Path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <Path d="M20 12H4m6-6-6 6 6 6" />,
  chevron: <Path d="m9 5 7 7-7 7" />,
  close: <Path d="m6 6 12 12M6 18 18 6" />,
  plus: <Path d="M12 4v16M4 12h16" />,
  mic: (
    <>
      <Rect transform="translate(8 2)" width="8" height="13" rx="4" />
      <Path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
    </>
  ),
  send: <Path d="m21 3-7 18-4-8-8-3 19-7ZM10 13 21 3" />,
  stop: <Rect transform="translate(5 5)" width="14" height="14" rx="3" />,
  pause: <Path d="M8 5v14m8-14v14" strokeWidth="3" />,
  play: <Path d="m7 4 12 8-12 8Z" />,
  history: (
    <>
      <Path d="M3 10a9 9 0 1 1 1 8M3 4v6h6M12 7v5l3 2" />
    </>
  ),
  volume: (
    <>
      <Path d="m11 4-6 5H2v6h3l6 5ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  check: <Path d="m5 12 4 4L19 6" />,
  bell: <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
  search: (
    <>
      <Circle cx="10.5" cy="10.5" r="6.5" />
      <Path d="m16 16 5 5" />
    </>
  ),
  fridge: (
    <>
      <Rect transform="translate(5 2)" width="14" height="20" rx="3" />
      <Path d="M5 9h14M8 5v1m0 7v3" />
    </>
  ),
  washer: (
    <>
      <Rect transform="translate(3 2)" width="18" height="20" rx="3" />
      <Circle cx="12" cy="14" r="5" />
      <Path d="M6 6h1m3 0h7" />
    </>
  ),
  plug: <Path d="M8 2v5m8-5v5M5 7h14v3a7 7 0 0 1-14 0Zm7 10v5" />,
  kettle: (
    <>
      <Path d="M7 6h10l2 13H5L7 6ZM9 3h6M7 10H3l3 5m12-7h2a3 3 0 0 1 0 6h-2M4 22h16" />
    </>
  ),
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  settings: (
    <>
      <Path d="m9 3-1 3-3 1v4l2 2-1 3 3 3 3-1 3 1 3-3-1-3 2-2V7l-3-1-1-3Z" />
      <Circle cx="12" cy="11" r="3" />
    </>
  ),
  logout: <Path d="M10 3H4v18h6m4-13 5 4-5 4m-6-4h12" />,
  moon: <Path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />,
  info: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 11v6m0-10v1" />
    </>
  ),
  up: <Path d="M7 21H3V10h4m0 11h10a2 2 0 0 0 2-2l2-7a2 2 0 0 0-2-2h-6l1-5a2 2 0 0 0-3-2l-4 7Z" />,
  down: <Path d="M7 3H3v11h4M7 3h10a2 2 0 0 1 2 2l2 7a2 2 0 0 1-2 2h-6l1 5a2 2 0 0 1-3 2l-4-7Z" />,
} as const;

export type AppIconName = keyof typeof paths;

export function AppIcon({
  name,
  size = 22,
  className = 'text-foreground',
}: {
  name: AppIconName;
  size?: number;
  className?: string;
}) {
  return (
    <StyledSvg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </StyledSvg>
  );
}

export function deviceIcon(type: string): AppIconName {
  if (/fridge|freezer/.test(type)) return 'fridge';
  if (/wash|dish/.test(type)) return 'washer';
  if (/kettle/.test(type)) return 'kettle';
  if (/heater|microwave/.test(type)) return 'sun';
  return 'plug';
}
