import type { VocabularyDifficulty } from "../types/vocabulary.types.js";
import type { QuestionType } from "../types/question.types.js";

export interface VocabSeed {
    word: string;
    meaning: string;
    phonetic: string;
    partOfSpeech: string;
    example: string;
    exampleMeaning: string;
}

export const VOCAB_DATABASE: Record<string, VocabSeed[]> = {
    greeting: [
        { word: "greeting", meaning: "lời chào hỏi", phonetic: "/ˈɡriː.tɪŋ/", partOfSpeech: "noun", example: "He sent a warm greeting to everyone.", exampleMeaning: "Anh ấy gửi lời chào ấm áp đến mọi người." },
        { word: "introduce", meaning: "giới thiệu", phonetic: "/ˌɪn.trəˈdjuːs/", partOfSpeech: "verb", example: "Let me introduce my friend to you.", exampleMeaning: "Để tôi giới thiệu bạn của tôi với bạn." },
        { word: "pleasure", meaning: "hân hạnh, niềm vinh hạnh", phonetic: "/ˈpleʒ.ər/", partOfSpeech: "noun", example: "It is a pleasure to meet you.", exampleMeaning: "Rất hân hạnh được gặp bạn." },
        { word: "welcome", meaning: "chào mừng", phonetic: "/ˈwel.kəm/", partOfSpeech: "interjection", example: "Welcome to our English class!", exampleMeaning: "Chào mừng bạn đến với lớp học tiếng Anh của chúng tôi!" },
        { word: "conversation", meaning: "cuộc trò chuyện", phonetic: "/ˌkɒn.vəˈseɪ.ʃən/", partOfSpeech: "noun", example: "They had an interesting conversation.", exampleMeaning: "Họ đã có một cuộc trò chuyện thú vị." },
        { word: "polite", meaning: "lịch sự", phonetic: "/pəˈlaɪt/", partOfSpeech: "adjective", example: "Always be polite when greeting others.", exampleMeaning: "Luôn lịch sự khi chào hỏi người khác." },
        { word: "handshake", meaning: "cái bắt tay", phonetic: "/ˈhænd.ʃeɪk/", partOfSpeech: "noun", example: "A firm handshake shows confidence.", exampleMeaning: "Một cái bắt tay chặt thể hiện sự tự tin." },
        { word: "farewell", meaning: "lời tạm biệt", phonetic: "/ˌfeəˈwel/", partOfSpeech: "noun", example: "They organized a farewell party.", exampleMeaning: "Họ đã tổ chức một bữa tiệc chia tay." }
    ],
    food: [
        { word: "delicious", meaning: "thơm ngon", phonetic: "/dɪˈlɪʃ.əs/", partOfSpeech: "adjective", example: "This soup tastes delicious.", exampleMeaning: "Món súp này có vị rất ngon." },
        { word: "beverage", meaning: "đồ uống", phonetic: "/ˈbev.ər.ɪdʒ/", partOfSpeech: "noun", example: "Fresh juice is a healthy beverage.", exampleMeaning: "Nước ép tươi là một loại đồ uống lành mạnh." },
        { word: "recipe", meaning: "công thức nấu ăn", phonetic: "/ˈres.ɪ.pi/", partOfSpeech: "noun", example: "Follow the recipe step by step.", exampleMeaning: "Làm theo công thức nấu ăn từng bước một." },
        { word: "ingredient", meaning: "nguyên liệu", phonetic: "/ɪnˈɡriː.di.ənt/", partOfSpeech: "noun", example: "Fresh ingredients make a huge difference.", exampleMeaning: "Nguyên liệu tươi tạo nên sự khác biệt lớn." },
        { word: "nutrition", meaning: "dinh dưỡng", phonetic: "/njuːˈtrɪʃ.ən/", partOfSpeech: "noun", example: "Vegetables provide essential nutrition.", exampleMeaning: "Rau củ cung cấp dinh dưỡng thiết yếu." },
        { word: "flavor", meaning: "hương vị", phonetic: "/ˈfleɪ.vər/", partOfSpeech: "noun", example: "This ice cream has a strawberry flavor.", exampleMeaning: "Món kem này có hương vị dâu tây." }
    ],
    travel: [
        { word: "destination", meaning: "điểm đến", phonetic: "/ˌdes.tɪˈneɪ.ʃən/", partOfSpeech: "noun", example: "Da Nang is a popular travel destination.", exampleMeaning: "Đà Nẵng là một điểm đến du lịch phổ biến." },
        { word: "itinerary", meaning: "lịch trình chuyến đi", phonetic: "/aɪˈtɪn.ər.ər.i/", partOfSpeech: "noun", example: "Check our travel itinerary for today.", exampleMeaning: "Hãy kiểm tra lịch trình du lịch hôm nay của chúng ta." },
        { word: "luggage", meaning: "hành lý", phonetic: "/ˈlʌɡ.ɪdʒ/", partOfSpeech: "noun", example: "Keep your luggage close to you.", exampleMeaning: "Hãy giữ hành lý gần bên bạn." },
        { word: "souvenir", meaning: "quà lưu niệm", phonetic: "/ˌsuː.vənˈɪər/", partOfSpeech: "noun", example: "I bought a handcrafted souvenir.", exampleMeaning: "Tôi đã mua một món quà lưu niệm thủ công." },
        { word: "passport", meaning: "hộ chiếu", phonetic: "/ˈpɑːs.pɔːt/", partOfSpeech: "noun", example: "Show your passport at the checkpoint.", exampleMeaning: "Xuất trình hộ chiếu tại điểm kiểm tra." }
    ],
    daily: [
        { word: "routine", meaning: "thói quen hàng ngày", phonetic: "/ruːˈtiːn/", partOfSpeech: "noun", example: "Morning exercise is part of my routine.", exampleMeaning: "Tập thể dục buổi sáng là một phần thói quen của tôi." },
        { word: "schedule", meaning: "lịch trình", phonetic: "/ˈʃed.juːl/", partOfSpeech: "noun", example: "I have a flexible work schedule.", exampleMeaning: "Tôi có lịch làm việc linh hoạt." },
        { word: "habit", meaning: "thói quen", phonetic: "/ˈhæb.ɪt/", partOfSpeech: "noun", example: "Reading books is a great habit.", exampleMeaning: "Đọc sách là một thói quen tuyệt vời." },
        { word: "activity", meaning: "hoạt động", phonetic: "/ækˈtɪv.ə.ti/", partOfSpeech: "noun", example: "Physical activity keeps you healthy.", exampleMeaning: "Hoạt động thể chất giúp bạn khỏe mạnh." }
    ]
};

export function mapLevelToDifficulty(level: string): VocabularyDifficulty {
    switch (level) {
        case "A1":
        case "A2":
            return "EASY";
        case "B1":
        case "B2":
            return "MEDIUM";
        case "C1":
        case "C2":
            return "HARD";
        default:
            return "EASY";
    }
}

export function normalizeQuestionType(typeStr: string): QuestionType {
    const upper = typeStr.toUpperCase();
    if (upper === "FILL_IN_BLANK" || upper === "FILL_BLANK") return "FILL_BLANK";
    if (upper === "REORDER" || upper === "ORDER_SENTENCE") return "ORDER_SENTENCE";
    if (upper === "MATCHING") return "MATCHING";
    if (upper === "TRANSLATION") return "TRANSLATION";
    if (upper === "LISTENING") return "LISTENING";
    return "MULTIPLE_CHOICE";
}

export function safeParseJsonArray(text: string): any[] {
    if (!text) return [];
    const clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    const jsonStr = match ? match[0] : clean;
    return JSON.parse(jsonStr);
}
