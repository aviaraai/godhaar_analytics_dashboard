import { z } from "zod";
import type { SearchFilters } from "@/lib/types";

const analyticsSchemaRow = z.object({
  user_id: z.string(),
  total_farmers: z.number(),
  total_animals: z.number(),
  total_assigned: z.number(),
  total_unassigned: z.number(),
});

const analyticsSchema = z.array(analyticsSchemaRow);

const errorSchema = z.object({ message: z.string() });

export type AnalyticsResult = z.infer<typeof analyticsSchema>;

export async function getAnalytics(
  filters: SearchFilters,
): Promise<AnalyticsResult> {
  let response: Response;
  let data;
  try {
    const searchParams = new URLSearchParams();
    const params: Record<string, string | undefined> = {
      state: filters.state,
      district: filters.district,
      mandal: filters.mandal,
      from_date: filters.fromDate,
      to_date: filters.toDate,
    };
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        searchParams.set(key, value);
      }
    }
    const query = searchParams.toString();
    const url = `/api/web/v1/analytics${query ? `?${query}` : ""}`;
    response = await fetch(url);
    data = await response.json();
  } catch {
    throw new Error("Network error");
  }

  if (!response.ok) {
    const parsed = errorSchema.safeParse(data);
    const errMsg = parsed.success
      ? parsed.data.message
      : "something went wrong, please try again";
    throw new Error(`Server error, ${errMsg}`);
  }

  const parsed = analyticsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid response from server");
  }
  return parsed.data;
}
