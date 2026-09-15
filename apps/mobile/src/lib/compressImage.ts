import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1024;
const QUALITY = 0.7;

export async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION, height: MAX_DIMENSION } }],
    { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export async function compressImages(uris: string[]): Promise<string[]> {
  return Promise.all(uris.map(compressImage));
}
