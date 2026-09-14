import { Types } from "mongoose";
import { REVIEW_CONFIG } from "../config/vocabulary-review.config.js";
import { AppError } from "../errors/app-error.js";
import { TopicModel } from "../models/topic.model.js";
import { UserVocabularyModel } from "../models/user-vocabulary.model.js";
import { VocabularyReviewGoalModel } from "../models/vocabulary-review-goal.model.js";
import { VocabularyReviewSessionModel } from "../models/vocabulary-review-session.model.js";
import type { IUserRepository } from "../repositories/interfaces/user.repository.interface.js";
import type { UserStatsService } from "./user-stats.service.js";
import type {
  AnswerQuality,
  CreateReviewSessionInput,
  ReviewQuestionType,
  ReviewScope,
  SubmitReviewAnswerInput,
} from "../types/vocabulary-review.types.js";
import { effectiveCurrentStreak } from "../utils/streak.js";

interface VocabularySnapshot {
  _id: Types.ObjectId;
  word: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  example?: string;
  exampleMeaning?: string;
  audioUrl?: string;
  difficulty?: string;
}
interface ReviewCandidate {
  _id: Types.ObjectId;
  vocabularyId: VocabularySnapshot;
  topicId: Types.ObjectId;
  status: "LEARNED" | "MASTERED";
  reviewLevel: number;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  correctStreak?: number;
  lapseCount?: number;
  averageResponseTimeMs?: number;
  isBookmarked?: boolean;
  learnedAt: Date;
  lastReviewedAt: Date | null;
  nextReviewAt: Date;
}
interface StoredQuestion extends Record<string, unknown> {
  id: string;
  vocabularyId: string;
  topicId: string;
  type: ReviewQuestionType;
  prompt: string;
  phonetic?: string;
  audioUrl?: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId?: string;
  acceptedAnswers: string[];
  word: string;
  meaning: string;
  partOfSpeech?: string;
  example?: string;
  exampleMeaning?: string;
  isRetry: boolean;
  retryOfQuestionId?: string;
  answered: boolean;
}
interface StoredAnswer extends Record<string, unknown> {
  questionId: string;
  vocabularyId: string;
  questionType: ReviewQuestionType;
  isRetry: boolean;
  isCorrect: boolean;
  answerQuality: AnswerQuality;
  responseTimeMs: number;
  usedHint: boolean;
  masteryBefore: number;
  masteryAfter: number;
  answeredAt: string;
}
export interface PriorityResult {
  score: number;
  reason:
    | "NEVER_REVIEWED"
    | "OVERDUE"
    | "FREQUENTLY_WRONG"
    | "LOW_MASTERY"
    | "SLOW_RECALL"
    | "LAPSED"
    | "DUE_TODAY"
    | "BOOKMARKED"
    | "STABLE";
}

export function normalizeReviewAnswer(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}
function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0] ?? 0;
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = previous[j] ?? j;
      previous[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = old;
    }
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}
export function calculatePriority(
  candidate: Omit<
    ReviewCandidate,
    "_id" | "vocabularyId" | "topicId" | "learnedAt" | "status"
  >,
  now = new Date(),
): PriorityResult {
  const w = REVIEW_CONFIG.priority;
  if (!candidate.lastReviewedAt || candidate.reviewCount === 0)
    return { score: w.neverReviewed, reason: "NEVER_REVIEWED" };
  const overdueDays = Math.max(
    0,
    Math.floor(
      (now.getTime() - new Date(candidate.nextReviewAt).getTime()) / 86_400_000,
    ),
  );
  const attempts = candidate.correctCount + candidate.incorrectCount;
  const parts = {
    overdue: Math.min(w.overdueMax, overdueDays * w.overduePerDay),
    wrong:
      (attempts ? candidate.incorrectCount / attempts : 0) *
      w.incorrectRatioMax,
    mastery: ((5 - candidate.reviewLevel) / 5) * w.lowMasteryMax,
    lapse: Math.min(w.lapseMax, (candidate.lapseCount ?? 0) * 3),
    slow:
      Math.min(1, (candidate.averageResponseTimeMs ?? 0) / 15_000) *
      w.slowRecallMax,
    bookmark: candidate.isBookmarked ? w.bookmark : 0,
  };
  const top = Object.entries(parts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const reason =
    top === "overdue"
      ? overdueDays
        ? "OVERDUE"
        : "DUE_TODAY"
      : top === "wrong"
        ? "FREQUENTLY_WRONG"
        : top === "mastery"
          ? "LOW_MASTERY"
          : top === "lapse"
            ? "LAPSED"
            : top === "slow"
              ? "SLOW_RECALL"
              : top === "bookmark"
                ? "BOOKMARKED"
                : "STABLE";
  return {
    score:
      Math.round(Object.values(parts).reduce((s, v) => s + v, 0) * 10) / 10,
    reason,
  };
}
export function calculateAdaptiveReview(
  currentLevel: number,
  quality: AnswerQuality,
  lapseCount: number,
  now = new Date(),
): { level: number; nextReviewAt: Date } {
  let level = currentLevel;
  if (quality === "FAIL") level = Math.max(0, level - 1);
  if (quality === "GOOD" || quality === "EASY") level = Math.min(5, level + 1);
  const base = REVIEW_CONFIG.intervalsInDays[level] ?? 30;
  let days =
    quality === "FAIL"
      ? 0
      : quality === "HARD"
        ? Math.max(1, Math.floor(base * 0.5))
        : quality === "EASY"
          ? Math.min(45, Math.ceil(base * 1.5))
          : base;
  days = Math.max(
    quality === "FAIL" ? 0 : 1,
    Math.floor(days * Math.max(0.55, 1 - lapseCount * 0.05)),
  );
  return { level, nextReviewAt: new Date(now.getTime() + days * 86_400_000) };
}
const shuffle = <T>(items: T[]) =>
  items
    .map((item) => ({ item, n: Math.random() }))
    .sort((a, b) => a.n - b.n)
    .map(({ item }) => item);

export class VocabularyReviewService {
  constructor(
    private readonly userStatsService: UserStatsService,
    private readonly userRepository: IUserRepository,
  ) {}

  private async candidates(
    userId: string,
    scope: ReviewScope,
    topicIds: string[],
    includeMastered: boolean,
    recentDays = 7,
  ): Promise<ReviewCandidate[]> {
    const now = new Date();
    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      excludedFromReview: false,
      status: includeMastered ? { $in: ["LEARNED", "MASTERED"] } : "LEARNED",
    };
    if (topicIds.length)
      query.topicId = { $in: topicIds.map((id) => new Types.ObjectId(id)) };
    if (scope === "DUE_ONLY") query.nextReviewAt = { $lte: now };
    if (scope === "WEAK_WORDS")
      query.$or = [
        { reviewLevel: { $lte: 2 } },
        { incorrectCount: { $gt: 0 } },
        { lapseCount: { $gt: 0 } },
      ];
    if (scope === "RECENTLY_LEARNED")
      query.learnedAt = {
        $gte: new Date(now.getTime() - recentDays * 86_400_000),
      };
    if (scope === "MISTAKES") query.incorrectCount = { $gt: 0 };
    if (scope === "BOOKMARKED") query.isBookmarked = true;
    if (scope === "MASTERED_CHECK") query.status = "MASTERED";
    return UserVocabularyModel.find(query)
      .populate("vocabularyId")
      .lean()
      .then((rows) => rows as unknown as ReviewCandidate[]);
  }
  private rank(items: ReviewCandidate[]): ReviewCandidate[] {
    const now = new Date();
    return [...items].sort(
      (a, b) =>
        calculatePriority(b, now).score - calculatePriority(a, now).score ||
        (a.lastReviewedAt ? +new Date(a.lastReviewedAt) : 0) -
          (b.lastReviewedAt ? +new Date(b.lastReviewedAt) : 0) ||
        +new Date(a.nextReviewAt) - +new Date(b.nextReviewAt) ||
        String(a._id).localeCompare(String(b._id)),
    );
  }
  private chooseSmart(items: ReviewCandidate[], size: number) {
    const due = this.rank(
      items.filter((i) => +new Date(i.nextReviewAt) <= Date.now()),
    );
    const weak = this.rank(
      items.filter(
        (i) =>
          !due.includes(i) &&
          (i.reviewLevel <= 2 || i.incorrectCount > i.correctCount),
      ),
    );
    const fresh = this.rank(
      items.filter(
        (i) =>
          !due.includes(i) &&
          !weak.includes(i) &&
          (!i.lastReviewedAt || i.reviewCount === 0),
      ),
    );
    const selected: ReviewCandidate[] = [];
    const add = (pool: ReviewCandidate[], n: number) =>
      pool.slice(0, Math.max(0, n)).forEach((i) => {
        if (!selected.includes(i)) selected.push(i);
      });
    add(due, Math.ceil(size * 0.6));
    add(weak, Math.ceil(size * 0.25));
    add(fresh, size - selected.length);
    add(
      this.rank(items.filter((i) => !selected.includes(i))),
      size - selected.length,
    );
    return selected.slice(0, size);
  }
  private balanceTopics(items: ReviewCandidate[], size: number) {
    const buckets = new Map<string, ReviewCandidate[]>();
    items.forEach((item) => {
      const key = String(item.topicId);
      buckets.set(key, [...(buckets.get(key) ?? []), item]);
    });
    const balanced: ReviewCandidate[] = [];
    while (
      balanced.length < size &&
      [...buckets.values()].some((bucket) => bucket.length)
    ) {
      for (const bucket of buckets.values()) {
        const item = bucket.shift();
        if (item) balanced.push(item);
        if (balanced.length === size) break;
      }
    }
    return balanced;
  }
  private chooseType(
    c: ReviewCandidate,
    skill: CreateReviewSessionInput["skillFocus"],
    i: number,
  ): ReviewQuestionType {
    if (skill === "MEANING")
      return i % 2 ? "MEANING_TO_WORD" : "WORD_TO_MEANING";
    if (skill === "LISTENING")
      return c.vocabularyId.audioUrl ? "LISTENING_TO_WORD" : "MEANING_TO_WORD";
    if (skill === "SPELLING") return "TYPING_WORD";
    if (skill === "CONTEXT")
      return c.vocabularyId.example ? "FILL_IN_BLANK" : "TYPING_WORD";
    if (c.reviewLevel <= 1)
      return i % 2 ? "MEANING_TO_WORD" : "WORD_TO_MEANING";
    if (c.reviewLevel <= 3)
      return c.vocabularyId.audioUrl && i % 2
        ? "LISTENING_TO_WORD"
        : "MEANING_TO_WORD";
    return c.vocabularyId.example && i % 2 ? "FILL_IN_BLANK" : "TYPING_WORD";
  }
  private makeQuestion(
    c: ReviewCandidate,
    pool: ReviewCandidate[],
    requested: ReviewQuestionType,
    retryOfQuestionId?: string,
  ): StoredQuestion {
    const v = c.vocabularyId;
    const id = new Types.ObjectId().toString();
    let type = requested;
    if (type === "LISTENING_TO_WORD" && !v.audioUrl) type = "MEANING_TO_WORD";
    if (
      type === "FILL_IN_BLANK" &&
      !v.example?.toLocaleLowerCase().includes(v.word.toLocaleLowerCase())
    )
      type = "TYPING_WORD";
    let prompt =
      type === "WORD_TO_MEANING"
        ? v.word
        : type === "LISTENING_TO_WORD"
          ? "Nghe và chọn từ bạn vừa nghe"
          : v.meaning;
    if (type === "FILL_IN_BLANK")
      prompt = v.example!.replace(
        new RegExp(v.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        "_____",
      );
    const field: "meaning" | "word" =
      type === "WORD_TO_MEANING" ? "meaning" : "word";
    const distractors = shuffle(
      pool.filter((x) => String(x._id) !== String(c._id)),
    )
      .sort(
        (a, b) =>
          Number(String(b.topicId) === String(c.topicId)) -
          Number(String(a.topicId) === String(c.topicId)),
      )
      .map((x) => x.vocabularyId[field])
      .filter((x, i, a) => x && x !== v[field] && a.indexOf(x) === i)
      .slice(0, 3);
    if (
      ["WORD_TO_MEANING", "MEANING_TO_WORD", "LISTENING_TO_WORD"].includes(
        type,
      ) &&
      distractors.length < 3
    )
      type = "TYPING_WORD";
    if (type === "TYPING_WORD") prompt = v.meaning;
    const values = ["TYPING_WORD", "FILL_IN_BLANK"].includes(type)
      ? []
      : shuffle([v[field], ...distractors]);
    const options = values.map((label) => ({
      id: new Types.ObjectId().toString(),
      label,
    }));
    return {
      id,
      vocabularyId: String(v._id),
      topicId: String(c.topicId),
      type,
      prompt,
      phonetic: type === "WORD_TO_MEANING" ? v.phonetic : undefined,
      audioUrl: type === "LISTENING_TO_WORD" ? v.audioUrl : undefined,
      options,
      correctOptionId: options.find((o) => o.label === v[field])?.id,
      acceptedAnswers: [normalizeReviewAnswer(v.word)],
      word: v.word,
      meaning: v.meaning,
      partOfSpeech: v.partOfSpeech,
      example: v.example,
      exampleMeaning: v.exampleMeaning,
      isRetry: Boolean(retryOfQuestionId),
      retryOfQuestionId,
      answered: false,
    };
  }
  private publicQuestion(q: StoredQuestion) {
    const {
      correctOptionId: _c,
      acceptedAnswers: _a,
      word: _w,
      meaning: _m,
      example: _e,
      exampleMeaning: _em,
      answered: _an,
      ...safe
    } = q;
    return safe;
  }
  private sessionDto(s: {
    _id: unknown;
    status: string;
    settings: CreateReviewSessionInput;
    questions: Record<string, unknown>[];
    answers: Record<string, unknown>[];
    startedAt: Date;
  }) {
    const qs = s.questions as unknown as StoredQuestion[];
    const next = qs.find((q) => !q.answered);
    return {
      id: String(s._id),
      status: s.status,
      settings: s.settings,
      progress: { answered: s.answers.length, total: qs.length },
      currentQuestion: next ? this.publicQuestion(next) : null,
      startedAt: s.startedAt,
    };
  }

  async getDashboard(userId: string) {
    const now = new Date();
    const items = await this.candidates(userId, "FREE_REVIEW", [], true);
    const sessions = await VocabularyReviewSessionModel.find({
      userId,
      createdAt: { $gte: new Date(now.getTime() - 7 * 86_400_000) },
    }).lean();
    const answers = sessions
      .flatMap((s) => s.answers as unknown as StoredAnswer[])
      .filter((a) => !a.isRetry);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const today = answers.filter((a) => new Date(a.answeredAt) >= start);
    const dueToday = items.filter(
      (i) => new Date(i.nextReviewAt) <= now,
    ).length;
    const weakCount = items.filter(
      (i) => i.reviewLevel <= 2 || i.incorrectCount > i.correctCount,
    ).length;
    const masteredCount = items.filter((i) => i.status === "MASTERED").length;
    const topicIds = [...new Set(items.map((i) => String(i.topicId)))];
    const topics = await TopicModel.find({ _id: { $in: topicIds } })
      .select("name")
      .lean();
    const names = new Map(topics.map((t) => [String(t._id), t.name]));
    const topicStats = topicIds.map((id) => {
      const list = items.filter((i) => String(i.topicId) === id);
      const ids = new Set(list.map((i) => String(i.vocabularyId._id)));
      const scoped = answers.filter((a) => ids.has(a.vocabularyId));
      return {
        topicId: id,
        name: names.get(id) ?? "Chủ đề",
        totalWords: list.length,
        dueCount: list.filter((i) => new Date(i.nextReviewAt) <= now).length,
        weakCount: list.filter((i) => i.reviewLevel <= 2).length,
        masteredCount: list.filter((i) => i.status === "MASTERED").length,
        accuracy: scoped.length
          ? Math.round(
              (scoped.filter((a) => a.isCorrect).length / scoped.length) * 100,
            )
          : 0,
        masteryProgress: list.length
          ? Math.round(
              (list.reduce((s, i) => s + i.reviewLevel, 0) /
                (list.length * 5)) *
                100,
            )
          : 0,
        estimatedMinutes: Math.max(1, Math.ceil(list.length / 2)),
      };
    });
    const skillStats = ["MEANING", "LISTENING", "SPELLING", "CONTEXT"].map(
      (skill) => {
        const types =
          skill === "MEANING"
            ? ["WORD_TO_MEANING", "MEANING_TO_WORD"]
            : skill === "LISTENING"
              ? ["LISTENING_TO_WORD"]
              : skill === "SPELLING"
                ? ["TYPING_WORD"]
                : ["FILL_IN_BLANK"];
        const scoped = answers.filter((a) => types.includes(a.questionType));
        return {
          skill,
          accuracy: scoped.length
            ? Math.round(
                (scoped.filter((a) => a.isCorrect).length / scoped.length) *
                  100,
              )
            : 0,
          attempts: scoped.length,
        };
      },
    );
    const scheduleAt = (days: number) =>
      items.filter(
        (i) =>
          new Date(i.nextReviewAt) <=
          new Date(now.getTime() + days * 86_400_000),
      ).length;
    const attentionWords = this.rank(items)
      .slice(0, 5)
      .map((i) => ({
        vocabularyId: String(i.vocabularyId._id),
        word: i.vocabularyId.word,
        meaning: i.vocabularyId.meaning,
        phonetic: i.vocabularyId.phonetic,
        mastery: i.reviewLevel,
        nextReviewAt: i.nextReviewAt,
        isBookmarked: Boolean(i.isBookmarked),
        ...calculatePriority(i, now),
      }));
    const active = await VocabularyReviewSessionModel.findOne({
      userId,
      status: "ACTIVE",
      expiresAt: { $gt: now },
    })
      .sort({ updatedAt: -1 })
      .lean();
    const goal = await VocabularyReviewGoalModel.findOne({ userId }).lean();
    const sortedTopics = [...topicStats].sort(
      (a, b) => a.accuracy - b.accuracy,
    );
    const suggestions = [
      dueToday
        ? {
            id: "due",
            title: `Ôn ${Math.min(10, dueToday)} từ đến hạn`,
            reason: "Giữ đúng lịch ghi nhớ",
            estimatedMinutes: Math.ceil(Math.min(10, dueToday) / 2),
            mode: "SMART_REVIEW",
            scope: "DUE_ONLY",
            topicIds: [],
            skillFocus: "ADAPTIVE",
          }
        : null,
      weakCount
        ? {
            id: "weak",
            title: `Củng cố ${Math.min(8, weakCount)} từ đang yếu`,
            reason: "Mastery thấp hoặc thường trả lời sai",
            estimatedMinutes: 4,
            mode: "SMART_REVIEW",
            scope: "WEAK_WORDS",
            topicIds: [],
            skillFocus: "ADAPTIVE",
          }
        : null,
      sortedTopics[0]
        ? {
            id: "topic",
            title: `Luyện chủ đề ${sortedTopics[0].name}`,
            reason: "Chủ đề cần được củng cố",
            estimatedMinutes: 5,
            mode: "SMART_REVIEW",
            scope: "SMART_QUEUE",
            topicIds: [sortedTopics[0].topicId],
            skillFocus: "ADAPTIVE",
          }
        : null,
    ]
      .filter(Boolean)
      .slice(0, 3);
    const target = goal?.target ?? 10;
    const progress =
      goal?.type === "MINUTES"
        ? Math.round(today.reduce((s, a) => s + a.responseTimeMs, 0) / 60_000)
        : new Set(today.map((a) => a.vocabularyId)).size;
    return {
      dueToday,
      weakCount,
      masteredCount,
      reviewedToday: new Set(today.map((a) => a.vocabularyId)).size,
      accuracy7Days: answers.length
        ? Math.round(
            (answers.filter((a) => a.isCorrect).length / answers.length) * 100,
          )
        : 0,
      estimatedMinutes: Math.max(
        1,
        Math.ceil(Math.min(10, dueToday || weakCount) / 2),
      ),
      attentionWords,
      topics: topicStats,
      skills: skillStats,
      schedule: {
        today: dueToday,
        tomorrow: scheduleAt(1),
        next3Days: scheduleAt(3),
        next7Days: scheduleAt(7),
      },
      suggestions,
      activeSession: active
        ? {
            id: String(active._id),
            answered: active.answers.length,
            total: active.questions.length,
            startedAt: active.startedAt,
          }
        : null,
      goal: {
        type: goal?.type ?? "WORDS",
        target,
        progress,
        completed: progress >= target || dueToday === 0,
      },
    };
  }

  async createSession(userId: string, input: CreateReviewSessionInput) {
    const active = await VocabularyReviewSessionModel.findOne({
      userId,
      status: "ACTIVE",
      expiresAt: { $gt: new Date() },
    });
    if (active) return { ...this.sessionDto(active), resumed: true };
    const size =
      input.selectionMode === "TIME"
        ? Math.min(50, Math.max(5, (input.targetMinutes ?? 5) * 2))
        : (input.wordCount ?? 10);
    const pool = await this.candidates(
      userId,
      input.scope,
      input.topicIds,
      input.includeMastered,
      input.recentDays,
    );
    let selected =
      input.scope === "SMART_QUEUE"
        ? this.chooseSmart(pool, size)
        : this.rank(pool).slice(0, size);
    if (input.topicIds.length > 1)
      selected = this.balanceTopics(this.rank(selected), size);
    if (!selected.length)
      throw new AppError(
        "NO_REVIEW_WORDS",
        "Không có từ phù hợp với bộ lọc này",
        404,
      );
    const all = await this.candidates(
      userId,
      "FREE_REVIEW",
      input.topicIds,
      true,
    );
    const questions = selected.map((c, i) =>
      this.makeQuestion(
        c,
        all,
        input.mode === "QUICK_PRACTICE"
          ? "WORD_TO_MEANING"
          : this.chooseType(c, input.skillFocus, i),
      ),
    );
    const session = await VocabularyReviewSessionModel.create({
      userId,
      settings: input,
      questions,
      answers: [],
      expiresAt: new Date(
        Date.now() + REVIEW_CONFIG.sessionExpiryHours * 3_600_000,
      ),
    });
    return { ...this.sessionDto(session), resumed: false };
  }
  async getSession(userId: string, id: string) {
    const s = await VocabularyReviewSessionModel.findOne({ _id: id, userId });
    if (!s)
      throw new AppError(
        "REVIEW_SESSION_NOT_FOUND",
        "Không tìm thấy phiên ôn tập",
        404,
      );
    if (s.status === "ACTIVE" && s.expiresAt <= new Date()) {
      s.status = "EXPIRED";
      await s.save();
    }
    return this.sessionDto(s);
  }

  async answer(userId: string, id: string, input: SubmitReviewAnswerInput) {
    const s = await VocabularyReviewSessionModel.findOne({ _id: id, userId });
    if (!s)
      throw new AppError(
        "REVIEW_SESSION_NOT_FOUND",
        "Không tìm thấy phiên ôn tập",
        404,
      );
    if (s.status !== "ACTIVE")
      throw new AppError(
        "REVIEW_SESSION_CLOSED",
        "Phiên ôn tập đã kết thúc",
        409,
      );
    const questions = s.questions as unknown as StoredQuestion[];
    const q = questions.find((x) => x.id === input.questionId);
    if (!q)
      throw new AppError(
        "REVIEW_QUESTION_NOT_FOUND",
        "Không tìm thấy câu hỏi",
        404,
      );
    if (q.answered)
      throw new AppError(
        "REVIEW_ANSWER_DUPLICATE",
        "Câu hỏi đã được trả lời",
        409,
      );
    const claim = await VocabularyReviewSessionModel.updateOne(
      {
        _id: s._id,
        userId,
        status: "ACTIVE",
        questions: { $elemMatch: { id: q.id, answered: false } },
      },
      { $set: { "questions.$.answered": true } },
    );
    if (claim.modifiedCount !== 1)
      throw new AppError(
        "REVIEW_ANSWER_DUPLICATE",
        "Câu hỏi đã được trả lời",
        409,
      );
    const typed = normalizeReviewAnswer(input.typedAnswer ?? "");
    const exact = q.acceptedAnswers.includes(typed);
    const nearly =
      !exact &&
      typed.length >= 6 &&
      q.acceptedAnswers.some((a) => editDistance(typed, a) === 1);
    const isCorrect = q.options.length
      ? input.selectedOptionId === q.correctOptionId
      : exact || nearly;
    const uv = await UserVocabularyModel.findOne({
      userId,
      vocabularyId: q.vocabularyId,
    });
    if (!uv)
      throw new AppError(
        "VOCABULARY_NOT_LEARNED",
        "Từ này không thuộc kho từ đã học",
        404,
      );
    const threshold = REVIEW_CONFIG.defaultResponseMs[q.type];
    const quality: AnswerQuality = !isCorrect
      ? "FAIL"
      : q.isRetry
        ? "RETRY_CORRECT"
        : nearly || input.usedHint
          ? "HARD"
          : input.responseTimeMs <= threshold * 0.65 && uv.correctStreak >= 3
            ? "EASY"
            : "GOOD";
    const before = uv.reviewLevel;
    let after = before;
    let nextReviewAt = uv.nextReviewAt;
    if (!q.isRetry) {
      const currentStreak = uv.correctStreak ?? 0;
      const lapse =
        (uv.lapseCount ?? 0) +
        (!isCorrect && (uv.status === "MASTERED" || currentStreak >= 2)
          ? 1
          : 0);
      const next = calculateAdaptiveReview(before, quality, lapse);
      after = next.level;
      nextReviewAt = next.nextReviewAt;
      const streak = isCorrect ? currentStreak + 1 : 0;
      const average = uv.reviewCount
        ? Math.round(
            ((uv.averageResponseTimeMs ?? 0) * uv.reviewCount +
              input.responseTimeMs) /
              (uv.reviewCount + 1),
          )
        : input.responseTimeMs;
      await UserVocabularyModel.updateOne(
        { _id: uv._id },
        {
          $set: {
            reviewLevel: after,
            nextReviewAt,
            correctStreak: streak,
            lapseCount: lapse,
            averageResponseTimeMs: average,
            lastQuestionType: q.type,
            lastAnswerQuality: quality,
            lastReviewedAt: new Date(),
            status: after === 5 && streak >= 3 ? "MASTERED" : "LEARNED",
          },
          $inc: {
            reviewCount: 1,
            correctCount: isCorrect ? 1 : 0,
            incorrectCount: isCorrect ? 0 : 1,
          },
        },
      );
    }
    q.answered = true;
    const answer: StoredAnswer = {
      questionId: q.id,
      vocabularyId: q.vocabularyId,
      questionType: q.type,
      isRetry: q.isRetry,
      isCorrect,
      answerQuality: quality,
      responseTimeMs: input.responseTimeMs,
      usedHint: input.usedHint,
      masteryBefore: before,
      masteryAfter: after,
      answeredAt: new Date().toISOString(),
    };
    s.answers.push(answer);
    if (!isCorrect && !q.isRetry && s.settings.mode !== "TEST_MODE") {
      const all = await this.candidates(
        userId,
        "FREE_REVIEW",
        s.settings.topicIds,
        true,
      );
      const original = all.find(
        (x) => String(x.vocabularyId._id) === q.vocabularyId,
      );
      if (original)
        questions.splice(
          Math.min(
            questions.length,
            questions.indexOf(q) + REVIEW_CONFIG.retryDelayQuestions + 1,
          ),
          0,
          this.makeQuestion(
            original,
            all,
            q.type === "WORD_TO_MEANING"
              ? "MEANING_TO_WORD"
              : "WORD_TO_MEANING",
            q.id,
          ),
        );
    }
    s.markModified("questions");
    s.markModified("answers");
    await s.save();
    const next = questions.find((x) => !x.answered);
    const common = {
      accepted: true,
      progress: { answered: s.answers.length, total: questions.length },
      nextQuestion: next ? this.publicQuestion(next) : null,
    };
    if (s.settings.mode === "TEST_MODE") return common;
    return {
      ...common,
      isCorrect,
      answerQuality: quality,
      correctAnswer: {
        word: q.word,
        meaning: q.meaning,
        partOfSpeech: q.partOfSpeech,
        example: q.example,
        exampleMeaning: q.exampleMeaning,
      },
      mastery: { before, after },
      nextReviewAt,
      explanation:
        quality === "FAIL"
          ? "Chưa chính xác. Từ này sẽ quay lại sau vài câu."
          : quality === "HARD"
            ? "Đúng, nhưng bạn cần thêm một lần củng cố."
            : "Chính xác. Lịch ôn đã được cập nhật.",
      retryScheduled: !isCorrect && !q.isRetry,
    };
  }

  private summary(s: {
    answers: Record<string, unknown>[];
    xpEarned: number;
    startedAt: Date;
    completedAt?: Date;
  }) {
    const primary = (s.answers as unknown as StoredAnswer[]).filter(
      (a) => !a.isRetry,
    );
    const correct = primary.filter((a) => a.isCorrect).length;
    let streak = 0,
      longestStreak = 0;
    primary.forEach((a) => {
      streak = a.isCorrect ? streak + 1 : 0;
      longestStreak = Math.max(longestStreak, streak);
    });
    const grouped = new Map<string, { c: number; t: number }>();
    primary.forEach((a) => {
      const x = grouped.get(a.questionType) ?? { c: 0, t: 0 };
      x.t++;
      if (a.isCorrect) x.c++;
      grouped.set(a.questionType, x);
    });
    return {
      reviewedWords: primary.length,
      correct,
      incorrect: primary.length - correct,
      accuracy: primary.length
        ? Math.round((correct / primary.length) * 100)
        : 0,
      durationSeconds: Math.max(
        1,
        Math.round(
          ((s.completedAt?.getTime() ?? Date.now()) - s.startedAt.getTime()) /
            1000,
        ),
      ),
      longestStreak,
      xpEarned: s.xpEarned,
      masteryUp: primary.filter((a) => a.masteryAfter > a.masteryBefore).length,
      masteryDown: primary.filter((a) => a.masteryAfter < a.masteryBefore)
        .length,
      weakestSkill:
        [...grouped.entries()].sort(
          (a, b) => a[1].c / a[1].t - b[1].c / b[1].t,
        )[0]?.[0] ?? null,
      wrongVocabularyIds: primary
        .filter((a) => !a.isCorrect)
        .map((a) => a.vocabularyId),
      answers: primary,
    };
  }
  async complete(userId: string, id: string) {
    const s = await VocabularyReviewSessionModel.findOne({ _id: id, userId });
    if (!s)
      throw new AppError(
        "REVIEW_SESSION_NOT_FOUND",
        "Không tìm thấy phiên ôn tập",
        404,
      );
    if (s.status === "COMPLETED")
      return { summary: this.summary(s), rewards: { xpEarned: s.xpEarned } };
    if (s.status !== "ACTIVE")
      throw new AppError(
        "REVIEW_SESSION_CLOSED",
        "Phiên ôn tập đã kết thúc",
        409,
      );
    if ((s.questions as unknown as StoredQuestion[]).some((q) => !q.answered))
      throw new AppError(
        "REVIEW_SESSION_INCOMPLETE",
        "Hãy hoàn thành các câu hỏi còn lại",
        409,
      );
    const primary = (s.answers as unknown as StoredAnswer[]).filter(
      (a) => !a.isRetry,
    );
    const xpEarned = Math.min(
      REVIEW_CONFIG.maxSessionXp,
      REVIEW_CONFIG.xpBase + primary.filter((a) => a.isCorrect).length,
    );
    const completedAt = new Date();
    const completed = await VocabularyReviewSessionModel.findOneAndUpdate(
      { _id: s._id, userId, status: "ACTIVE" },
      { $set: { status: "COMPLETED", completedAt, xpEarned } },
      { returnDocument: "after" },
    );
    if (!completed) {
      const latest = await VocabularyReviewSessionModel.findOne({
        _id: id,
        userId,
      });
      if (latest?.status === "COMPLETED")
        return {
          summary: this.summary(latest),
          rewards: { xpEarned: latest.xpEarned },
        };
      throw new AppError(
        "REVIEW_SESSION_CLOSED",
        "Phiên ôn tập đã kết thúc",
        409,
      );
    }
    let rewards: Record<string, number> = { xpEarned };
    if (!completed.xpGrantedAt) {
      const user = await this.userRepository.findById(userId);
      if (user) {
        const stats = await this.userStatsService.applyLessonCompletionStats(
          userId,
          user.stats,
          xpEarned,
          0,
          completedAt,
        );
        rewards = {
          xpEarned,
          totalXp: stats.totalXp,
          level: stats.level,
          currentStreak: effectiveCurrentStreak(stats),
        };
      }
      completed.xpGrantedAt = new Date();
      await completed.save();
    }
    return { summary: this.summary(completed), rewards };
  }
  async exit(userId: string, id: string, finish: boolean) {
    const s = await VocabularyReviewSessionModel.findOne({ _id: id, userId });
    if (!s)
      throw new AppError(
        "REVIEW_SESSION_NOT_FOUND",
        "Không tìm thấy phiên ôn tập",
        404,
      );
    if (finish && s.status === "ACTIVE") {
      s.status = "EXITED";
      s.exitedAt = new Date();
      await s.save();
    }
    return {
      saved: !finish,
      status: s.status,
      progress: { answered: s.answers.length, total: s.questions.length },
    };
  }
  async setBookmark(
    userId: string,
    vocabularyId: string,
    isBookmarked: boolean,
  ) {
    const item = await UserVocabularyModel.findOneAndUpdate(
      { userId, vocabularyId },
      { $set: { isBookmarked } },
      { returnDocument: "after" },
    );
    if (!item)
      throw new AppError(
        "VOCABULARY_NOT_LEARNED",
        "Từ này không thuộc kho từ đã học",
        404,
      );
    return { vocabularyId, isBookmarked: item.isBookmarked };
  }
  async setGoal(
    userId: string,
    input: { type: "WORDS" | "MINUTES"; target: number },
  ) {
    const goal = await VocabularyReviewGoalModel.findOneAndUpdate(
      { userId },
      { $set: input },
      { upsert: true, returnDocument: "after" },
    );
    return { type: goal.type, target: goal.target };
  }
  async getReviewStats(userId: string) {
    const d = await this.getDashboard(userId);
    return {
      dueToday: d.dueToday,
      weakCount: d.weakCount,
      masteredCount: d.masteredCount,
      reviewedToday: d.reviewedToday,
      accuracy7Days: d.accuracy7Days,
    };
  }
}
