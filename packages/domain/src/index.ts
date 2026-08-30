export const projectStages = ["winning", "planning", "building-permit", "apartment-selection-and-contract", "construction", "occupancy-approval", "delivery"] as const;
export type ProjectStage = (typeof projectStages)[number];
export type VerificationStatus = "verified" | "unverified" | "requires-review" | "awaiting-approval" | "conflict" | "rejected";
export type ResearchStatus = "pending" | "running" | "waiting-for-user" | "completed" | "completed-with-errors" | "failed" | "cancelled";
export type TaskStatus = "open" | "in-progress" | "completed" | "dismissed";
export type IdentifierOrigin = "winning-message" | "manual" | "official-source" | "research";
export * from "./winning-message-parser.ts";

export interface ProjectIdentifiers {
  lotteryNumber?: string;
  housingProjectNumber?: string;
  tenderNumber?: string;
  planNumber?: string;
  block?: string;
  parcels: string[];
  lot?: string;
  permitRequestNumbers: string[];
}
