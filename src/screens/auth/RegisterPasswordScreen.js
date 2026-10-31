import { useState } from 'react';
import { StyleSheet } from 'react-native';
import FormScreen from '../../components/FormScreen';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Banner from '../../components/Banner';
import BottomActionBar from '../../components/BottomActionBar';
import { useAuth } from '../../context/AuthContext';
import { setRegisterPassword } from '../../services/authApi';
import { getErrorMessage } from '../../services/errors';
import { validatePassword, validateConfirm } from '../../utils/validators';
import { spacing } from '../../constants/theme';

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
    <FormScreen
      title="Elegí tu contraseña"
      subtitle="Paso 3 de 3: mínimo 8 caracteres."
      footer={
        <BottomActionBar>
          <Button title="Crear cuenta" onPress={onSubmit} loading={loading} />
        </BottomActionBar>
      }
    >
      {formError ? <Banner kind="warn" message={formError} style={styles.banner} /> : null}
      <Input label="Contraseña" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry autoCapitalize="none" />
      <Input label="Repetir contraseña" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoCapitalize="none" />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: spacing.md },
});
