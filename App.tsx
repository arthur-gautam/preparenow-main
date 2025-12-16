import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  startGeofencing,
  stopGeofencing,
  getCurrentLocation,
  getLogs,
  clearLogs,
  isGeofencingActive,
  TEST_GEOFENCES,
  calculateDistance,
  getClosestGeofence,
  getSeverityColor,
  GeofenceEvent,
  DisasterGeofence,
} from './services/GeofenceService';

interface ZoneDistance {
  geofence: DisasterGeofence;
  distance: number;
  isInside: boolean;
}

export default function HomeScreen() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [zoneDistances, setZoneDistances] = useState<ZoneDistance[]>([]);
  const [logs, setLogs] = useState<GeofenceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await checkMonitoringStatus();
    await loadLogs();
    await updateLocation();
  };

  const checkMonitoringStatus = async () => {
    const active = await isGeofencingActive();
    setIsMonitoring(active);
  };

  const updateLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location.coords);
      
      // Calculate distances to all geofences
      const distances: ZoneDistance[] = TEST_GEOFENCES.map(geofence => {
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          geofence.latitude,
          geofence.longitude
        );
        return {
          geofence,
          distance,
          isInside: distance <= geofence.radius
        };
      }).sort((a, b) => a.distance - b.distance);
      
      setZoneDistances(distances);
    } catch (error) {
      console.log('Location update error:', error);
    }
  };

  const loadLogs = async () => {
    const fetchedLogs = await getLogs();
    setLogs(fetchedLogs);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await updateLocation();
    await loadLogs();
    setRefreshing(false);
  };

  const handleToggleMonitoring = async () => {
    setLoading(true);
    try {
      if (isMonitoring) {
        await stopGeofencing();
        setIsMonitoring(false);
        Alert.alert('Stopped', 'Geofence monitoring stopped');
      } else {
        await startGeofencing();
        setIsMonitoring(true);
        Alert.alert(
          'Started', 
          `Monitoring ${TEST_GEOFENCES.length} disaster zones. Walk around to test alerts!`
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all event logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearLogs();
            setLogs([]);
          },
        },
      ]
    );
  };

  const activeZones = zoneDistances.filter(z => z.isInside);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PrepareNow - Emergency Zones</Text>
        <Text style={styles.headerSubtitle}>
          Multi-Disaster Location Monitoring
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Monitoring Status</Text>
            <Switch
              value={isMonitoring}
              onValueChange={handleToggleMonitoring}
              disabled={loading}
              trackColor={{ false: '#ccc', true: '#34C759' }}
            />
          </View>
          
          {loading && <ActivityIndicator size="small" color="#007AFF" />}
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={[styles.statusValue, isMonitoring && styles.statusActive]}>
              {isMonitoring ? '● Active' : '○ Inactive'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Zones Monitored:</Text>
            <Text style={styles.statusValue}>{TEST_GEOFENCES.length}</Text>
          </View>

          {activeZones.length > 0 && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                WARNING: You are inside {activeZones.length} emergency zone{activeZones.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Current Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Location</Text>
          
          {currentLocation ? (
            <>
              <View style={styles.locationRow}>
                <Text style={styles.label}>Latitude:</Text>
                <Text style={styles.value}>{currentLocation.latitude.toFixed(6)}</Text>
              </View>
              <View style={styles.locationRow}>
                <Text style={styles.label}>Longitude:</Text>
                <Text style={styles.value}>{currentLocation.longitude.toFixed(6)}</Text>
              </View>
              <View style={styles.locationRow}>
                <Text style={styles.label}>Accuracy:</Text>
                <Text style={styles.value}>±{currentLocation.accuracy?.toFixed(1)}m</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noData}>Loading location...</Text>
          )}
          
          <TouchableOpacity style={styles.refreshButton} onPress={updateLocation}>
            <Text style={styles.refreshButtonText}>Refresh Location</Text>
          </TouchableOpacity>
        </View>

        {/* All Disaster Zones Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nearby Disaster Zones</Text>
          
          {zoneDistances.length === 0 ? (
            <Text style={styles.noData}>Calculating distances...</Text>
          ) : (
            zoneDistances.map((zone, index) => (
              <View 
                key={zone.geofence.identifier} 
                style={[
                  styles.zoneItem,
                  zone.isInside && styles.zoneItemActive
                ]}
              >
                <View style={styles.zoneHeader}>
                  <View style={styles.zoneTypeRow}>
                    <View>
                      <Text style={styles.zoneType}>{zone.geofence.type}</Text>
                      <Text style={styles.zoneDescription}>
                        {zone.geofence.description}
                      </Text>
                    </View>
                  </View>
                  <View 
                    style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(zone.geofence.severity) }
                    ]}
                  >
                    <Text style={styles.severityText}>
                      {zone.geofence.severity}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.zoneDetails}>
                  <View style={styles.zoneDetailRow}>
                    <Text style={styles.zoneDetailLabel}>Distance:</Text>
                    <Text style={[
                      styles.zoneDetailValue,
                      zone.isInside && styles.zoneDetailValueInside
                    ]}>
                      {zone.distance.toFixed(0)}m
                    </Text>
                  </View>
                  <View style={styles.zoneDetailRow}>
                    <Text style={styles.zoneDetailLabel}>Radius:</Text>
                    <Text style={styles.zoneDetailValue}>
                      {zone.geofence.radius}m
                    </Text>
                  </View>
                  <View style={styles.zoneDetailRow}>
                    <Text style={styles.zoneDetailLabel}>Status:</Text>
                    <Text style={[
                      styles.zoneStatus,
                      zone.isInside && styles.zoneStatusInside
                    ]}>
                      {zone.isInside ? 'INSIDE ZONE' : 'Outside'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Event Log Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Event Log ({logs.length})</Text>
            {logs.length > 0 && (
              <TouchableOpacity onPress={handleClearLogs}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {logs.length === 0 ? (
            <Text style={styles.noData}>No events logged yet</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <View style={styles.logTypeContainer}>
                    <Text style={[
                      styles.logType, 
                      log.type === 'ENTER' && styles.logTypeEnter
                    ]}>
                      {log.type === 'ENTER' ? 'ENTERED' : 'EXITED'}
                    </Text>
                  </View>
                  <Text style={styles.logTime}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                
                {log.zoneName && (
                  <Text style={styles.logZoneName}>{log.zoneName}</Text>
                )}
                
                <View style={styles.logMetadata}>
                  {log.disasterType && (
                    <View style={styles.logMetaItem}>
                      <Text style={styles.logMetaLabel}>Type:</Text>
                      <Text style={styles.logMetaValue}>{log.disasterType}</Text>
                    </View>
                  )}
                  {log.severity && (
                    <View 
                      style={[
                        styles.logSeverityBadge,
                        { backgroundColor: getSeverityColor(log.severity) }
                      ]}
                    >
                      <Text style={styles.logSeverityText}>{log.severity}</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.logDate}>
                  {new Date(log.timestamp).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>


      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF3B30',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 5,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  statusActive: {
    color: '#34C759',
  },
  warningBanner: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
  },
  warningText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D32F2F',
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: '#666',
  },
  value: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  zoneItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  zoneItemActive: {
    backgroundColor: '#FFF3E0',
    borderLeftColor: '#FF5722',
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  zoneTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  zoneType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  zoneDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  zoneDetails: {
    marginTop: 8,
  },
  zoneDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  zoneDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  zoneDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  zoneDetailValueInside: {
    color: '#FF5722',
    fontWeight: '700',
  },
  zoneStatus: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  zoneStatusInside: {
    color: '#FF5722',
  },
  clearButton: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '500',
  },
  noData: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  logItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    paddingLeft: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  logTypeEnter: {
    color: '#FF3B30',
  },
  logTime: {
    fontSize: 14,
    color: '#666',
  },
  logZoneName: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  logMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logMetaItem: {
    flexDirection: 'row',
    marginRight: 12,
  },
  logMetaLabel: {
    fontSize: 12,
    color: '#888',
    marginRight: 4,
  },
  logMetaValue: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  logSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  logSeverityText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  logDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },

});