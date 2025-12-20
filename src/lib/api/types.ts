//------------ shared --------------

export type UUID = string;
export type ISODateTimeString = string;
export type InterviewSeniority = 'intern' | 'junior' | 'intermediate' | 'senior' | 'lead' | string;
export type InterviewStyle = 'balance' | 'behavioral' | 'technical' | string;
export type InterviewStatus = 'not_started' | 'in_porgress' | 'completed' | string;
export type GradinStatus = 'pending' | 'graded' | 'failed' | string;

export interface InterviewStartRequest{
    candidate_email: string;
    role: string;
    seniority?: InterviewSeniority;
    style?: InterviewStyle;
}

export interface InterviewStartResponse {
    interview_id: UUID;
}

export interface IngestPasteRequest {
    interview_id: UUID;
    user_email: string;
    pasted_texts: string;
    job_description?: string | null;
}

export interface IngestPasteResponse {
    interview_id: UUID;
    sources: number;
    chunks_indexed: number;
}

export interface SearchRequest {
    interview_id:UUID;
    query: string;
    k?: number;
    max_distance?: number | null;
}

export interface SearchHit {
    chunk_id: UUID;
    source_id: UUID;
    content: string;
    score: number;
    similarity: number;
}

export interface SearchResponse {
    hits: SearchHit[];
}

export type QuestionType = 'technical' | 'behavioral' | 'system' | 'other' | string;

export interface GenerateQuestionsRequest {
    interview_id: UUID;
    count?: number;
    style?: InterviewStyle;
    focus?: string | null;
    k?: number;
    max_chars?: number;
}

export interface PersistedQuestion {
    question_id: UUID;
    index: number;
    type: QuestionType;
    question: string;
    rubric: string;
}

export interface GenerateQuestionsResponse {
    interview_id: UUID;
    generated_count: number;
    context_preview: string;
    questions: PersistedQuestion[];
}

export interface NextQuestionRequest {
    interview_id: UUID;
}

export interface NextQuestionResponse {
    interview_id: UUID;
    question_id: UUID | null;
    index: number | null;
    type: QuestionType | null;
    question: string | null;
    remaining: number;
    status: InterviewStatus;
}

export interface AnswerRequest {
    interview_id: UUID;
    question_id: UUID;
    answer_text: string;
}

export interface AnswerResponse {
    answer_id: UUID;
    interview_id: UUID;
    question_id: UUID;
    created_at: ISODateTimeString;
    graded_at: ISODateTimeString | null;
    numeric_score: number | null;
    label: string | null;
    feedback: string | null;
    graded_model: string | null;
}

export interface InterviewStatusRequest {
    interview_id: UUID;
}

export interface InterviewStatusResponse {
    interview_id: UUID;
    total_questions: number;
    answered_count: number;
    graded_answer_count: number;
    remaining_answer_count: number;
    avg_score: number | null;
    status: InterviewStatus;
    pending_count: number;
    failed_count: number;
}

export interface InterviewResultRequest {
    interview_id: UUID;
}

export interface InterviewResultItem {
    question_id: UUID;
    index: number;
    type: QuestionType;
    question: string;
    answer_id: UUID | null;
    answer_text: string | null;
    numeric_score: number | null;
    label: string | null;
    feedback: string | null;
    created_at: ISODateTimeString | null;
    graded_at: ISODateTimeString | null;
    grading_status: GradinStatus | null;
}

export interface InterviewResultResponse {
    interview_id: UUID;
    total_questions: number;
    answered_count: number;
    graded_answer_count: number;
    remaining_answer_count: number;
    avg_score: number | null;
    status: InterviewStatus;
    results: InterviewResultItem[];
}

export interface InterviewSummaryRequest {
    interview_id: UUID;
}

export interface InterviewSummaryResponse {
    interview_id: UUID;
    summary_text: string;
    summary_model: string;
    summary_generated_at: ISODateTimeString;
    total_questions: number;
    answered_count: number;
    graded_count: number;
    failed_count: number;
    avg_score: number | null;
}