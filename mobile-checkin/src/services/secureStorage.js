// src/services/secureStorage.js
import * as SecureStore from 'expo-secure-store';

export const saveToken = async (token) => {
  await SecureStore.setItemAsync('access_token', token);
};

export const getToken = async () => {
  return await SecureStore.getItemAsync('access_token');
};
