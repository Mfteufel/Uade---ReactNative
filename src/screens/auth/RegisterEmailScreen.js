import { useState } from 'react';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { requestRegisterOtp } from '../../api/authApi';
import { getErrorMessage } from '../../api/errors';
import { validateEmail } from '../../utils/validators';
import { showDevOtp } from '../../utils/devOtp';

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
    <FormScreen title="Crear cuenta" subtitle="Paso 1 de 3: ingresá tu email. Te enviamos un código." error={formError}>
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
      <Button title="Enviar código" onPress={onSubmit} loading={loading} />
    </FormScreen>
  );
}
