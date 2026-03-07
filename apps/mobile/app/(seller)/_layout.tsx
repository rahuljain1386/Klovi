import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';

function Icon({ color }: { color: string }) {
  return <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, opacity: 0.4 }} />;
}

export default function SellerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: 1, height: 85, paddingBottom: 28, paddingTop: 8 },
      tabBarActiveTintColor: colors.amber.DEFAULT,
      tabBarInactiveTintColor: colors.warmGray,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <Icon color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color }) => <Icon color={color} /> }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox', tabBarIcon: ({ color }) => <Icon color={color} /> }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({ color }) => <Icon color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Icon color={color} /> }} />
    </Tabs>
  );
}
