import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import LibraryScreen from '../screens/library/LibraryScreen';
import PlaylistsScreen from '../screens/playlists/PlaylistsScreen';
import PlaylistDetailScreen from '../screens/playlists/PlaylistDetailScreen';
import FavoritesScreen from '../screens/favorites/FavoritesScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { PlayerScreen } from '../screens/player/PlayerScreen';
import LyricsScreen from '../screens/player/LyricsScreen';
import { MiniPlayer } from '../services/player/MiniPlayer';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const PlaylistsNativeStack = createNativeStackNavigator();
const TAB_BAR_HEIGHT = 56;

function PlaylistsStack() {
    return (
        <PlaylistsNativeStack.Navigator screenOptions={{ headerShown: false }}>
            <PlaylistsNativeStack.Screen name="PlaylistsHome" component={PlaylistsScreen} />
            <PlaylistsNativeStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
        </PlaylistsNativeStack.Navigator>
    );
}

function MainTabs() {
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: '#0a0a0a' },
                headerTintColor: '#fff',
                tabBarStyle: {
                    backgroundColor: '#0a0a0a',
                    borderTopColor: '#222',
                    height: TAB_BAR_HEIGHT + insets.bottom,
                    paddingBottom: insets.bottom,
                },
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
            <Tab.Screen
                name="Playlists"
                component={PlaylistsStack}
                options={{ headerShown: false }}
            />
            <Tab.Screen name="Favoritos" component={FavoritesScreen} />
            <Tab.Screen name="Ajustes" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

export default function RootNavigator() {
    const insets = useSafeAreaInsets();
    return (
        <View style={{ flex: 1 }}>
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="MainTabs" component={MainTabs} />
                    <Stack.Group screenOptions={{ presentation: 'transparentModal' }}>
                        <Stack.Screen name="PlayerModal" component={PlayerScreen} />
                    </Stack.Group>
                    <Stack.Screen
                        name="LyricsModal"
                        component={LyricsScreen}
                        options={{ presentation: 'modal' }}
                    />
                </Stack.Navigator>
                <MiniPlayer />
            </NavigationContainer>
        </View>
    );
}
