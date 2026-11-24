import { useLocalSearchParams } from 'expo-router';

import { DeviceGroupScreen } from '@/screens/devices/device-group';

export default function DeviceGroupRoute() {
  const { type } = useLocalSearchParams<{ type: string }>();
  return <DeviceGroupScreen type={type} />;
}
