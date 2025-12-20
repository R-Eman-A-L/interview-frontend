import { fetchJson } from "./client";
import type {
    SearchRequest,
    SearchResponse
} from "./types"

export async function searchInterview(req:SearchRequest): Promise<SearchResponse> {
    return fetchJson<SearchResponse>('/search', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}