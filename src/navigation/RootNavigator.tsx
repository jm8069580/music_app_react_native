import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import LibraryScreen from '../screens/library/LibraryScreen';
import PlaylistsScreen from '../screens/playlists/PlaylistsScreen';
import FavoritesScreen from '../screens/favorites/FavoritesScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { PlayerScreen } from '../screens/player/PlayerScreen';
import { MiniPlayer } from '../services/player/MiniPlayer';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: '#0a0a0a' },
                headerTintColor: '#fff',
                tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#222' },
                tabBarActiveTintColor: '#1db954',
                tabBarInactiveTintColor: '#888',
                tabBarIcon: ({ color, size }) => {
                    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                        Biblioteca: 'musical-notes',
                        Playlists: 'list',
                        Favoritos: 'heart',
                        Ajustes: 'settings',
                    };
                    return <Ionicons name={icons[route.name]} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Biblioteca" component={LibraryScreen} />
            <Tab.Screen name="Playlists" component={PlaylistsScreen} />
            <Tab.Screen name="Favoritos" component={FavoritesScreen} />
            <Tab.Screen name="Ajustes" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

export default function RootNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Group screenOptions={{ presentation: 'transparentModal' }}>
                    <Stack.Screen name="PlayerModal" component={PlayerScreen} />
                </Stack.Group>
            </Stack.Navigator>
            <MiniPlayer />
        </NavigationContainer>
    );
}
