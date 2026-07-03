"use client";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { polarClient } from "@polar-sh/better-auth/client";

export const authClient = createAuthClient({
  plugins: [usernameClient(), polarClient()],
});
