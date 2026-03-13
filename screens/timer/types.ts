import type { TextStyle } from 'react-native';

export interface ContextFormatType {
  value: string | number | undefined;
  color?: TextStyle['color'];
}
