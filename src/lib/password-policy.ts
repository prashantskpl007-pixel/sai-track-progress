export const MIN_PASSWORD_LENGTH = 4;
export const PASSWORD_MIN_LENGTH_ERROR = "Password must be at least 4 characters.";

export function isPasswordLongEnough(password: string) {
  return password.length >= MIN_PASSWORD_LENGTH;
}