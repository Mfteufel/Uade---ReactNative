import { useState } from 'react';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { setRegisterPassword } from '../../api/authApi';
import { getErrorMessage } from '../../api/errors';
import { validatePassword, validateConfirm } from '../../utils/validators';

export default function RegisterPasswordScreen({ route }) {
  const { registrationToken } = route.params;
  const { startSession } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const next = { password: validatePassword(password), confirm: validateConfirm(password, confirm) };
    setErrors(next);
    setFormError('');
    if (next.password || next.confirm) return;

    setLoading(true);
    try {
      const session = await setRegisterPassword(registrationToken, password);
      await startSession(session); // el navegador pasa solo a Mi perfil
    } catch (e) {
      setFormError(getErrorMessage(e));
      setLoading(false);
    }
  };

  return (
    <FormScreen title="Elegí tu contraseña" subtitle="Paso 3 de 3: mínimo 8 caracteres." error={formError}>
      <Input label="Contraseña" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoCapitalize="none" />
      <Input label="Repetir contraseña" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" />
      <Button title="Crear cuenta" onPress={onSubmit} loading={loading} />
    </FormScreen>
  );
}
