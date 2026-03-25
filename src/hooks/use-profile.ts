import { apiClient } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/store/auth-store";

export function useProfile() {
  const setUser = useAuthStore((state) => state.setUser);

  const getProfile = async () => {
    const { data } = await apiClient.get<AuthUser>("/me");
    setUser(data);
    return data;
  };

  const updateProfile = async (payload: { email: string; username: string }) => {
    const { data } = await apiClient.put("/me", payload);
    await getProfile();
    return data;
  };

  const changePassword = async (payload: {
    current_password: string;
    new_password: string;
  }) => {
    const { data } = await apiClient.post("/me/change-password", payload);
    return data;
  };

  return { getProfile, updateProfile, changePassword };
}
