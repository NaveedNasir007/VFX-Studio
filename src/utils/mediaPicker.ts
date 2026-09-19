import * as ImagePicker from 'expo-image-picker';

export const pickMedia = async (multiple = true) => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Sorry, we need camera roll permissions to make this work!');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: multiple,
    quality: 1,
    videoExportPreset: ImagePicker.VideoExportPreset.Passthrough
  });

  if (!result.canceled) {
    return result.assets;
  }
  return null;
};
