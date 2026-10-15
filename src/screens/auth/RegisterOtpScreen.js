import { useEffect, useState } from 'react';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import useCountdown from '../../hooks/useCountdown';
import { requestRegisterOtp, verifyRegisterOtp } from '../../api/authApi';
import { getErrorMessage } from '../../api/errors';
import { validateOtp } from '../../utils/validators';
import { showDevOtp } from '../../utils/devOtp';

const RESEND_SECONDS = 60;

export default function RegisterOtpScreen({ navigation, route }) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, startCountdown] = useCountdown(RESEND_SECONDS);

  useEffect(() => startCountdown(RESEND_SECONDS), [startCountdown]);

  const onVerify = async () => {
    const error = validateOtp(code);
    setCodeError(error);
    setFormError('');
    if (error) return;

    setLoading(true);
    try {
      const { registrationToken } = await verifyRegisterOtp(email, code.trim());
      navigation.navigate('RegisterPassword', { registrationToken });
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
      const response = await requestRegisterOtp(email);
      showDevOtp(response);
      setCode('');
      startCountdown(RESEND_SECONDS);
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <FormScreen title="Verificá tu email" subtitle={`Paso 2 de 3: ingresá el código de 6 dígitos que enviamos a ${email}.`} error={formError}>
      <Input
        label="Código"
        value={code}
        onChangeText={setCode}
        error={codeError}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123456"
      />
      <Button title="Verificar" onPress={onVerify} loading={loading} />
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
