import { useState } from 'react';
import { Alert } from 'react-native';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import useCountdown from '../../hooks/useCountdown';
import { requestPasswordOtp, resendPasswordOtp, resetPassword } from '../../api/authApi';
import { getErrorMessage } from '../../api/errors';
import { validateEmail, validateOtp, validatePassword, validateConfirm } from '../../utils/validators';
import { showDevOtp } from '../../utils/devOtp';

const RESEND_SECONDS = 60;

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, startCountdown] = useCountdown(0);

  const onRequestCode = async () => {
    const error = validateEmail(email);
    setErrors({ email: error });
    setFormError('');
    if (error) return;

    setLoading(true);
    try {
      showDevOtp(await requestPasswordOtp(email.trim()));
      startCountdown(RESEND_SECONDS);
      setStep('reset');
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    setFormError('');
    try {
      showDevOtp(await resendPasswordOtp(email.trim()));
      setCode('');
      startCountdown(RESEND_SECONDS);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const onReset = async () => {
    const next = {
      code: validateOtp(code),
      password: validatePassword(password),
      confirm: validateConfirm(password, confirm),
    };
    setErrors(next);
    setFormError('');
    if (next.code || next.password || next.confirm) return;

    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      Alert.alert('Listo', 'Tu contraseña fue actualizada. Ya podés ingresar.');
      navigation.navigate('Login');
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

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
