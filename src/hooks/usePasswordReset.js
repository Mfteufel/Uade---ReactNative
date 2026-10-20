import { useState } from 'react';
import useCountdown from './useCountdown';
import { requestPasswordOtp, resendPasswordOtp, resetPassword } from '../services/authApi';
import { getErrorMessage } from '../services/errors';
import { validateEmail, validateOtp, validatePassword, validateConfirm } from '../utils/validators';
import { showDevOtp } from '../utils/devOtp';

const RESEND_SECONDS = 60;

export default function usePasswordReset({ onDone }) {
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
      onDone?.();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return {
    step, email, setEmail, code, setCode, password, setPassword, confirm, setConfirm,
    errors, formError, loading, resending, seconds,
    onRequestCode, onResend, onReset,
  };
}
