import { fetchJson } from "./client";
import type {
    IngestPasteRequest,
    IngestPasteResponse
} from './types';

export async function ingestPaste(req:IngestPasteRequest): Promise<IngestPasteResponse> {
    return fetchJson<IngestPasteResponse>('/ingest/paste', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}