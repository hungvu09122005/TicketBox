// src/services/network.js

import NetInfo from '@react-native-community/netinfo';

export const checkNetworkStatus = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected;
};