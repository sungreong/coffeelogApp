import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestPermission = async () => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

export const hasPermission = async () => {
  const existing = await Notifications.getPermissionsAsync();
  return existing.granted;
};

export const cancelScheduled = async (notificationId: string) => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

export const scheduleDateNotification = async (title: string, body: string, beanId: string, date: Date) => {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { beanId } },
    trigger: { type: 'date', date } as any,
  });
};
