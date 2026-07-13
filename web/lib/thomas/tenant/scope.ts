import "server-only";
import { getActiveTenant } from "./resolve";

/** Active tenant organization ID for data scoping. */
export function getOrganizationId(): string {
  return getActiveTenant().organizationId;
}
