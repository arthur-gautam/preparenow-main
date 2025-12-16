import { registerRootComponent } from 'expo';

// CRITICAL: Import GeofenceService at the root level to ensure TaskManager.defineTask
// is registered before the app starts. This is required for background geofencing to work.
import './services/GeofenceService';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
