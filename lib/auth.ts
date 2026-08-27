import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { loginSchema } from "@/lib/validation";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    // ── Google OAuth ──
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // ── Email/Password ──
    Credentials({
      async authorize(credentials) {
        const validatedFields = loginSchema.safeParse(credentials);
        if (!validatedFields.success) return null;

        const { email, password } = validatedFields.data;

        await connectDB();
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || !user.passwordHash) return null;

        const passwordsMatch = await bcrypt.compare(
          password,
          user.passwordHash,
        );
        if (!passwordsMatch) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],

  // ── Called on EVERY sign-in (Google + Credentials) ──
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user, account }) {
      // Credentials: already validated in authorize(), allow
      if (account?.provider === "credentials") {
        return true;
      }

      // Google OAuth: sync user to MongoDB
      if (account?.provider === "google" && user.email) {
        await connectDB();

        let dbUser = await User.findOne({ email: user.email.toLowerCase() });

        if (!dbUser) {
          // Create new user from Google profile
          dbUser = await User.create({
            name: user.name || user.email.split("@")[0],
            email: user.email.toLowerCase(),
            passwordHash: "", // No password for OAuth users
          });
        }

        // Attach the MongoDB _id so jwt callback can use it
        user.id = dbUser._id.toString();
        return true;
      }

      return false;
    },
  },

  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
});
