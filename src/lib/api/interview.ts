import { fetchJson } from "./client";
import type {
    InterviewStartRequest,
    InterviewStartResponse,
    NextQuestionRequest,
    NextQuestionResponse,
    AnswerRequest,
    AnswerResponse,
    InterviewStatusRequest,
    InterviewStatusResponse,
    InterviewResultRequest,
    InterviewResultResponse,
    InterviewSummaryRequest,
    InterviewSummaryResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse
}from './types';

export async function startInterview(req: InterviewStartRequest): Promise<InterviewStartResponse> {
    return fetchJson<InterviewStartResponse>('/interview/start', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}

export async function generateQuestions(req:GenerateQuestionsRequest): Promise<GenerateQuestionsResponse> {
    return fetchJson<GenerateQuestionsResponse>('/interview/question/generate', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}

export async function nextQuestion(req:NextQuestionRequest): Promise<NextQuestionResponse> {
    return fetchJson<NextQuestionResponse>('/interview/nextquestion', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}

export async function answerQuestion(req:AnswerRequest): Promise<AnswerResponse> {
    return fetchJson<AnswerResponse>('/interview/answer', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}

export async function getInterviewStatus(req:InterviewStatusRequest): Promise<InterviewStatusResponse> {
    return fetchJson<InterviewStatusResponse>('/interview/status', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}

export async function getInterviewResults(req:InterviewResultRequest): Promise<InterviewResultResponse> {
    return fetchJson<InterviewResultResponse>('/interview/results', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}

export async function getInterviewSummary(req:InterviewSummaryRequest): Promise<InterviewSummaryResponse> {
    return fetchJson<InterviewSummaryResponse>('/interview/summary', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}

export async function getInterviewMetaData(inteeriview_id:string): Promise<{candidate_email: string}> {
    return fetchJson<{candidate_email: string}>('/inter/meta', {
        method: 'POST',
        body: JSON.stringify({inteeriview_id})
    });
}