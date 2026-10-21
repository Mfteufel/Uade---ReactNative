import { USE_MOCK } from '../config';
import api, { unwrap } from './api';
import * as mock from './mock/mockAuth';

// Las pantallas llaman SOLO a estas funciones. Con USE_MOCK = false van al backend real.

export const requestRegisterOtp = (email) =>
  USE_MOCK ? mock.requestRegisterOtp(email) : api.post('/auth/register/request-otp', { email }).then(unwrap);

export const verifyRegisterOtp = (email, code) =>
  USE_MOCK ? mock.verifyRegisterOtp(email, code) : api.post('/auth/register/verify-otp', { email, code }).then(unwrap);

export const setRegisterPassword = (registrationToken, password) =>
  USE_MOCK
    ? mock.setRegisterPassword(registrationToken, password)
    : api.post('/auth/register/set-password', { registrationToken, password }).then(unwrap);

export const login = (email, password) =>
  USE_MOCK ? mock.login(email, password) : api.post('/auth/login', { email, password }).then(unwrap);

export const refreshSession = (refreshToken) =>
  USE_MOCK ? mock.refresh(refreshToken) : api.post('/auth/refresh', { refreshToken }).then(unwrap);

export const requestPasswordOtp = (email) =>
  USE_MOCK ? mock.requestPasswordOtp(email) : api.post('/auth/password/request-otp', { email }).then(unwrap);

export const resendPasswordOtp = (email) =>
  USE_MOCK ? mock.resendPasswordOtp(email) : api.post('/auth/password/resend-otp', { email }).then(unwrap);

export const resetPassword = (email, code, newPassword) =>
  USE_MOCK
    ? mock.resetPassword(email, code, newPassword)
    : api.post('/auth/password/reset', { email, code, newPassword }).then(unwrap);
