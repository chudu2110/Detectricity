import { useLocalSearchParams } from 'expo-router';
import { DeviceDetailScreen } from '@/screens/devices/device-detail';
export default function DeviceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DeviceDetailScreen id={id} />;
}
