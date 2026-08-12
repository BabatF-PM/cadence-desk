import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive.readonly");
provider.addScope("https://www.googleapis.com/auth/gmail.send");
provider.addScope("https://www.googleapis.com/auth/userinfo.email");
provider.addScope("https://www.googleapis.com/auth/calendar.readonly");

// Force Google OAuth to show the consent screen and grant the new gmail.send scope
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Clear token cache if not actively signing in and no token exists
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("gcal_access_token", credential.accessToken);
    }
    if (typeof window !== "undefined") {
      (window as any).__GOOGLE_ACCESS_TOKEN__ = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === "auth/popup-closed-by-user" ||
      error?.code === "auth/cancelled-popup-request" ||
      error?.code === "auth/popup-blocked" ||
      error?.message?.includes("popup-closed-by-user")
    ) {
      console.log("Google sign-in popup was closed or cancelled by the user.");
      return null;
    }
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof localStorage !== "undefined" && localStorage.getItem("gcal_access_token")) {
    cachedAccessToken = localStorage.getItem("gcal_access_token");
    return cachedAccessToken;
  }
  if (typeof window !== "undefined" && (window as any).__GOOGLE_ACCESS_TOKEN__) {
    cachedAccessToken = (window as any).__GOOGLE_ACCESS_TOKEN__;
    return cachedAccessToken;
  }
  return null;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("gcal_access_token");
  }
  if (typeof window !== "undefined") {
    delete (window as any).__GOOGLE_ACCESS_TOKEN__;
  }
};
