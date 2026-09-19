import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Export: { projectId: string };
  Home: undefined;
  Editor: { projectId: string };
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type EditorScreenProps = NativeStackScreenProps<RootStackParamList, 'Editor'>;
