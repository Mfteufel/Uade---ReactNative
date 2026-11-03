import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../services/errors';
import { validateEmail } from '../../utils/validators';
import { colors, radius, spacing, typography } from '../../constants/theme';

const LOGO = require('../../../assets/logo.png');

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const next = { email: validateEmail(email), password: password ? '' : 'Ingresá tu contraseña.' };
    setErrors(next);
    setFormError('');
    if (next.email || next.password) return;

    setLoading(true);
    try {
      await login(email, password); // al iniciar sesión el navegador cambia solo
    } catch (e) {
      setFormError(getErrorMessage(e));
      setLoading(false);
    }
  };

  return (
    <FormScreen
      footer={
        <BottomActionBar>
          <Button variant="secondary" title="Crear una cuenta" style={styles.tight} onPress={() => navigation.navigate('RegisterEmail')} />
          <Button title="Entrar" loadingTitle="Entrando…" onPress={onSubmit} loading={loading} />
        </BottomActionBar>
      }
    >
      {/* Sin encabezado azul: se reserva la zona de la barra de estado; el logo y la marca hacen de título. */}
      <View style={{ height: insets.top }} />
      <View style={styles.brandBox}>
        {/* Bicolor: la palabra entera en naranja y, encima, la misma en azul recortada a la mitad de arriba. */}
        <View style={styles.wordmark} accessible accessibilityRole="header" accessibilityLabel="Hallado">
          <Text style={[styles.brand, styles.brandBottom]}>HALLADO</Text>
          <View style={styles.brandTopHalf} importantForAccessibility="no-hide-descendants">
            <Text style={[styles.brand, styles.brandTop]}>HALLADO</Text>
          </View>
        </View>
        <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
      </View>
      <Text style={styles.title}>Inicio de sesión</Text>
      {formError ? <Banner kind="warn" message={formError} style={styles.banner} /> : null}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="tu@email.com"
      />
      <Input
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        placeholder="Tu contraseña"
      />
      <Button
        variant="link"
        title="Olvidé mi contraseña"
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgot}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  brandBox: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  wordmark: { marginBottom: spacing.md },
  // Peso 500 como el resto del diseño: el tamaño y el espaciado entre letras lo hacen logotipo.
  brand: { fontSize: 40, lineHeight: 48, fontWeight: '500', letterSpacing: 4 },
  brandBottom: { color: colors.accent700 },
  brandTop: { color: colors.blue600 },
  brandTopHalf: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', overflow: 'hidden' },
  logo: { width: 176, height: 176, borderRadius: radius.card * 3 },
  title: { ...typography.section, color: colors.text, marginBottom: spacing.md },
  tight: { paddingHorizontal: spacing.sm },
  banner: { marginBottom: spacing.md },
  // Pegado al campo de contraseña: compensa el espacio de 24 dp que deja el campo.
  forgot: { alignSelf: 'flex-start', marginTop: -(spacing.formGap - spacing.xs) },
});
