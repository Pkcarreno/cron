import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/helpers/colors';
import { Link } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Estas en el index</Text>
      <Link href="/timer" style={styles.link}>
        Ir al timer
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  link: {
    backgroundColor: colors.neutral[400],
    borderRadius: 10,
    color: colors.black,
    fontFamily: 'Geist',
    fontWeight: '400',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    color: colors.neutral[400],
    fontFamily: 'Geist',
    fontWeight: '400',
  },
});
