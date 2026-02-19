import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/helpers/colors';
import { Link } from 'expo-router';

export default function TimerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Este es el timer</Text>
      <Link href=".." style={styles.link}>
        volver a home
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
