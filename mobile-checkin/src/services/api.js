const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const checkHealth = async () => {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
};