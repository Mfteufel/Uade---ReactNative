import { USE_MOCK } from '../config';
import client from './client';
import * as mock from './mock/mockAuth';

// Las pantallas llaman SOLO a estas funciones. Con USE_MOCK = false van al backend real.

export const requestRegisterOtp = (email) =>
  USE_MOCK ? mock.requestRegisterOtp(email) : client.post('/auth/register/request-otp', { email });

export const verifyRegisterOtp = (email, code) =>
  USE_MOCK ? mock.verifyRegisterOtp(email, code) : client.post('/auth/register/verify-otp', { email, code });

export const setRegisterPassword = (registrationToken, password) =>
  USE_MOCK
    ? mock.setRegisterPassword(registrationToken, password)
    : client.post('/auth/register/set-password', { registrationToken, password });

export const login = (email, password) =>
  USE_MOCK ? mock.login(email, password) : client.post('/auth/login', { email, password });

export const refreshSession = (refreshToken) =>
  USE_MOCK ? mock.refresh(refreshToken) : client.post('/auth/refresh', { refreshToken });

export const requestPasswordOtp = (email) =>
  USE_MOCK ? mock.requestPasswordOtp(email) : client.post('/auth/password/request-otp', { email });

export const resendPasswordOtp = (email) =>
  USE_MOCK ? mock.resendPasswordOtp(email) : client.post('/auth/password/resend-otp', { email });

export const resetPassword = (email, code, newPassword) =>
  USE_MOCK
    ? mock.resetPassword(email, code, newPassword)
    : client.post('/auth/password/reset', { email, code, newPassword });
