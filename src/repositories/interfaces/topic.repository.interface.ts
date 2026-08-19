import { type TopicDocument } from "../../models/topic.model.js";
import {
    type CreateTopicInput,
    type TopicStatus,
    type UpdateTopicInput,
} from "../../types/topic.types.js";

export interface ITopicRepository {
    findById(id: string): Promise<TopicDocument | null>;
    findBySectionId(sectionId: string): Promise<TopicDocument[]>;
    findPublishedBySectionId(sectionId: string): Promise<TopicDocument[]>;
    findByNameAndSectionId(name: string, sectionId: string): Promise<TopicDocument | null>;
    create(sectionId: string, data: CreateTopicInput): Promise<TopicDocument>;
    update(id: string, data: UpdateTopicInput): Promise<TopicDocument | null>;
    updateStatus(id: string, status: TopicStatus): Promise<TopicDocument | null>;
    deleteById(id: string): Promise<void>;
    getMaxOrderIndex(sectionId: string): Promise<number>;
    reorder(sectionId: string, topicIds: string[]): Promise<void>;
}
