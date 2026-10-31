import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../services/errors';
import { validateEmail } from '../../utils/validators';
import { colors, spacing, typography } from '../../constants/theme';

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
      {/* Sin encabezado azul: se reserva la zona de la barra de estado y la marca hace de título. */}
      <View style={{ height: insets.top }} />
      <Text accessibilityRole="header" style={styles.brand}>
        Hallado
      </Text>
      <Text style={styles.subtitle}>Ingresá a tu cuenta</Text>
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
  brand: { ...typography.display, color: colors.blue600, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textDim, marginBottom: spacing.lg },
  tight: { paddingHorizontal: spacing.sm },
  banner: { marginBottom: spacing.md },
  // Pegado al campo de contraseña: compensa el espacio de 24 dp que deja el campo.
  forgot: { alignSelf: 'flex-start', marginTop: -(spacing.formGap - spacing.xs) },
});
