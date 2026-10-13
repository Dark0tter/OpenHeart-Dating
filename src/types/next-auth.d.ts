import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** User.sessionVersion when this session signed in. */
    sv?: number;
  }
  interface User {
    sv?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sv?: number;
  }
}
