const ADMIN_PASSWORD = "01013701405";

export const checkAdminAuth = (password: string): boolean => {
  return password === ADMIN_PASSWORD;
};

export const isAdminAuthenticated = (): boolean => {
  return localStorage.getItem("adminAuth") === "true";
};

export const setAdminAuth = (authenticated: boolean): void => {
  if (authenticated) {
    localStorage.setItem("adminAuth", "true");
  } else {
    localStorage.removeItem("adminAuth");
  }
};
