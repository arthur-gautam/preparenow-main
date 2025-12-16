import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const GEOFENCE_TASK = 'GEOFENCE_BACKGROUND_TASK';
const LOCATION_WATCH_TASK = 'LOCATION_WATCH_TASK';
const LOGS_STORAGE_KEY = 'geofence_logs';
const ZONE_STATE_KEY = 'geofence_zone_state';
const ANDROID_CHANNEL_ID = 'geofence-alerts';

// Disaster Types
export type DisasterType = 'FLOOD' | 'FIRE' | 'EVACUATION' | 'STORM' | 'EARTHQUAKE';
export type SeverityLevel = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface DisasterGeofence {
  identifier: string;
  type: DisasterType;
  severity: SeverityLevel;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  description: string;
}

// TESTING TIP: Make radius larger (1000-2000m) for easier testing
export const TEST_GEOFENCES: DisasterGeofence[] = [
  {
    identifier: 'flood-derby-center',
    type: 'FLOOD',
    severity: 'HIGH',

    latitude: 52.9225,  // Derby city center
    longitude: -1.4746,

    radius: 1000, // INCREASED for easier  c
    notifyOnEnter: true,
    notifyOnExit: true,
    description: 'Derby City Centre - High Flood Risk Zone',
  },
  {
    identifier: 'evacuation-zone-north',
    type: 'EVACUATION',
    severity: 'CRITICAL',
    latitude: 52.93,
    longitude: -1.48,
    radius: 800, // INCREASED
    notifyOnEnter: true,
    notifyOnExit: true,
    description: 'North Derby - Mandatory Evacuation Zone',
  },
  {
    identifier: 'fire-risk-west',
    type: 'FIRE',
    severity: 'WARNING',
    latitude: 52.918,
    longitude: -1.49,
    radius: 800, // INCREASED
    notifyOnEnter: true,
    notifyOnExit: true,
    description: 'West Derby - Wildfire Risk Area',
  },
  {
    identifier: 'storm-warning-east',
    type: 'STORM',
    severity: 'WARNING',
    latitude: 52.925,
    longitude: -1.46,
    radius: 1000, // INCREASED
    notifyOnEnter: true,
    notifyOnExit: true,
    description: 'East Derby - Severe Storm Warning',
  },
];

export type GeofenceEvent = {
  type: 'ENTER' | 'EXIT';
  timestamp: string;
  region?: Location.LocationRegion;
  location?: { latitude: number; longitude: number };
  disasterType?: DisasterType;
  severity?: SeverityLevel;
  zoneName?: string;
};

type GeofenceTaskData = {
  eventType?: Location.GeofencingEventType;
  region?: Location.LocationRegion;
};

type AlertContent = {
  title: string;
  body: string;
  actionText: string;
  sound: boolean;
  priority: Notifications.AndroidNotificationPriority;
};

/**
 * Notifications handler (foreground behavior)
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Android notification channel
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Geofence Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
  });
}

function getDisasterAlertContent(
  type: DisasterType,
  severity: SeverityLevel,
  isEntering: boolean
): AlertContent {
  if (!isEntering) {
    return {
      title: 'Safe Zone',
      body: 'You have exited the emergency zone. Stay alert and monitor updates.',
      actionText: 'You are now in a safer area',
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    };
  }

  const alerts: Record<DisasterType, Record<SeverityLevel, AlertContent>> = {
    FLOOD: {
      INFO: {
        title: 'Flood Information',
        body: 'You are entering a flood watch area. Monitor weather conditions.',
        actionText: 'Stay informed about weather updates',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      WARNING: {
        title: 'Flood Warning',
        body: 'FLOOD WARNING: Avoid low-lying areas. Do not drive through water.',
        actionText: 'Move to higher ground if needed',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      HIGH: {
        title: 'HIGH FLOOD RISK',
        body: 'DANGER: High flood risk zone. Move to higher ground immediately. Avoid water.',
        actionText: 'Evacuate to higher ground NOW',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      CRITICAL: {
        title: 'CRITICAL FLOOD DANGER',
        body: 'LIFE-THREATENING FLOODING. Evacuate immediately to high ground. Call 999 if trapped.',
        actionText: 'EVACUATE NOW - Life threatening',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
    },
    FIRE: {
      INFO: {
        title: 'Fire Watch',
        body: 'Fire watch area. Be aware of smoke and follow local guidance.',
        actionText: 'Monitor air quality',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      WARNING: {
        title: 'Fire Warning',
        body: 'WILDFIRE WARNING: Stay indoors. Close windows. Prepare to evacuate.',
        actionText: 'Prepare evacuation kit',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      HIGH: {
        title: 'HIGH FIRE DANGER',
        body: 'EXTREME FIRE RISK: Evacuate if ordered. Have go-bag ready. Close all windows.',
        actionText: 'Be ready to evacuate',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      CRITICAL: {
        title: 'FIRE EVACUATION',
        body: 'IMMEDIATE EVACUATION REQUIRED. Leave now. Do not return. Call 999 for help.',
        actionText: 'LEAVE IMMEDIATELY',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
    },
    EVACUATION: {
      INFO: {
        title: 'Evacuation Notice',
        body: 'Evacuation may be required. Stay informed and prepare essentials.',
        actionText: 'Prepare evacuation plan',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      WARNING: {
        title: 'Evacuation Warning',
        body: 'EVACUATION LIKELY: Pack essentials. Identify evacuation routes. Stand by.',
        actionText: 'Prepare to leave soon',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      HIGH: {
        title: 'Evacuation Order',
        body: 'MANDATORY EVACUATION: Leave immediately. Take essentials only. Follow official routes.',
        actionText: 'EVACUATE NOW',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      CRITICAL: {
        title: 'IMMEDIATE EVACUATION',
        body: 'LIFE-THREATENING SITUATION. Leave NOW. Do not delay. Call 999 if unable to evacuate.',
        actionText: 'LEAVE IMMEDIATELY - Critical',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
    },
    STORM: {
      INFO: {
        title: 'Storm Watch',
        body: 'Storm conditions possible. Secure loose objects. Stay updated.',
        actionText: 'Prepare for storm',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      WARNING: {
        title: 'Storm Warning',
        body: 'SEVERE STORM: Stay indoors. Avoid windows. Secure outdoor items.',
        actionText: 'Take shelter indoors',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      HIGH: {
        title: 'SEVERE STORM',
        body: 'DANGEROUS STORM: Move to interior room. Stay away from windows. Avoid travel.',
        actionText: 'Shelter in safe location',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      CRITICAL: {
        title: 'EXTREME STORM',
        body: 'LIFE-THREATENING STORM. Take shelter immediately in basement or interior room. Call 999 for emergencies.',
        actionText: 'TAKE SHELTER NOW',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
    },
    EARTHQUAKE: {
      INFO: {
        title: 'Earthquake Information',
        body: 'Recent seismic activity detected. Review earthquake safety procedures.',
        actionText: 'Review safety procedures',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      WARNING: {
        title: 'Earthquake Alert',
        body: 'EARTHQUAKE RISK: Secure heavy objects. Know safe spots. Drop, Cover, Hold On.',
        actionText: 'Be prepared to take cover',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      HIGH: {
        title: 'Earthquake Zone',
        body: 'HIGH EARTHQUAKE RISK: Identify safe areas. Prepare for aftershocks. Stay alert.',
        actionText: 'Drop, Cover, Hold On if shaking',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      CRITICAL: {
        title: 'EARTHQUAKE EMERGENCY',
        body: 'MAJOR EARTHQUAKE: Drop, Cover, Hold On. Stay away from buildings. Expect aftershocks.',
        actionText: 'TAKE COVER - Stay safe',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
    },
  };

  return alerts[type][severity];
}

function getGeofenceDetails(identifier: string): DisasterGeofence | undefined {
  return TEST_GEOFENCES.find((g) => g.identifier === identifier);
}

async function logEvent(event: GeofenceEvent): Promise<void> {
  try {
    const existingLogs = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
    const logs: GeofenceEvent[] = existingLogs ? JSON.parse(existingLogs) : [];

    logs.unshift(event);
    if (logs.length > 50) logs.pop();

    await AsyncStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
    console.log('Event logged successfully');
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

async function sendAlertNotification(args: {
  title: string;
  body: string;
  sound: boolean;
  priority: Notifications.AndroidNotificationPriority;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    await ensureAndroidChannel();

    console.log('📱 Sending notification:', args.title);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: args.title,
        body: args.body,
        sound: args.sound,
        priority: args.priority,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
        data: args.data,
      },
      trigger: null,
    });

    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * CRITICAL: This MUST be defined at module scope (top-level)
 * This task runs in the background when geofence events occur
 */
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  console.log('');
  console.log('='.repeat(60));
  console.log('GEOFENCE TASK TRIGGERED!');
  console.log('Time:', new Date().toISOString());
  console.log('='.repeat(60));

  if (error) {
    console.error('Geofence task error:', error);
    await logEvent({
      type: 'ENTER',
      timestamp: new Date().toISOString(),
      zoneName: `ERROR: ${error.message}`,
    });
    return;
  }

  const eventData = data as GeofenceTaskData | undefined;
  const eventType = eventData?.eventType;
  const region = eventData?.region;

  console.log('Event Type:', eventType);
  console.log('Region:', region);

  if (!eventType || !region) {
    console.warn('Missing event type or region');
    return;
  }

  const identifier = region.identifier;
  if (!identifier) {
    console.warn('⚠️ Geofence region had no identifier');
    return;
  }

  console.log('Geofence Identifier:', identifier);

  const geofence = getGeofenceDetails(identifier);
  if (!geofence) {
    console.warn('Unknown geofence identifier:', identifier);
    return;
  }

  const timestamp = new Date().toISOString();
  const isEntering = eventType === Location.GeofencingEventType.Enter;

  console.log('');
  console.log('ALERT DETAILS:');
  console.log('   Action:', isEntering ? 'ENTERED ⬇️' : 'EXITED ⬆️');
  console.log('   Zone:', geofence.description);
  console.log('   Type:', geofence.type);
  console.log('   Severity:', geofence.severity);
  console.log('   Time:', new Date().toLocaleString());
  console.log('');

  const alertContent = getDisasterAlertContent(geofence.type, geofence.severity, isEntering);

  // Update zone state tracking
  if (isEntering) {
    await addToInsideZones(identifier);
  } else {
    await removeFromInsideZones(identifier);
  }

  // Send notification with enhanced title for visibility
  await sendAlertNotification({
    title: isEntering ? `⚠️ ${alertContent.title}` : `✅ ${alertContent.title}`,
    body: isEntering ? alertContent.body : `You have left ${geofence.description}. ${alertContent.body}`,
    sound: alertContent.sound,
    priority: isEntering ? alertContent.priority : Notifications.AndroidNotificationPriority.DEFAULT,
    data: {
      type: geofence.type,
      severity: geofence.severity,
      action: alertContent.actionText,
      zoneName: geofence.description,
      event: isEntering ? 'ENTER' : 'EXIT',
      geofenceId: geofence.identifier,
      timestamp,
      source: 'background_geofence',
    },
  });

  // Log event
  await logEvent({
    type: isEntering ? 'ENTER' : 'EXIT',
    timestamp,
    region,
    disasterType: geofence.type,
    severity: geofence.severity,
    zoneName: geofence.description,
  });

  console.log('='.repeat(60));
  console.log('');
});

/**
 * Public API
 */
export async function startGeofencing(): Promise<void> {
  console.log('');
  console.log('STARTING GEOFENCING...');
  console.log('='.repeat(60));

  try {
    // 1. Request foreground permission
    console.log('1️Requesting foreground location permission...');
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      throw new Error('Foreground location permission denied');
    }
    console.log('Foreground permission granted');

    // 2. Request background permission
    console.log('Requesting background location permission...');
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      throw new Error('Background location permission denied. Enable "Always Allow" in device settings.');
    }
    console.log('Background permission granted');

    // 3. Request notification permission
    console.log('Requesting notification permission...');
    const { status: notif } = await Notifications.requestPermissionsAsync();
    if (notif !== 'granted') {
      throw new Error('Notification permission denied');
    }
    console.log('Notification permission granted');

    // 4. Setup Android channel
    await ensureAndroidChannel();
    console.log('Android notification channel configured');

    // 5. Check if already running and stop
    const alreadyRunning = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
    if (alreadyRunning) {
      console.log('Task already registered, stopping first...');
      try {
        await Location.stopGeofencingAsync(GEOFENCE_TASK);
        console.log('Previous task stopped');
      } catch (err) {
        console.warn('Error stopping previous task:', err);
      }
    }

    // 6. Prepare regions
    const regions: Location.LocationRegion[] = TEST_GEOFENCES.map((g) => ({
      identifier: g.identifier,
      latitude: g.latitude,
      longitude: g.longitude,
      radius: g.radius,
      notifyOnEnter: g.notifyOnEnter,
      notifyOnExit: g.notifyOnExit,
    }));

    console.log('');
    console.log('REGISTERING GEOFENCES:');
    regions.forEach((r, i) => {
      const gf = TEST_GEOFENCES[i];
      console.log(`   ${i + 1}. ${gf.description}`);
      console.log(`      Coords: ${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}`);
      console.log(`      Radius: ${r.radius}m`);
    });
    console.log('');

    // 7. Start geofencing
    console.log('Starting geofencing service...');
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    console.log('Geofencing service started');

    // 8. Verify task registration
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
    console.log('Task registration status:', isRegistered ? '✅ REGISTERED' : '❌ NOT REGISTERED');

    // 9. Get current location for debugging
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      console.log('');
      console.log('CURRENT LOCATION:');
      console.log(`   Lat: ${location.coords.latitude.toFixed(6)}`);
      console.log(`   Lng: ${location.coords.longitude.toFixed(6)}`);
      console.log(`   Accuracy: ±${location.coords.accuracy?.toFixed(1)}m`);

      // Calculate distances to zones
      console.log('');
      console.log('DISTANCES TO ZONES:');
      TEST_GEOFENCES.forEach((gf) => {
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          gf.latitude,
          gf.longitude
        );
        const inside = distance <= gf.radius;
        console.log(`   ${gf.description}:`);
        console.log(`      Distance: ${distance.toFixed(0)}m ${inside ? '✅ INSIDE' : '⚪ Outside'}`);
      });
    } catch (locError) {
      console.warn('⚠️ Could not get current location:', locError);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('GEOFENCING SETUP COMPLETE');
    console.log(`Monitoring ${TEST_GEOFENCES.length} disaster zones`);
    console.log('='.repeat(60));
    console.log('');

    // 10. CRITICAL: Check initial position and notify if already inside zones
    console.log('10. Checking initial position for immediate alerts...');
    await checkInitialPosition();

    // 11. Start foreground location watching for more reliable transitions
    console.log('11. Starting foreground location watching...');
    await startLocationWatching();

    console.log('');
    console.log('🎉 GEOFENCING FULLY INITIALIZED');
    console.log('   - Background geofencing active');
    console.log('   - Foreground location watching active');
    console.log('   - Initial position checked');
    console.log('   Walk around to trigger geofence events!');
    console.log('');

  } catch (error) {
    console.error('ERROR STARTING GEOFENCING:', error);
    throw error;
  }
}

export async function stopGeofencing(): Promise<void> {
  console.log('Stopping geofencing...');

  // Stop foreground location watching
  stopLocationWatching();

  const registered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (!registered) {
    console.log('⚠️ Task not registered, nothing to stop');
    return;
  }

  await Location.stopGeofencingAsync(GEOFENCE_TASK);
  console.log('Geofencing stopped');

  // Clear zone state when stopping
  await clearZoneState();
  console.log('Zone state cleared');
}

export async function isGeofencingActive(): Promise<boolean> {
  const active = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  return active;
}

export async function getCurrentLocation(): Promise<Location.LocationObject> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return location;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getClosestGeofence(
  latitude: number,
  longitude: number
): { geofence: DisasterGeofence; distance: number } | null {
  let closest: { geofence: DisasterGeofence; distance: number } | null = null;

  for (const geofence of TEST_GEOFENCES) {
    const distance = calculateDistance(
      latitude,
      longitude,
      geofence.latitude,
      geofence.longitude
    );

    if (!closest || distance < closest.distance) {
      closest = { geofence, distance };
    }
  }

  return closest;
}

export async function getLogs(): Promise<GeofenceEvent[]> {
  try {
    const logs = await AsyncStorage.getItem(LOGS_STORAGE_KEY);
    return logs ? (JSON.parse(logs) as GeofenceEvent[]) : [];
  } catch (error) {
    console.error('Error getting logs:', error);
    return [];
  }
}

export async function clearLogs(): Promise<void> {
  await AsyncStorage.removeItem(LOGS_STORAGE_KEY);
}

export async function exportLogsAsCSV(): Promise<string> {
  const logs = await getLogs();
  let csv = 'Type,Timestamp,Date,Time,Disaster Type,Severity,Zone Name\n';

  for (const log of logs) {
    const date = new Date(log.timestamp);
    csv += `${log.type},${log.timestamp},${date.toLocaleDateString()},${date.toLocaleTimeString()},${log.disasterType ?? 'N/A'
      },${log.severity ?? 'N/A'},${log.zoneName ?? 'N/A'}\n`;
  }

  return csv;
}

export function getSeverityColor(severity: SeverityLevel): string {
  const colors: Record<SeverityLevel, string> = {
    INFO: '#2196F3',
    WARNING: '#FF9800',
    HIGH: '#FF5722',
    CRITICAL: '#D32F2F',
  };
  return colors[severity];
}

// ============================================================================
// ZONE STATE TRACKING - Track which zones the user is currently inside
// ============================================================================

interface ZoneState {
  insideZones: string[];  // Array of zone identifiers the user is currently inside
  lastUpdated: string;
}

async function getZoneState(): Promise<ZoneState> {
  try {
    const state = await AsyncStorage.getItem(ZONE_STATE_KEY);
    if (state) {
      return JSON.parse(state) as ZoneState;
    }
  } catch (error) {
    console.error('Error getting zone state:', error);
  }
  return { insideZones: [], lastUpdated: new Date().toISOString() };
}

async function setZoneState(state: ZoneState): Promise<void> {
  try {
    await AsyncStorage.setItem(ZONE_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving zone state:', error);
  }
}

async function addToInsideZones(zoneId: string): Promise<void> {
  const state = await getZoneState();
  if (!state.insideZones.includes(zoneId)) {
    state.insideZones.push(zoneId);
    state.lastUpdated = new Date().toISOString();
    await setZoneState(state);
    console.log(`📍 Added ${zoneId} to inside zones. Current: ${state.insideZones.join(', ')}`);
  }
}

async function removeFromInsideZones(zoneId: string): Promise<void> {
  const state = await getZoneState();
  const index = state.insideZones.indexOf(zoneId);
  if (index > -1) {
    state.insideZones.splice(index, 1);
    state.lastUpdated = new Date().toISOString();
    await setZoneState(state);
    console.log(`📍 Removed ${zoneId} from inside zones. Current: ${state.insideZones.join(', ') || 'none'}`);
  }
}

async function isInsideZone(zoneId: string): Promise<boolean> {
  const state = await getZoneState();
  return state.insideZones.includes(zoneId);
}

async function clearZoneState(): Promise<void> {
  await AsyncStorage.removeItem(ZONE_STATE_KEY);
  console.log('📍 Zone state cleared');
}

// ============================================================================
// INITIAL POSITION CHECK - Check if user is already inside zones when starting
// ============================================================================

/**
 * Check the user's current position against all geofences and send notifications
 * for any zones they are already inside. This is critical because geofence events
 * only trigger on TRANSITION (entering/exiting), not on initial position.
 */
export async function checkInitialPosition(): Promise<void> {
  console.log('');
  console.log('🔍 CHECKING INITIAL POSITION...');
  console.log('='.repeat(60));

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    console.log(`📍 Current Position: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`);
    console.log(`📍 Accuracy: ±${location.coords.accuracy?.toFixed(1)}m`);

    const currentState = await getZoneState();
    const currentlyInside: string[] = [];

    for (const geofence of TEST_GEOFENCES) {
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        geofence.latitude,
        geofence.longitude
      );

      const isInside = distance <= geofence.radius;
      console.log(`   ${geofence.description}: ${distance.toFixed(0)}m ${isInside ? '✅ INSIDE' : '⚪ Outside'}`);

      if (isInside) {
        currentlyInside.push(geofence.identifier);

        // If user wasn't previously known to be inside this zone, send ENTER notification
        if (!currentState.insideZones.includes(geofence.identifier)) {
          console.log(`   🚨 NEW ZONE ENTRY DETECTED: ${geofence.description}`);

          const alertContent = getDisasterAlertContent(geofence.type, geofence.severity, true);

          await sendAlertNotification({
            title: `⚠️ ${alertContent.title}`,
            body: alertContent.body,
            sound: alertContent.sound,
            priority: alertContent.priority,
            data: {
              type: geofence.type,
              severity: geofence.severity,
              action: alertContent.actionText,
              zoneName: geofence.description,
              event: 'ENTER',
              geofenceId: geofence.identifier,
              timestamp: new Date().toISOString(),
              source: 'initial_check',
            },
          });

          await logEvent({
            type: 'ENTER',
            timestamp: new Date().toISOString(),
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            disasterType: geofence.type,
            severity: geofence.severity,
            zoneName: geofence.description,
          });
        }
      } else {
        // If user was previously inside this zone but is now outside, send EXIT notification
        if (currentState.insideZones.includes(geofence.identifier)) {
          console.log(`   🟢 ZONE EXIT DETECTED: ${geofence.description}`);

          const alertContent = getDisasterAlertContent(geofence.type, geofence.severity, false);

          await sendAlertNotification({
            title: `✅ ${alertContent.title}`,
            body: `You have left ${geofence.description}. ${alertContent.body}`,
            sound: alertContent.sound,
            priority: alertContent.priority,
            data: {
              type: geofence.type,
              severity: geofence.severity,
              action: alertContent.actionText,
              zoneName: geofence.description,
              event: 'EXIT',
              geofenceId: geofence.identifier,
              timestamp: new Date().toISOString(),
              source: 'initial_check',
            },
          });

          await logEvent({
            type: 'EXIT',
            timestamp: new Date().toISOString(),
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            disasterType: geofence.type,
            severity: geofence.severity,
            zoneName: geofence.description,
          });
        }
      }
    }

    // Update the zone state with current inside zones
    await setZoneState({
      insideZones: currentlyInside,
      lastUpdated: new Date().toISOString(),
    });

    console.log('');
    if (currentlyInside.length > 0) {
      console.log(`⚠️ YOU ARE CURRENTLY INSIDE ${currentlyInside.length} EMERGENCY ZONE(S)`);
    } else {
      console.log('✅ You are not currently inside any emergency zones');
    }
    console.log('='.repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ Error checking initial position:', error);
  }
}

// ============================================================================
// FOREGROUND LOCATION WATCHING - Continuous monitoring for better accuracy
// ============================================================================

let locationSubscription: Location.LocationSubscription | null = null;

/**
 * Start watching the user's location in the foreground for more accurate
 * zone enter/exit detection. This supplements the background geofence triggers.
 */
export async function startLocationWatching(): Promise<void> {
  console.log('📍 Starting foreground location watching...');

  // Stop any existing subscription
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,    // Check every 10 seconds
      distanceInterval: 50,   // Or when user moves 50 meters
    },
    async (location) => {
      await handleLocationUpdate(location);
    }
  );

  console.log('📍 Foreground location watching started');
}

/**
 * Handle a location update and check for zone transitions
 */
async function handleLocationUpdate(location: Location.LocationObject): Promise<void> {
  const currentState = await getZoneState();
  const newInsideZones: string[] = [];

  for (const geofence of TEST_GEOFENCES) {
    const distance = calculateDistance(
      location.coords.latitude,
      location.coords.longitude,
      geofence.latitude,
      geofence.longitude
    );

    const isInside = distance <= geofence.radius;

    if (isInside) {
      newInsideZones.push(geofence.identifier);

      // User entered a new zone
      if (!currentState.insideZones.includes(geofence.identifier)) {
        console.log(`🚨 ENTERED ZONE (foreground): ${geofence.description}`);

        const alertContent = getDisasterAlertContent(geofence.type, geofence.severity, true);

        await sendAlertNotification({
          title: `⚠️ ${alertContent.title}`,
          body: alertContent.body,
          sound: alertContent.sound,
          priority: alertContent.priority,
          data: {
            type: geofence.type,
            severity: geofence.severity,
            action: alertContent.actionText,
            zoneName: geofence.description,
            event: 'ENTER',
            geofenceId: geofence.identifier,
            timestamp: new Date().toISOString(),
            source: 'foreground_watch',
          },
        });

        await logEvent({
          type: 'ENTER',
          timestamp: new Date().toISOString(),
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          disasterType: geofence.type,
          severity: geofence.severity,
          zoneName: geofence.description,
        });
      }
    } else {
      // User exited a zone
      if (currentState.insideZones.includes(geofence.identifier)) {
        console.log(`🟢 EXITED ZONE (foreground): ${geofence.description}`);

        const alertContent = getDisasterAlertContent(geofence.type, geofence.severity, false);

        await sendAlertNotification({
          title: `✅ ${alertContent.title}`,
          body: `You have left ${geofence.description}. ${alertContent.body}`,
          sound: alertContent.sound,
          priority: alertContent.priority,
          data: {
            type: geofence.type,
            severity: geofence.severity,
            action: alertContent.actionText,
            zoneName: geofence.description,
            event: 'EXIT',
            geofenceId: geofence.identifier,
            timestamp: new Date().toISOString(),
            source: 'foreground_watch',
          },
        });

        await logEvent({
          type: 'EXIT',
          timestamp: new Date().toISOString(),
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          disasterType: geofence.type,
          severity: geofence.severity,
          zoneName: geofence.description,
        });
      }
    }
  }

  // Update zone state
  if (JSON.stringify(newInsideZones.sort()) !== JSON.stringify(currentState.insideZones.sort())) {
    await setZoneState({
      insideZones: newInsideZones,
      lastUpdated: new Date().toISOString(),
    });
  }
}

/**
 * Stop watching the user's location in the foreground
 */
export function stopLocationWatching(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
    console.log('📍 Foreground location watching stopped');
  }
}

/**
 * Get the current zone state (for debugging)
 */
export async function getCurrentZoneState(): Promise<ZoneState> {
  return await getZoneState();
}