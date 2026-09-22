// The alliance HQ site is self-service — anyone can create their own org — so
// site-owner-only views (like the contact inbox) must be scoped to this one
// org, not just "any admin", or every alliance's admin would see them.
export const OWNER_ORG_ID = "49aed15b-0f97-4f13-ae05-7420112ccefe";
