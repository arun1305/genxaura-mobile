import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants';

const TENOR_API_KEY = process.env.EXPO_PUBLIC_TENOR_API_KEY || '';
const TENOR_BASE = 'https://tenor.googleapis.com/v2';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GIF_SIZE = (SCREEN_WIDTH - 48 - 8) / 2;

interface GifResult {
  id: string;
  previewUrl: string;
  url: string;
  title: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function GifPickerModal({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (searchQuery: string) => {
    if (!TENOR_API_KEY) return;
    setLoading(true);
    try {
      const endpoint = searchQuery.trim()
        ? `${TENOR_BASE}/search?q=${encodeURIComponent(searchQuery)}&key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`
        : `${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`;

      const res = await fetch(endpoint);
      const json = await res.json();
      const gifs: GifResult[] = (json.results || []).map((item: any) => ({
        id: item.id,
        previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || '',
        url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || '',
        title: item.title || '',
      }));
      setResults(gifs);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchGifs('');
  }, [visible]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => fetchGifs(text), 500);
    setDebounceTimer(timer);
  };

  const handleSelect = (gif: GifResult) => {
    onSelect(gif.url);
    onClose();
    setQuery('');
  };

  const handleClose = () => {
    onClose();
    setQuery('');
  };

  if (!TENOR_API_KEY) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>GIFs</Text>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search GIFs..."
            placeholderTextColor={COLORS.textMuted}
            autoCorrect={false}
          />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No GIFs found</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.8}
                style={styles.gifCell}
              >
                <Image
                  source={{ uri: item.previewUrl }}
                  style={styles.gif}
                  contentFit="cover"
                />
              </TouchableOpacity>
            )}
          />
        )}

        <Text style={styles.poweredBy}>Powered by Tenor</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: { width: 36, alignItems: 'center' },
  closeIcon: { fontSize: 18, color: COLORS.text },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: COLORS.textMuted, fontSize: 15 },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    gap: 8,
    marginBottom: 8,
  },
  gifCell: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  gif: {
    width: GIF_SIZE,
    height: GIF_SIZE,
  },
  poweredBy: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textMuted,
    paddingBottom: 20,
  },
});
