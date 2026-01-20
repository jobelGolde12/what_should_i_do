You are an AI engineer tasked with refactoring and improving an existing project.

Primary Objectives

Replace WebLLM Completely

Remove WebLLM and all related logic, dependencies, and configurations from the project.

Ensure the application uses only the OpenRouter API for all LLM interactions.

OpenRouter API Integration with Fallback Logic

The project already contains three OpenRouter API keys stored in the .env file:

OPENROUTER_API_KEY1

OPENROUTER_API_KEY2

OPENROUTER_API_KEY3

Implement a robust API key rotation mechanism with the following behavior:

Attempt requests using OPENROUTER_API_KEY1.

If the request fails due to credit exhaustion, rate limits, authentication errors, or network failures, automatically retry using OPENROUTER_API_KEY2.

If the second key fails, retry with OPENROUTER_API_KEY3.

Gracefully handle the case where all keys fail by returning a clear and user-friendly error message.

Ensure the retry logic avoids infinite loops and logs which key failed and why (without exposing secrets).

Improved Analysis and Understanding Logic

Enhance the AI’s analysis pipeline so it can reliably interpret:

Messy, incomplete, or poorly structured user input

Ambiguous, confusing, or mixed-intent messages

Inputs with grammar issues, shorthand, or informal language

The AI should:

Normalize and restructure the input into a clear, understandable intent

Infer missing context when reasonable

Explicitly clarify assumptions in the analysis before generating a response

Ensure the final output meets the original user requirements as accurately as possible

Reliability and Quality Guarantees

Validate user requirements during analysis before generating a final answer.

If requirements conflict or are unclear, resolve them logically instead of failing silently.

Prioritize correctness, stability, and graceful error handling over speed.

Expected Outcome

The project fully relies on OpenRouter API with automatic API key fallback.

WebLLM is fully removed.

The AI produces clear, structured, and accurate responses, even when user input is confusing or poorly written.

The system is production-ready, maintainable, and resilient to API failures.