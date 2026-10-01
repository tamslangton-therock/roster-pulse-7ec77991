import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchInterestList,
  writeInterestList,
  type InterestDef,
} from "@/lib/sheets.functions";

export const DEFAULT_INTERESTS: InterestDef[] = [
  { name: "Life Groups", emoji: "👥" },
  { name: "New Partners Dinner", emoji: "🍽️" },
  { name: "Alpha", emoji: "❓" },
  { name: "Baptism", emoji: "🌊" },
  { name: "More about God", emoji: "✝️" },
  { name: "Serving", emoji: "🤝" },
];

export function useInterestList() {
  const { data, isLoading } = useQuery({
    queryKey: ["discipleship-interests"],
    queryFn: async () => await fetchInterestList(),
    staleTime: 30_000,
  });
  const interests: InterestDef[] = data ?? DEFAULT_INTERESTS;
  return { interests, isLoading };
}

export function useSaveInterestList() {
  const queryClient = useQueryClient();
  return async (interests: InterestDef[]) => {
    queryClient.setQueryData(["discipleship-interests"], interests);
    await writeInterestList({ data: { interests } });
  };
}

export function interestEmoji(emoji: string | undefined, name: string): string {
  if (emoji && emoji.trim()) return emoji;
  const legacy: Record<string, string> = {
    "Life Groups": "👥",
    "New Partners Dinner": "🍽️",
    Alpha: "❓",
    Baptism: "🌊",
    "More about God": "✝️",
    Serving: "🤝",
  };
  return legacy[name] ?? "•";
}
