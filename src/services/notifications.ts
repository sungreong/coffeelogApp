import Constants from 'expo-constants';
import { clearNotificationSchedules, getNotificationSchedules, replaceNotificationSchedules } from '../db/queries';
import { Bean } from '../types/models';
import { dateAtHour } from '../utils';
import { getFreshnessInfo } from './beanInventory';

declare const require: (id: string) => typeof import('./notificationsRuntime');

export interface NotificationRescheduleResult {
  scheduledCount: number;
  skippedCount: number;
  unavailableReason?: string;
}

type NotificationsRuntime = typeof import('./notificationsRuntime');

type NotificationOptions = {
  expiryAlerts: boolean;
  freshnessAlerts: boolean;
};

type RescheduleBehavior = {
  promptForPermission?: boolean;
};

const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
let notificationRescheduleQueue: Promise<void> = Promise.resolve();

const getNotifications = (): NotificationsRuntime | null => {
  if (isExpoGo) return null;
  return require('./notificationsRuntime');
};

const schedule = async (bean: Bean, title: string, body: string, date: Date, type: string) => {
  if (date.getTime() <= Date.now()) return null;
  const Notifications = getNotifications();
  if (!Notifications) return null;
  const notificationId = await Notifications.scheduleDateNotification(title, body, bean.id, date);
  return { beanId: bean.id, notificationId, type, fireAt: date.toISOString() };
};

const dateMinusDays = (dateText: string, days: number) => {
  const date = dateAtHour(dateText);
  if (!date) return null;
  date.setDate(date.getDate() - days);
  return date;
};

const datePlusDays = (dateText: string, days: number) => {
  const date = dateAtHour(dateText);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return date;
};

export const requestNotificationPermission = async () => {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  return Notifications.requestPermission();
};

export const hasNotificationPermission = async () => {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  return Notifications.hasPermission();
};

export const cancelTrackedNotifications = async () => {
  const Notifications = getNotifications();
  if (!Notifications) {
    await clearNotificationSchedules();
    return;
  }
  const existing = await getNotificationSchedules();
  await Promise.all(existing.map(record => Notifications.cancelScheduled(record.notificationId).catch(() => undefined)));
  await clearNotificationSchedules();
};

const runBeanNotificationReschedule = async (
  beans: Bean[],
  options: NotificationOptions,
  behavior: RescheduleBehavior = { promptForPermission: true }
): Promise<NotificationRescheduleResult> => {
  if (!options.expiryAlerts && !options.freshnessAlerts) {
    await cancelTrackedNotifications();
    return { scheduledCount: 0, skippedCount: 0 };
  }
  if (isExpoGo) {
    await clearNotificationSchedules();
    return { scheduledCount: 0, skippedCount: 0, unavailableReason: 'Expo Go에서는 알림 예약을 지원하지 않습니다. 설치용 APK나 development build에서 사용할 수 있습니다.' };
  }
  const ok = behavior.promptForPermission === false ? await hasNotificationPermission() : await requestNotificationPermission();
  if (!ok) {
    await cancelTrackedNotifications();
    return { scheduledCount: 0, skippedCount: 0, unavailableReason: '알림 권한이 꺼져 있어 예약하지 못했습니다.' };
  }
  await cancelTrackedNotifications();
  const scheduled = [];
  let skippedCount = 0;
  for (const bean of beans.filter(item => item.lotStatus === 'open' || item.lotStatus === 'unopened')) {
    if (options.expiryAlerts && bean.expiryDate) {
      for (const days of [30, 7, 0]) {
        const date = dateMinusDays(bean.expiryDate, days);
        if (!date) {
          skippedCount += 1;
          continue;
        }
        const record = await schedule(bean, '원두 유통기한 알림', `${bean.name} 유통기한 ${days === 0 ? '당일' : `${days}일 전`}입니다.`, date, `expiry_${days}`);
        if (record) scheduled.push(record);
      }
    }
    if (options.freshnessAlerts) {
      const freshness = getFreshnessInfo(bean);
      if (freshness.freshUntilDate) {
        for (const days of [7, 0]) {
          const date = dateMinusDays(freshness.freshUntilDate, days);
          if (!date) {
            skippedCount += 1;
            continue;
          }
          const record = await schedule(
            bean,
            '원두 신선도 알림',
            `${bean.name} ${days === 0 ? '신선일 당일' : '신선일 7일 전'}입니다. ${freshness.actionText}.`,
            date,
            `freshness_due_${days}`
          );
          if (record) scheduled.push(record);
        }
      }
      if (bean.openedDate) {
        const date = datePlusDays(bean.openedDate, 14);
        if (!date) {
          skippedCount += 1;
          continue;
        }
        const record = await schedule(bean, '원두 신선도 알림', `${bean.name} 개봉 후 14일입니다. 열린 원두부터 마셔보세요.`, date, 'freshness_open_14');
        if (record) scheduled.push(record);
      }
    }
  }
  await replaceNotificationSchedules(scheduled);
  return { scheduledCount: scheduled.length, skippedCount };
};

export const rescheduleBeanNotifications = (
  beans: Bean[],
  options: NotificationOptions,
  behavior: RescheduleBehavior = { promptForPermission: true }
): Promise<NotificationRescheduleResult> => {
  const task = notificationRescheduleQueue
    .catch(() => undefined)
    .then(() => runBeanNotificationReschedule(beans, options, behavior));
  notificationRescheduleQueue = task.then(() => undefined, () => undefined);
  return task;
};
