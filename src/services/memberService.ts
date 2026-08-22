import membersData from "../data/members.json" with { type: "json" };
import type { Member } from "../types.js";

// Mocked upstream: in production this would call the member-profile service.
// Kept as an async function so the call site doesn't change when that swap happens.
const members = membersData as Member[];

export async function getMemberProfile(memberId: string): Promise<Member | undefined> {
  return members.find((m) => m.memberId === memberId);
}

export async function listMemberIds(): Promise<string[]> {
  return members.map((m) => m.memberId);
}
