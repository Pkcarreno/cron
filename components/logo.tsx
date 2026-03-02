import { Image } from 'expo-image';
import AppLogo from '@/assets/logo.svg';

interface Props {
  size?: number;
}

export const Logo: React.FC<Props> = ({ size = 24 }) => (
  <Image source={AppLogo} style={{ height: size, width: size }} />
);
