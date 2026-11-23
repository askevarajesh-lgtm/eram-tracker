// Licence rules for the Users & access register (shared by server actions and pages).
// Reminder: people in the register are records for tracking licences/access. They are not app accounts.

export const USER_TYPES = ["Business user", "Developer", "IT / Admin", "Consultant"] as const;
export const LICENCE_MODELS = ["Perpetual", "Subscription", "Annual maintenance", "Trial"] as const;
// Stored value "endusers" is kept from the old app; it means business users (people in the Users & access register),
// NOT the IT team who use this tracker.
export const AUDIENCES = { endusers: "Business users only", dev: "Development / test", all: "Anyone" } as const;
export type Audience = keyof typeof AUDIENCES;

export const isBusinessUser = (userType: string) => !userType || userType === "Business user";

/** Business-user licences are only held by, and only counted for, business users. */
export const countsAgainst = (audience: string, userType: string) => audience !== "endusers" || isBusinessUser(userType);

/** Days until a date (YYYY-MM-DD), negative when past. */
export function daysUntil(day: string) {
  if (!day) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((Date.parse(day + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
}
