import { Alert } from 'react-native';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import usePasswordReset from '../../hooks/usePasswordReset';

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
      <FormScreen title="Recuperar contraseña" subtitle="Ingresá tu email y te enviamos un código." error={formError}>
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
        <Button title="Enviar código" onPress={onRequestCode} loading={loading} />
      </FormScreen>
    );
  }

  return (
    <FormScreen title="Nueva contraseña" subtitle={`Ingresá el código que enviamos a ${email} y elegí tu nueva contraseña.`} error={formError}>
      <Input label="Código" value={code} onChangeText={setCode} error={errors.code} keyboardType="number-pad" maxLength={6} placeholder="123456" />
      <Input label="Nueva contraseña" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoCapitalize="none" />
      <Input label="Repetir contraseña" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" />
      <Button title="Cambiar contraseña" onPress={onReset} loading={loading} />
      <Button
        variant="link"
        title={seconds > 0 ? `Reenviar código (${seconds}s)` : 'Reenviar código'}
        onPress={onResend}
        disabled={seconds > 0}
        loading={resending}
      />
    </FormScreen>
  );
}
