import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import FormScreen from '../../components/FormScreen';
import OtpInput, { formatCountdown } from '../../components/OtpInput';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import useCountdown from '../../hooks/useCountdown';
import { requestRegisterOtp, verifyRegisterOtp } from '../../services/authApi';
import { getErrorMessage } from '../../services/errors';
import { validateOtp } from '../../utils/validators';
import { showDevOtp } from '../../utils/devOtp';
import { spacing } from '../../constants/theme';

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
    <FormScreen
      title="Verificá tu email"
      subtitle={`Paso 2 de 3: ingresá el código de 6 dígitos que enviamos a ${email}.`}
      footer={
        <BottomActionBar>
          <Button title="Confirmar" onPress={onVerify} loading={loading} disabled={code.length < 6} />
        </BottomActionBar>
      }
    >
      {formError ? <Banner kind="warn" message={formError} style={styles.banner} /> : null}
      <OtpInput value={code} onChangeText={setCode} error={codeError} />
      <Button
        variant="link"
        title={seconds > 0 ? `Podés pedir otro en ${formatCountdown(seconds)}` : 'Reenviar código'}
        onPress={onResend}
        disabled={seconds > 0}
        loading={resending}
        style={styles.resend}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: spacing.md },
  resend: { alignSelf: 'flex-start', marginTop: -spacing.sm },
});
