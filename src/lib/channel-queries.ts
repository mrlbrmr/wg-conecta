import { queryOptions } from "@tanstack/react-query";
import { getMySubmission, listMySubmissions } from "@/lib/channel.functions";

/** SIMs que a pessoa enviou com o nome — os anônimos não têm como aparecer aqui. */
export const mySubmissionsQuery = queryOptions({
  queryKey: ["my-channel-submissions"],
  queryFn: () => listMySubmissions(),
});

export const mySubmissionQuery = (id: string) =>
  queryOptions({
    queryKey: ["my-channel-submissions", id],
    queryFn: () => getMySubmission({ data: { id } }),
  });
