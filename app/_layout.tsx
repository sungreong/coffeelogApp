import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import 'react-native-reanimated';
import { darkColors, lightColors } from '../src/constants/theme';
import { initDb } from '../src/db/schema';
import { rescheduleBeanNotifications } from '../src/services/notifications';
import { useCoffeeStore } from '../src/store/coffeeStore';
import { useSettingsStore } from '../src/store/settingsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const isDarkMode = useSettingsStore(s => s.isDarkMode);
  const expiryAlerts = useSettingsStore(s => s.expiryAlerts);
  const freshnessAlerts = useSettingsStore(s => s.freshnessAlerts);
  const hydrate = useCoffeeStore(s => s.hydrate);
  const beans = useCoffeeStore(s => s.beans);
  const colors = isDarkMode ? darkColors : lightColors;
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    async function prepare() {
      await initDb();
      await hydrate();
      setReady(true);
    }
    prepare().catch(error => {
      console.warn('CoffeeLog init failed', error);
      setReady(true);
    });
  }, [hydrate]);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync();
  }, [ready, fontsLoaded]);

  useEffect(() => {
    if (!ready) return;
    void rescheduleBeanNotifications(
      beans,
      { expiryAlerts, freshnessAlerts },
      { promptForPermission: false }
    ).catch(error => console.warn('CoffeeLog notification sync failed', error));
  }, [beans, expiryAlerts, freshnessAlerts, ready]);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.text }}>CoffeeLog 데이터베이스 준비 중...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}
