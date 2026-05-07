import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColors, lightColors } from '../../src/constants/theme';
import { useSettingsStore } from '../../src/store/settingsStore';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const isDarkMode = useSettingsStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" color={color} size={size} /> }} />
      <Tabs.Screen name="beans" options={{ title: '원두', tabBarIcon: ({ color, size }) => <Ionicons name="cafe" color={color} size={size} /> }} />
      <Tabs.Screen name="log" options={{ title: '기록', tabBarIcon: ({ color, size }) => <MaterialIcons name="edit-note" color={color} size={size} /> }} />
      <Tabs.Screen name="timer" options={{ title: '타이머', tabBarIcon: ({ color, size }) => <MaterialIcons name="timer" color={color} size={size} /> }} />
      <Tabs.Screen name="equipment" options={{ title: '장비', tabBarIcon: ({ color, size }) => <MaterialIcons name="coffee-maker" color={color} size={size} /> }} />
      <Tabs.Screen name="export" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" color={color} size={size} /> }} />
    </Tabs>
  );
}
