import ko from "@/messages/ko.json";
import en from "@/messages/en.json";

const messages: Record<string, typeof ko> = { ko, en };

export function useTranslation(lang: string) {
  const t = messages[lang] || messages.en;
  return { t };
}
