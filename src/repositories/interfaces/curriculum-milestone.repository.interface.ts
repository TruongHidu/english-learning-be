export interface Milestone {
    targetId: string;
    kind: "LESSON" | "TOPIC" | "SECTION";
    accessGrantedAt: Date;
    firstCompletedAt?: Date;
    completedLessonIds?: string[];
}
export interface ICurriculumMilestoneRepository {
    findByUser(userId: string): Promise<Milestone[]>;
    grant(userId: string, milestone: Milestone): Promise<void>;
}
