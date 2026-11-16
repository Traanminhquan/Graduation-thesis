import { defineMessages } from "../config";

/** Text shared by every page: the header, navigation, footer and language switch. */
export const commonMessages = defineMessages({
  en: {
    site: {
      tagline: "English practice, marked and explained",
      description:
        "A single place to practise reading, listening, writing and speaking, with clear feedback and progress tracking.",
      homeLabel: (name: string) => `${name}, home`,
    },
    nav: {
      reading: "Reading",
      listening: "Listening",
      writing: "Writing",
      speaking: "Speaking",
      conversation: "Conversation",
      progress: "Progress",
      profile: "Profile",
      primary: "Primary",
      footer: "Footer",
    },
    auth: {
      logIn: "Log in",
      signUp: "Sign up",
      logOut: "Log out",
      loggingOut: "Logging out…",
    },
    skipToContent: "Skip to content",
    language: {
      switchTo: "Tiếng Việt",
      switchLabel: "Chuyển giao diện sang tiếng Việt",
    },
  },
  vi: {
    site: {
      tagline: "Luyện tiếng Anh, có chấm và giải thích",
      description:
        "Một nơi để luyện đọc, nghe, viết và nói tiếng Anh, có nhận xét rõ ràng và theo dõi tiến độ.",
      homeLabel: (name: string) => `${name}, trang chủ`,
    },
    nav: {
      reading: "Đọc",
      listening: "Nghe",
      writing: "Viết",
      speaking: "Nói",
      conversation: "Hội thoại",
      progress: "Tiến độ",
      profile: "Hồ sơ",
      primary: "Điều hướng chính",
      footer: "Chân trang",
    },
    auth: {
      logIn: "Đăng nhập",
      signUp: "Đăng ký",
      logOut: "Đăng xuất",
      loggingOut: "Đang đăng xuất…",
    },
    skipToContent: "Chuyển đến nội dung chính",
    language: {
      switchTo: "English",
      switchLabel: "Switch the interface to English",
    },
  },
});
