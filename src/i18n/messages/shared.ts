import { defineMessages } from "../config";

export const sharedMessages = defineMessages({
  en: {
    correct: "Correct. ",
    incorrect: "Incorrect. ",
    yourAnswer: "Your answer",
    correctAnswer: "Correct answer",
    yourScore: "Your score",
    noCorrections: "No corrections were needed in the text the assessment could check.",
    checking: "Checking…",
    submit: "Submit answers",
    answered: "answered",
    loadTitle: "This page could not load",
    loadBody: "The server did not respond as expected. Your saved work is not affected. Try again in a moment.",
    retry: "Try again",
    missingTitle: "Page not found",
    missingHeading: "This page does not exist",
    missingBody: "The link may be out of date, or this result belongs to a different account.",
    home: "Back to home",
    progress: "View your progress",
    answeredCount: (answered: number, total: number) => `${answered} of ${total}`,
    overallScore: (score: string) => `Overall score ${score} out of 100`,
    correctCount: (correct: number, total: number) => `${correct} of ${total} correct`,
    saved: (date: string) => `, saved ${date} UTC`,
    levels: {
      "A1": "A1 Beginner",
      "A2": "A2 Elementary",
      "B1": "B1 Intermediate",
      "B2": "B2 Upper intermediate",
      "C1": "C1 Advanced"
    },
    skills: {
      "reading": {
        "name": "Reading",
        "tagline": "Understand what you read",
        "description": "Read short passages and see the reason behind every answer.",
        "focusAreas": [
          "Passages",
          "Comprehension",
          "Vocabulary"
        ]
      },
      "listening": {
        "name": "Listening",
        "tagline": "Train your ear",
        "description": "Listen at your own speed, answer, then check the transcript.",
        "focusAreas": [
          "Audio",
          "Detail",
          "Note-taking"
        ]
      },
      "writing": {
        "name": "Writing",
        "tagline": "Write with clarity",
        "description": "Write on a topic and get corrections with a reason for each.",
        "focusAreas": [
          "Prompts",
          "Structure",
          "Grammar"
        ]
      },
      "speaking": {
        "name": "Speaking",
        "tagline": "Speak with confidence",
        "description": "Record your answer and get feedback on what you said.",
        "focusAreas": [
          "Prompts",
          "Transcript",
          "Content"
        ]
      }
    },
  },
  vi: {
    correct: "Đúng. ",
    incorrect: "Sai. ",
    yourAnswer: "Câu trả lời của bạn",
    correctAnswer: "Đáp án đúng",
    yourScore: "Điểm của bạn",
    noCorrections: "Không cần sửa lỗi trong phần văn bản có thể chấm điểm.",
    checking: "Đang kiểm tra…",
    submit: "Nộp bài",
    answered: "đã trả lời",
    loadTitle: "Không thể tải trang này",
    loadBody: "Máy chủ không phản hồi như dự kiến. Bài đã lưu của bạn không bị ảnh hưởng. Hãy thử lại sau giây lát.",
    retry: "Thử lại",
    missingTitle: "Không tìm thấy trang",
    missingHeading: "Trang này không tồn tại",
    missingBody: "Liên kết có thể đã cũ hoặc kết quả này thuộc về tài khoản khác.",
    home: "Về trang chủ",
    progress: "Xem tiến độ của bạn",
    answeredCount: (answered: number, total: number) => `${answered}/${total}`,
    overallScore: (score: string) => `Tổng điểm ${score} trên 100`,
    correctCount: (correct: number, total: number) => `Đúng ${correct}/${total} câu`,
    saved: (date: string) => `, đã lưu ${date} UTC`,
    levels: {
      "A1": "A1 Mới bắt đầu",
      "A2": "A2 Sơ cấp",
      "B1": "B1 Trung cấp",
      "B2": "B2 Trung cao cấp",
      "C1": "C1 Cao cấp"
    },
    skills: {
      "reading": {
        "name": "Đọc",
        "tagline": "Hiểu điều bạn đọc",
        "description": "Đọc các đoạn văn ngắn và xem lý do cho từng câu trả lời.",
        "focusAreas": [
          "Đoạn văn",
          "Đọc hiểu",
          "Từ vựng"
        ]
      },
      "listening": {
        "name": "Nghe",
        "tagline": "Rèn luyện kỹ năng nghe",
        "description": "Nghe theo tốc độ của bạn, trả lời rồi xem bản chép lời.",
        "focusAreas": [
          "Âm thanh",
          "Chi tiết",
          "Ghi chú"
        ]
      },
      "writing": {
        "name": "Viết",
        "tagline": "Viết rõ ràng",
        "description": "Viết theo đề bài và xem lỗi được sửa cùng lý do.",
        "focusAreas": [
          "Đề bài",
          "Bố cục",
          "Ngữ pháp"
        ]
      },
      "speaking": {
        "name": "Nói",
        "tagline": "Nói tự tin",
        "description": "Ghi âm câu trả lời và nhận nhận xét về điều bạn nói.",
        "focusAreas": [
          "Đề bài",
          "Bản chép lời",
          "Nội dung"
        ]
      }
    },
  },
});
