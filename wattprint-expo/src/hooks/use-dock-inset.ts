import { createContext, use } from 'react';

export const DockInsetContext = createContext(0);

export function useDockInset() {
  return use(DockInsetContext);
}
