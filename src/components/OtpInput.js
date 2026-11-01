import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import Icon from './Icon';

const LENGTH = 6;

// Texto de espera para el reenvío de códigos: 42 -> "0:42".
export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Código de 6 dígitos como 6 casilleros de hasta 56 dp. Es solo presentación: hay UN solo TextInput real
// (transparente, encima de los casilleros) que conserva el valor, el teclado numérico y maxLength 6.
// value / onChangeText: el mismo código de texto que usa el hook. error: mensaje bajo los casilleros.
// Con foco, el casillero activo lleva borde 2 dp blue600; con error, borde 2 dp danger.
export default function OtpInput({ label = 'Código', value = '', onChangeText, error, ...props }) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, LENGTH - 1);
  // Un solo texto accesible para todo el control (con el error incluido).
  const a11yLabel = error ? `${label} de ${LENGTH} dígitos. ${error}` : `${label} de ${LENGTH} dígitos`;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
        <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length: LENGTH }, (_, i) => {
            const isActive = focused && i === active;
            const thick = error || isActive;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  { borderWidth: thick ? 2 : 1, borderColor: error ? colors.danger : isActive ? colors.blue600 : colors.border },
                ]}
              >
                <Text style={styles.digit}>{value[i] || ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          maxLength={LENGTH}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          caretHidden
          accessibilityLabel={a11yLabel}
          style={styles.hidden}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            if (props.onFocus) props.onFocus(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            if (props.onBlur) props.onBlur(e);
          }}
        />
      </Pressable>
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="warning" size={20} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.formGap },
  label: { ...typography.caption, marginBottom: spacing.xs, color: colors.textDim },
  row: { flexDirection: 'row', gap: spacing.sm },
  box: {
    flex: 1,
    maxWidth: 56,
    height: 56,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  digit: { ...typography.display, color: colors.text },
  // Cubre los casilleros: recibe el toque y el teclado, pero no se ve.
  hidden: { ...StyleSheet.absoluteFillObject, opacity: 0, color: 'transparent' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  error: { ...typography.body, flex: 1, color: colors.danger },
});
