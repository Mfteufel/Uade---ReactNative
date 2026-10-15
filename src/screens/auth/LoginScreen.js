import { useState } from 'react';
import { View } from 'react-native';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../api/errors';
import { validateEmail } from '../../utils/validators';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
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
    <FormScreen title="Hallado" subtitle="Ingresá a tu cuenta" error={formError}>
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
      <Button title="Ingresar" onPress={onSubmit} loading={loading} />
      <View style={{ height: 8 }} />
      <Button variant="link" title="Olvidé mi contraseña" onPress={() => navigation.navigate('ForgotPassword')} />
      <Button variant="link" title="Crear cuenta" onPress={() => navigation.navigate('RegisterEmail')} />
    </FormScreen>
  );
}
