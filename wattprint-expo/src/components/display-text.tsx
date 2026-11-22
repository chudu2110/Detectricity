import { isLoaded } from 'expo-font';
import { Text, type TextProps } from 'react-native';

export function DisplayText({
  weight = 'medium',
  style,
  ...props
}: TextProps & { weight?: 'medium' | 'semibold' }) {
  const family =
    weight === 'semibold' ? 'BricolageGrotesque-SemiBold' : 'BricolageGrotesque-Medium';
  return (
    <Text
      {...props}
      style={[
        isLoaded(family)
          ? { fontFamily: family }
          : { fontWeight: weight === 'semibold' ? '600' : '500' },
        style,
      ]}
    />
  );
}
