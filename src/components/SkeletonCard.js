import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

// Esqueleto de ResultCard en neutral200. Pulso de 1,4 s; con «reducir animaciones» queda con opacidad fija.
// count: cantidad de tarjetas (máximo 3, mínimo 1).
export default function SkeletonCard({ count = 3 }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(Boolean(v)))
      .catch(() => alive && setReduceMotion(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  const n = Math.min(3, Math.max(1, Math.floor(count)));
  const items = Array.from({ length: n }, (_, i) => i);

  return (
    <View accessible accessibilityLabel="Cargando resultados" accessibilityRole="progressbar">
      {items.map((i) => (
        <Animated.View key={i} style={[styles.card, { opacity }]} importantForAccessibility="no-hide-descendants">
          <View style={styles.thumb} />
          <View style={styles.body}>
            <View style={[styles.line, styles.lineLong]} />
            <View style={[styles.line, styles.lineMid]} />
            <View style={[styles.line, styles.lineShort]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    minHeight: 112,
    padding: spacing.cardTight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.bg,
    marginBottom: spacing.ms,
  },
  thumb: { width: 88, height: 88, borderRadius: radius.thumb, backgroundColor: colors.neutral200 },
  body: { flex: 1, marginLeft: spacing.ms, justifyContent: 'center' },
  line: { height: 14, borderRadius: radius.tag, backgroundColor: colors.neutral200, marginVertical: spacing.xs },
  lineLong: { width: '90%' },
  lineMid: { width: '65%' },
  lineShort: { width: '40%' },
});
