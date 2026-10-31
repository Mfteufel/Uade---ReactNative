import { useState } from 'react';
import { StyleSheet } from 'react-native';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import { requestRegisterOtp } from '../../services/authApi';
import { getErrorMessage } from '../../services/errors';
import { validateEmail } from '../../utils/validators';
import { showDevOtp } from '../../utils/devOtp';
import { spacing } from '../../constants/theme';

export default function RegisterEmailScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const error = validateEmail(email);
    setEmailError(error);
    setFormError('');
    if (error) return;

    setLoading(true);
    try {
      const response = await requestRegisterOtp(email.trim());
      showDevOtp(response);
      navigation.navigate('RegisterOtp', { email: email.trim() });
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreen
      title="Crear cuenta"
      subtitle="Paso 1 de 3: ingresá tu email. Te enviamos un código."
      footer={
        <BottomActionBar>
          <Button title="Enviar código" loadingTitle="Enviando…" onPress={onSubmit} loading={loading} />
        </BottomActionBar>
      }
    >
      {formError ? <Banner kind="warn" message={formError} style={styles.banner} /> : null}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="tu@email.com"
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: spacing.md },
});
