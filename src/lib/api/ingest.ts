import { fetchJson } from "./client";
import type {
    IngestPasteRequest,
    IngestPasteResponse
} from './types';

export async function IngestPaste(req:IngestPasteRequest): Promise<IngestPasteResponse> {
    return fetchJson<IngestPasteResponse>('/ingest/paste', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}