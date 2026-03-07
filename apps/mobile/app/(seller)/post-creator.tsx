import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../constants/theme';
import { api } from '../../lib/api';

const TEMPLATES = [
  { id: 'announcement', label: 'Announcement', icon: 'megaphone' as const },
  { id: 'flash_sale', label: 'Flash Sale', icon: 'flash' as const },
  { id: 'seasonal', label: 'Seasonal', icon: 'leaf' as const },
  { id: 'social_proof', label: 'Social Proof', icon: 'star' as const },
  { id: 'restock', label: 'Restock Alert', icon: 'refresh' as const },
];

const POST_TYPES = [
  { id: 'feed', label: 'Feed Post' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'story', label: 'Story' },
  { id: 'reel', label: 'Reel' },
];

export default function PostCreatorScreen() {
  const [template, setTemplate] = useState('announcement');
  const [postType, setPostType] = useState('feed');
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: postType === 'carousel',
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const generateCaption = async () => {
    setGeneratingCaption(true);
    try {
      const res = await api.post('/api/posts/generate-caption', {
        template,
        product_names: [],
      });
      if (res.caption) {
        setCaption(res.caption);
      }
    } catch {
      Alert.alert('Error', 'Failed to generate caption');
    }
    setGeneratingCaption(false);
  };

  const createPost = async () => {
    if (!caption.trim() && images.length === 0) {
      Alert.alert('Add content', 'Please add a caption or images');
      return;
    }

    const res = await api.post('/api/posts', {
      template,
      post_type: postType,
      caption,
      image_urls: images,
    });

    if (res.error) {
      Alert.alert('Error', res.error);
      return;
    }

    Alert.alert('Post created!', 'Your post has been saved as a draft.', [
      { text: 'OK', onPress: () => {
        setCaption('');
        setImages([]);
      }},
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Create Post</Text>

      {/* Template selection */}
      <Text style={styles.label}>Template</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
        {TEMPLATES.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.templateCard, template === t.id && styles.templateActive]}
            onPress={() => setTemplate(t.id)}
          >
            <Ionicons
              name={t.icon}
              size={24}
              color={template === t.id ? colors.white : colors.ink}
            />
            <Text style={[styles.templateLabel, template === t.id && styles.templateLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Post type */}
      <Text style={styles.label}>Post Type</Text>
      <View style={styles.chipRow}>
        {POST_TYPES.map((pt) => (
          <TouchableOpacity
            key={pt.id}
            style={[styles.chip, postType === pt.id && styles.chipActive]}
            onPress={() => setPostType(pt.id)}
          >
            <Text style={[styles.chipText, postType === pt.id && styles.chipTextActive]}>
              {pt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Images */}
      <Text style={styles.label}>Images</Text>
      <View style={styles.imageRow}>
        {images.map((uri, i) => (
          <View key={i} style={styles.imageWrap}>
            <Image source={{ uri }} style={styles.image} />
            <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(i)}>
              <Ionicons name="close-circle" size={24} color={colors.rose.DEFAULT} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addImage} onPress={pickImage}>
          <Ionicons name="camera" size={28} color={colors.warmGray} />
          <Text style={styles.addImageText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      <View style={styles.captionHeader}>
        <Text style={styles.label}>Caption</Text>
        <TouchableOpacity style={styles.aiBtn} onPress={generateCaption} disabled={generatingCaption}>
          {generatingCaption ? (
            <ActivityIndicator size="small" color={colors.purple.DEFAULT} />
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color={colors.purple.DEFAULT} />
              <Text style={styles.aiBtnText}>AI Generate</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.captionInput}
        value={caption}
        onChangeText={setCaption}
        placeholder="Write your caption..."
        placeholderTextColor={colors.warmGray}
        multiline
      />

      {/* Create button */}
      <TouchableOpacity style={styles.createBtn} onPress={createPost}>
        <Text style={styles.createBtnText}>Save Post</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: spacing.lg, paddingTop: 60, paddingBottom: spacing.xxl },
  title: { fontSize: 28, fontFamily: fonts.displayBold, color: colors.ink, marginBottom: spacing.lg },
  label: { fontSize: 14, fontFamily: fonts.semibold, color: colors.ink, marginBottom: spacing.sm, marginTop: spacing.md },
  templateScroll: { marginBottom: spacing.sm },
  templateCard: {
    width: 100,
    height: 80,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  templateLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.ink, marginTop: 4 },
  templateLabelActive: { color: colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 14, fontFamily: fonts.medium, color: colors.warmGray },
  chipTextActive: { color: colors.white },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  imageWrap: { position: 'relative' },
  image: { width: 80, height: 80, borderRadius: borderRadius.md },
  removeImage: { position: 'absolute', top: -8, right: -8 },
  addImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: { fontSize: 12, fontFamily: fonts.medium, color: colors.warmGray, marginTop: 2 },
  captionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full, backgroundColor: colors.purple.light },
  aiBtnText: { fontSize: 13, fontFamily: fonts.medium, color: colors.purple.DEFAULT },
  captionInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    height: 140,
    textAlignVertical: 'top',
  },
  createBtn: {
    backgroundColor: colors.ink,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
    minHeight: 48,
  },
  createBtnText: { fontSize: 18, fontFamily: fonts.semibold, color: colors.white },
});
