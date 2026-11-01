import { Alert, StyleSheet } from 'react-native';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import OtpInput, { formatCountdown } from '../../components/OtpInput';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import usePasswordReset from '../../hooks/usePasswordReset';
import { spacing } from '../../constants/theme';

export default function ForgotPasswordScreen({ navigation }) {
  const {
    step, email, setEmail, code, setCode, password, setPassword, confirm, setConfirm,
    errors, formError, loading, resending, seconds,
    onRequestCode, onResend, onReset,
  } = usePasswordReset({
    onDone: () => {
      Alert.alert('Listo', 'Tu contraseña fue actualizada. Ya podés ingresar.');
      navigation.navigate('Login');
    },
  });

  if (step === 'email') {
    return (
      <FormScreen
        title="Recuperar contraseña"
        subtitle="Ingresá tu email y te enviamos un código."
        footer={
          <BottomActionBar>
            <Button title="Enviar código" loadingTitle="Enviando…" onPress={onRequestCode} loading={loading} />
          </BottomActionBar>
        }
      >
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
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Nueva contraseña"
      subtitle={`Ingresá el código que enviamos a ${email} y elegí tu nueva contraseña.`}
      footer={
        <BottomActionBar>
          <Button title="Cambiar contraseña" onPress={onReset} loading={loading} />
        </BottomActionBar>
      }
    >
      {formError ? <Banner kind="warn" message={formError} style={styles.banner} /> : null}
      <OtpInput value={code} onChangeText={setCode} error={errors.code} />
      <Button
        variant="link"
        title={seconds > 0 ? `Podés pedir otro en ${formatCountdown(seconds)}` : 'Reenviar código'}
        onPress={onResend}
        disabled={seconds > 0}
        loading={resending}
        style={styles.resend}
      />
      <Input label="Nueva contraseña" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoCapitalize="none" />
      <Input label="Repetir contraseña" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: spacing.md },
  resend: { alignSelf: 'flex-start', marginTop: -spacing.sm, marginBottom: spacing.md },
});
