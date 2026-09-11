import { UserCurriculumMilestoneModel } from "../../models/user-curriculum-milestone.model.js";
import type { ICurriculumMilestoneRepository, Milestone } from "../interfaces/curriculum-milestone.repository.interface.js";

export class CurriculumMilestoneRepository implements ICurriculumMilestoneRepository {
    async findByUser(userId: string): Promise<Milestone[]> {
        const rows = await UserCurriculumMilestoneModel.find({ userId }).lean();
        return rows.map(row => ({ ...row, targetId: row.targetId.toString(), completedLessonIds: row.completedLessonIds?.map(String) }));
    }
    async grant(userId: string, milestone: Milestone): Promise<void> {
        const { kind, targetId, accessGrantedAt, firstCompletedAt, completedLessonIds } = milestone;
        await UserCurriculumMilestoneModel.updateOne({ userId, kind, targetId }, {
            $setOnInsert: { accessGrantedAt },
        }, { upsert: true });
        if (firstCompletedAt) {
            await UserCurriculumMilestoneModel.updateOne({ userId, kind, targetId, firstCompletedAt: { $exists: false } }, {
                $set: { firstCompletedAt, completedLessonIds },
            });
        }
    }
}
