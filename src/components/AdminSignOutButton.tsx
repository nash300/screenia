"use client";

import { useState } from "react";

export default function AdminSignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/admin-login");
    }
  };

  return (
    <button
      type="button"
      className="admin-sidebar-signout"
      onClick={signOut}
      disabled={signingOut}
    >
      {signingOut ? "Loggar ut..." : "Logga ut"}
    </button>
  );
}
