export const projectStages = ["winning", "planning", "building-permit", "apartment-selection-and-contract", "construction", "occupancy-approval", "delivery"] as const;
export type ProjectStage = (typeof projectStages)[number];
export type VerificationStatus = "verified" | "unverified" | "requires-review" | "awaiting-approval" | "conflict";
export interface ProjectIdentifiers { lotteryNumber?: string; tenderNumber?: string; planNumber?: string; block?: string; parcels: string[]; lot?: string; permitRequestNumbers: string[]; }
