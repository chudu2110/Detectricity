import { useLocalSearchParams } from 'expo-router';
import { PlugDetailScreen } from '@/screens/devices/plug-detail';

export default function PlugRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlugDetailScreen id={id} />;
}
