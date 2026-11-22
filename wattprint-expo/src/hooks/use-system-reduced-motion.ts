import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useSystemReducedMotion() {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let acceptSnapshot = true;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      acceptSnapshot = false;
      setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (acceptSnapshot) setReduced(value);
    });
    return () => {
      acceptSnapshot = false;
      listener.remove();
    };
  }, []);
  return reduced;
}
