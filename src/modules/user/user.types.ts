// Used for admin-controlled role updates
export interface UpdateUserRolesInput {
  userId: number;
  userRole: string;
  appRole?: string;
}

// Used for self-service profile updates (username, email, etc.)
export interface UpdateUserProfileInput {
  username?: string;
  email?: string;
}
