import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { colors, darkColors } from '../theme';
import { request } from '../api';
import ScreenHeader from '../components/ScreenHeader';

interface Place {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  amharicName?: string;
  description: string;
  amharicDescription?: string;
  category: string;
  address: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  hoursVerified: boolean;
  priceLevel?: number;
  rating?: number;
  images?: string[];
  distanceKm?: number;
  source?: {
    name: string;
    license?: string;
  };
}

interface Destination {
  id: string;
  name: string;
  amharicName?: string | null;
  description: string;
  heroImage?: string | null;
  placeCount: number;
  hotelCount: number;
}

interface DestinationHotel {
  id: string;
  name: string;
  address: string;
  starRating: number;
  images?: string[];
}

interface EmergencyContact {
  id: string;
  kind: string;
  name: string;
  phone: string;
  city?: string;
  source?: {
    name: string;
  };
}

type TabType = 'all' | 'heritage' | 'dining' | 'cafe' | 'attractions' | 'emergency';
type ViewMode = 'list' | 'map';

function projectPlace(place: Place, places: Place[]): { left: `${number}%`; top: `${number}%` } {
  const located = places.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  const latitudes = located.map((item) => item.lat ?? 9.0105);
  const longitudes = located.map((item) => item.lng ?? 38.7612);
  const minLat = Math.min(...latitudes, 9.0105);
  const maxLat = Math.max(...latitudes, 9.0105);
  const minLng = Math.min(...longitudes, 38.7612);
  const maxLng = Math.max(...longitudes, 38.7612);
  const latRange = Math.max(maxLat - minLat, 0.01);
  const lngRange = Math.max(maxLng - minLng, 0.01);
  const placeLat = place.lat ?? 9.0105;
  const placeLng = place.lng ?? 38.7612;
  const left = 8 + ((placeLng - minLng) / lngRange) * 84;
  const top = 8 + ((maxLat - placeLat) / latRange) * 84;
  return {
    left: `${Math.min(92, Math.max(8, left))}%`,
    top: `${Math.min(92, Math.max(8, top))}%`,
  };
}

const TABS: { id: TabType; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'all', label: 'All', icon: 'sparkles-outline' },
  { id: 'heritage', label: 'Heritage', icon: 'library-outline' },
  { id: 'dining', label: 'Dining', icon: 'restaurant-outline' },
  { id: 'cafe', label: 'Coffee', icon: 'cafe-outline' },
  { id: 'attractions', label: 'Attractions', icon: 'compass-outline' },
  { id: 'emergency', label: 'Emergency', icon: 'shield-checkmark-outline' },
];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const c = dark ? darkColors : colors;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [destinationHotels, setDestinationHotels] = useState<DestinationHotel[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  useEffect(() => {
    let active = true;
    request<Destination[]>('/discover/destinations?limit=50')
      .then((data) => { if (active) setDestinations(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setDestinations([]); });
    return () => { active = false; };
  }, []);

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      if (activeTab === 'emergency') {
        const res = await request<{ data: EmergencyContact[] }>('/discover/emergency?city=Addis%20Ababa');
        setEmergencyContacts(res?.data || []);
      } else if (selectedDestination && searchQuery.trim().length <= 1) {
        const res = await request<{ places: Place[]; hotels: DestinationHotel[] }>(
          '/discover/destinations/' + encodeURIComponent(selectedDestination.id),
        );
        const destinationPlaces = res?.places || [];
        setPlaces(
          activeTab === 'heritage'
            ? destinationPlaces.filter((place) => place.category === 'HERITAGE' || place.category === 'MUSEUM')
            : activeTab === 'dining'
            ? destinationPlaces.filter((place) => place.category === 'RESTAURANT')
            : activeTab === 'cafe'
            ? destinationPlaces.filter((place) => place.category === 'CAFE')
            : activeTab === 'attractions'
            ? destinationPlaces.filter((place) => place.category === 'ATTRACTION')
            : destinationPlaces,
        );
        setDestinationHotels(res?.hotels || []);
      } else if (searchQuery.trim().length > 1) {
        const cityQuery = selectedDestination ? '&cityId=' + encodeURIComponent(selectedDestination.id) : '';
        const res = await request<{ data: Place[] }>(
          '/discover/search?q=' + encodeURIComponent(searchQuery.trim()) + cityQuery,
        );
        setPlaces(res?.data || []);
      } else if (activeTab === 'heritage') {
        const res = await request<{ data: Place[] }>('/discover/heritage');
        setPlaces(res?.data || []);
      } else {
        const catParam =
          activeTab === 'dining'
            ? '&category=RESTAURANT'
            : activeTab === 'cafe'
            ? '&category=CAFE'
            : activeTab === 'attractions'
            ? '&category=ATTRACTION'
            : '';
        const res = await request<{ data: Place[] }>(
          `/discover/nearby?lat=9.0105&lng=38.7612&radiusKm=15${catParam}`,
        );
        setPlaces(res?.data || []);
      }
    } catch (err) {
      console.error('Failed to load discover data:', err);
      setLoadError('We could not load discovery data. Check your connection and try again.');
      setPlaces([]);
      setEmergencyContacts([]);
      setDestinationHotels([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, searchQuery, selectedDestination]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: c.paper }]}>
      <ScreenHeader title="Discover Ethiopia" subtitle={selectedDestination ? `${selectedDestination.name} · ${selectedDestination.placeCount} verified places` : "Verified destinations, guides & sights"} />

      {/* Search Input */}
      <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Ionicons name="search" size={18} color={c.inkMuted} style={styles.searchIcon} />
        <TextInput
          placeholder="Search museums, Lucy, Tomoca coffee..."
          placeholderTextColor={c.inkMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { color: c.ink }]}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={c.inkMuted} />
          </Pressable>
        )}
      </View>

      {destinations.length > 0 && (
        <View style={styles.destinationSection}>
          <View style={styles.destinationHeadingRow}>
            <Text style={[styles.destinationHeading, { color: c.ink }]}>Explore destinations</Text>
            {selectedDestination && <Pressable onPress={() => { setSelectedDestination(null); setDestinationHotels([]); }}><Text style={[styles.destinationClear, { color: c.teal }]}>All Ethiopia</Text></Pressable>}
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={destinations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.destinationList}
            renderItem={({ item }) => {
              const selected = selectedDestination?.id === item.id;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${item.name}`} onPress={() => { setSelectedDestination(item); setActiveTab('all'); setSearchQuery(''); setViewMode('list'); }} style={[styles.destinationCard, { backgroundColor: c.surface, borderColor: selected ? c.gold : c.line }]}>
                  <Image source={{ uri: item.heroImage || 'https://images.unsplash.com/photo-1548013146-72479768bada?w=600' }} style={styles.destinationImage} contentFit="cover" />
                  <View style={styles.destinationOverlay} />
                  <View style={styles.destinationCopy}><Text style={styles.destinationName}>{item.name}</Text><Text style={styles.destinationMeta}>{item.hotelCount} hotels · {item.placeCount} places</Text></View>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {selectedDestination && destinationHotels.length > 0 && activeTab !== 'emergency' && searchQuery.length === 0 && (
        <View style={styles.hotelStrip}>
          <Text style={[styles.destinationHeading, { color: c.ink }]}>Hotels in {selectedDestination.name}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotelList}>
            {destinationHotels.slice(0, 8).map((hotel) => (
              <Pressable key={hotel.id} onPress={() => navigation.navigate('HotelDetail', { hotelId: hotel.id })} style={[styles.hotelChip, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Image source={{ uri: hotel.images?.[0] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600' }} style={styles.hotelChipImage} contentFit="cover" />
                <View style={styles.hotelChipCopy}><Text style={[styles.hotelChipName, { color: c.ink }]} numberOfLines={1}>{hotel.name}</Text><Text style={[styles.hotelChipMeta, { color: c.inkMuted }]} numberOfLines={1}>{'★'.repeat(Math.max(1, hotel.starRating))} · {hotel.address}</Text></View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Category Filter Chips */}
      <View style={styles.tabContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tabList}
          renderItem={({ item }) => {
            const isSelected = activeTab === item.id;
            return (
              <Pressable
                onPress={() => {
                  setActiveTab(item.id);
                  setSearchQuery('');
                }}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isSelected ? c.teal : c.surface,
                    borderColor: isSelected ? c.teal : c.line,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={isSelected ? '#FFF' : c.inkMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isSelected ? '#FFF' : c.ink, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {activeTab !== 'emergency' && (
        <View style={styles.viewToggleRow}>
          <Text style={[styles.viewHint, { color: c.inkMuted }]}>
            {viewMode === 'map' ? 'Select a marker to preview a place.' : 'Browse the verified list or compare places on the map.'}
          </Text>
          <View style={[styles.viewToggle, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === 'list' }}
              onPress={() => setViewMode('list')}
              style={[styles.viewToggleButton, viewMode === 'list' && { backgroundColor: c.teal }]}
            >
              <Ionicons name="list-outline" size={15} color={viewMode === 'list' ? '#FFF' : c.inkMuted} />
              <Text style={[styles.viewToggleText, { color: viewMode === 'list' ? '#FFF' : c.ink }]}>List</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === 'map' }}
              onPress={() => setViewMode('map')}
              style={[styles.viewToggleButton, viewMode === 'map' && { backgroundColor: c.teal }]}
            >
              <Ionicons name="map-outline" size={15} color={viewMode === 'map' ? '#FFF' : c.inkMuted} />
              <Text style={[styles.viewToggleText, { color: viewMode === 'map' ? '#FFF' : c.ink }]}>Map</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Loading Indicator */}
      {loading && !refreshing && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={c.teal} />
          <Text style={[styles.loadingText, { color: c.inkMuted }]}>
            Loading authoritative guide data...
          </Text>
        </View>
      )}

      {/* Content List */}
      {!loading && loadError && (
        <View style={[styles.centerBox, { paddingHorizontal: 24 }]}>
          <Ionicons name="cloud-offline-outline" size={44} color={c.inkMuted} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>Discovery is unavailable</Text>
          <Text style={[styles.emptySubtitle, { color: c.inkMuted }]}>{loadError}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={fetchData}
            style={[styles.retryButton, { backgroundColor: c.teal }]}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !loadError && activeTab === 'emergency' && (
        <FlatList
          data={emergencyContacts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.contentList}
          ListHeaderComponent={
            <View style={[styles.alertBanner, { backgroundColor: dark ? '#331B05' : '#FEF3C7', borderColor: '#F59E0B' }]}>
              <Ionicons name="alert-circle" size={20} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={[styles.alertText, { color: dark ? '#FDE68A' : '#92400E' }]}>
                Official safety numbers verified against government records (TRIP-010 / TRIP-011).
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.badgePill, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.badgeText, { color: '#B91C1C' }]}>{item.kind}</Text>
                </View>
                <Text style={[styles.subText, { color: c.inkMuted }]}>{item.city || 'National'}</Text>
              </View>
              <Text style={[styles.cardTitle, { color: c.ink }]}>{item.name}</Text>
              <Text style={[styles.sourceText, { color: c.inkMuted }]}>
                Verified by: {item.source?.name || 'City Administration Board'}
              </Text>

              <Pressable
                onPress={() => handleCall(item.phone)}
                style={[styles.callBtn, { backgroundColor: '#DC2626' }]}
              >
                <Ionicons name="call" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.callBtnText}>Call {item.phone}</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {!loading && !loadError && activeTab !== 'emergency' && viewMode === 'map' && places.length === 0 && (
        <View style={[styles.emptyMap, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Ionicons name="map-outline" size={42} color={c.inkMuted} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>No locations found</Text>
          <Text style={[styles.emptySubtitle, { color: c.inkMuted }]}>
            Try selecting a different category or clearing search filters.
          </Text>
        </View>
      )}

      {!loading && !loadError && activeTab !== 'emergency' && viewMode === 'map' && places.length > 0 && (
        <View style={[styles.mapPanel, { backgroundColor: dark ? '#18313A' : '#DCE9E5', borderColor: c.line }]}>
          <View style={styles.mapCanvas} accessible accessibilityLabel="Map of verified places">
            <View style={styles.mapGridA} />
            <View style={styles.mapGridB} />
            <View style={[styles.mapLabel, { backgroundColor: dark ? 'rgba(15,41,66,0.9)' : 'rgba(255,255,255,0.9)' }]}>
              <Text style={[styles.mapLabelText, { color: dark ? '#FFF' : c.ink }]}>ADDIS ABABA</Text>
            </View>
            <View style={[styles.mapLegend, { backgroundColor: dark ? 'rgba(15,41,66,0.9)' : 'rgba(255,255,255,0.9)' }]}>
              <Text style={[styles.mapLegendText, { color: c.inkMuted }]}>Verified locations · approximate</Text>
            </View>
            {places.map((place) => {
              const active = selectedPlaceId === place.id;
              const position = projectPlace(place, places);
              return (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${place.name}`}
                  onPress={() => setSelectedPlaceId(place.id)}
                  style={[
                    styles.mapMarker,
                    { left: position.left, top: position.top, backgroundColor: active ? c.teal : c.gold },
                    active && styles.mapMarkerActive,
                  ]}
                >
                  <Ionicons name="location" size={17} color={active ? '#FFF' : c.ink} />
                </Pressable>
              );
            })}
          </View>
          {selectedPlace && (
            <View style={[styles.selectedPlaceCard, { backgroundColor: c.surface, borderTopColor: c.line }]}>
              <View style={styles.selectedPlaceCopy}>
                <Text style={[styles.selectedPlaceEyebrow, { color: c.gold }]}>Selected place</Text>
                <Text style={[styles.selectedPlaceTitle, { color: c.ink }]} numberOfLines={1}>{selectedPlace.name}</Text>
                <Text style={[styles.selectedPlaceAddress, { color: c.inkMuted }]} numberOfLines={1}>{selectedPlace.address}</Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('DiscoverPlaceDetails', { placeId: selectedPlace.id })}
                style={[styles.selectedPlaceButton, { backgroundColor: c.teal }]}
              >
                <Text style={styles.selectedPlaceButtonText}>Details</Text>
                <Ionicons name="chevron-forward" size={15} color="#FFF" />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {!loading && !loadError && activeTab !== 'emergency' && viewMode === 'list' && (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.contentList}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="compass-outline" size={48} color={c.inkMuted} />
              <Text style={[styles.emptyTitle, { color: c.ink }]}>No locations found</Text>
              <Text style={[styles.emptySubtitle, { color: c.inkMuted }]}>
                Try selecting a different category or clearing search filters.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const imageUri =
              item.images && item.images.length > 0
                ? item.images[0]
                : 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800';

            return (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.cardImage} contentFit="cover" />
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                  {item.distanceKm !== undefined && (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>
                        📍 {item.distanceKm} km
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: c.ink }]}>{item.name}</Text>
                  {item.amharicName && (
                    <Text style={[styles.amharicTitle, { color: c.teal }]}>{item.amharicName}</Text>
                  )}
                  <Text style={[styles.cardDesc, { color: c.inkMuted }]} numberOfLines={3}>
                    {item.description}
                  </Text>

                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={14} color={c.inkMuted} />
                    <Text style={[styles.infoText, { color: c.inkMuted }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>

                  {item.openingHours && (
                    <View style={styles.infoRow}>
                      <Ionicons name="time-outline" size={14} color={c.inkMuted} />
                      <Text style={[styles.infoText, { color: c.inkMuted }]} numberOfLines={1}>
                        {item.openingHours}
                      </Text>
                      <View
                        style={[
                          styles.hoursBadge,
                          { backgroundColor: item.hoursVerified ? '#DEF7EC' : '#FEF3C7' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.hoursText,
                            { color: item.hoursVerified ? '#03543F' : '#92400E' },
                          ]}
                        >
                          {item.hoursVerified ? 'Verified' : 'Hours may vary'}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={[styles.cardFooter, { borderTopColor: c.line }]}>
                    <Text style={[styles.sourceText, { color: c.inkMuted }]} numberOfLines={1}>
                      Source: {item.source?.name || 'Verified Tourism Records'}
                    </Text>
                    <Pressable onPress={() => navigation.navigate('DiscoverPlaceDetails', { placeId: item.id })} hitSlop={6}>
                      <Text style={[styles.detailsText, { color: c.teal }]}>Details</Text>
                    </Pressable>
                    {item.phone && (
                      <Pressable onPress={() => handleCall(item.phone!)} hitSlop={6}>
                        <View style={styles.miniCall}>
                          <Ionicons name="call-outline" size={13} color={c.teal} />
                          <Text style={[styles.miniCallText, { color: c.teal }]}>Call</Text>
                        </View>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  destinationSection: { marginTop: 10 },
  destinationHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 7 },
  destinationHeading: { fontSize: 14, fontWeight: '800' },
  destinationClear: { fontSize: 11, fontWeight: '700' },
  destinationList: { paddingHorizontal: 16, gap: 10 },
  destinationCard: { width: 152, height: 92, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  destinationImage: { ...StyleSheet.absoluteFillObject },
  destinationOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,41,66,0.48)' },
  destinationCopy: { position: 'absolute', left: 10, right: 8, bottom: 9 },
  destinationName: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  destinationMeta: { color: 'rgba(255,255,255,0.82)', fontSize: 9, marginTop: 2 },
  hotelStrip: { marginTop: 12 },
  hotelList: { paddingHorizontal: 16, gap: 10, paddingTop: 7 },
  hotelChip: { width: 235, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 7, gap: 8 },
  hotelChipImage: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#E2E8F0' },
  hotelChipCopy: { flex: 1, minWidth: 0 },
  hotelChipName: { fontSize: 12, fontWeight: '800' },
  hotelChipMeta: { fontSize: 9, marginTop: 3 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 13 },
  tabContainer: { marginVertical: 10 },
  tabList: { paddingHorizontal: 16, gap: 8 },
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  viewHint: { flex: 1, fontSize: 11, lineHeight: 16 },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
  },
  viewToggleText: { fontSize: 11, fontWeight: '700' },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  tabLabel: { fontSize: 12 },
  contentList: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  emptyMap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 24,
    minHeight: 220,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
  },
  mapPanel: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapCanvas: {
    height: 360,
    position: 'relative',
    overflow: 'hidden',
  },
  mapGridA: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
    backgroundColor: '#B8D2C7',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.8)',
    transform: [{ rotate: '8deg' }, { scale: 1.25 }],
  },
  mapGridB: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: 170,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    transform: [{ rotate: '-20deg' }],
  },
  mapLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  mapLabelText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  mapLegend: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  mapLegendText: { fontSize: 9 },
  mapMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#0F2942',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapMarkerActive: {
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
  },
  selectedPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  selectedPlaceCopy: { flex: 1, minWidth: 0 },
  selectedPlaceEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  selectedPlaceTitle: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  selectedPlaceAddress: { fontSize: 11, marginTop: 2 },
  selectedPlaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  selectedPlaceButtonText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 13 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  retryButton: { marginTop: 16, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  alertText: { flex: 1, fontSize: 12, lineHeight: 17 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 0,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  subText: { fontSize: 11 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  callBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  imageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  cardImage: { width: '100%', height: '100%' },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  distanceBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: { color: '#0F2942', fontSize: 11, fontWeight: '700' },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  amharicTitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardDesc: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  infoText: { flex: 1, fontSize: 11 },
  hoursBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hoursText: { fontSize: 9, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 10,
  },
  sourceText: { fontSize: 10, flex: 1 },
  miniCall: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniCallText: { fontSize: 11, fontWeight: '700' },
  detailsText: { fontSize: 11, fontWeight: '700' },
});
