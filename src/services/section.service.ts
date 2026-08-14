import { AppError } from "../errors/app-error.js";
import { SectionMapper } from "../mappers/section.mapper.js";
import type { ICourseRepository } from "../repositories/interfaces/course.repository.interface.js";
import type { ISectionRepository } from "../repositories/interfaces/section.repository.interface.js";
import type {
    CreateSectionInput,
    SectionListQuery,
    SectionResponse,
    UpdateSectionInput,
    UpdateSectionStatusInput,
} from "../types/section.types.js";

export class SectionService {
    constructor(
        private readonly sectionRepository: ISectionRepository,
        private readonly courseRepository: ICourseRepository,
    ) {}

    async createSection(courseId: string, input: CreateSectionInput): Promise<SectionResponse> {
        const courseExists = await this.courseRepository.existsById(courseId);

        if (!courseExists) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        const section = await this.sectionRepository.create(courseId, input);
        return SectionMapper.toResponse(section);
    }

    async getAdminSectionsByCourse(
        courseId: string,
        query?: SectionListQuery,
    ): Promise<SectionResponse[]> {
        const courseExists = await this.courseRepository.existsById(courseId);

        if (!courseExists) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        const sections = await this.sectionRepository.findByCourseId(courseId, query);
        return SectionMapper.toListResponse(sections);
    }

    async getAdminSectionById(sectionId: string): Promise<SectionResponse> {
        const section = await this.sectionRepository.findById(sectionId);

        if (!section) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        return SectionMapper.toResponse(section);
    }

    async updateSection(
        sectionId: string,
        input: UpdateSectionInput,
    ): Promise<SectionResponse> {
        const existingSection = await this.sectionRepository.findById(sectionId);

        if (!existingSection) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        const updatedSection = await this.sectionRepository.updateById(sectionId, input);

        if (!updatedSection) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        return SectionMapper.toResponse(updatedSection);
    }

    async updateSectionStatus(
        sectionId: string,
        input: UpdateSectionStatusInput,
    ): Promise<SectionResponse> {
        const existingSection = await this.sectionRepository.findById(sectionId);

        if (!existingSection) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        const updatedSection = await this.sectionRepository.updateStatus(sectionId, input.status);

        if (!updatedSection) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        return SectionMapper.toResponse(updatedSection);
    }

    async deactivateSection(sectionId: string): Promise<SectionResponse> {
        const existingSection = await this.sectionRepository.findById(sectionId);

        if (!existingSection) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        const deactivatedSection = await this.sectionRepository.updateStatus(sectionId, "INACTIVE");

        if (!deactivatedSection) {
            throw new AppError("SECTION_NOT_FOUND", "Không tìm thấy phần học", 404);
        }

        return SectionMapper.toResponse(deactivatedSection);
    }

    async getPublishedSectionsByCourse(courseId: string): Promise<SectionResponse[]> {
        const course = await this.courseRepository.findPublishedById(courseId);

        if (!course) {
            throw new AppError("COURSE_NOT_FOUND", "Không tìm thấy khóa học", 404);
        }

        const sections = await this.sectionRepository.findPublishedByCourseId(courseId);
        return SectionMapper.toListResponse(sections);
    }
}
