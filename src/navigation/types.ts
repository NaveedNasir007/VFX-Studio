import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Editor: { projectId: string };
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type EditorScreenProps = NativeStackScreenProps<RootStackParamList, 'Editor'>;
