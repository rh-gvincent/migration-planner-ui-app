import { ResponseError } from "@openshift-migration-advisor/planner-sdk";

/**
 * Parses an error from an API response, attempting to extract a meaningful message.
 * Handles ResponseError instances by parsing the response body as JSON if possible.
 *
 * @param err - The error to parse (can be ResponseError, Error, or unknown)
 * @param fallbackMessage - Default message to use if error parsing fails
 * @returns A normalized Error object with an appropriate message
 */
export async function parseApiError(
  err: unknown,
  fallbackMessage = "An error occurred",
): Promise<Error> {
  if (err instanceof ResponseError) {
    try {
      const responseText = await err.response.text();
      let message = responseText;

      try {
        const parsed: unknown = JSON.parse(responseText);
        if (
          parsed !== null &&
          typeof parsed === "object" &&
          "message" in parsed &&
          typeof (parsed as Record<string, unknown>).message === "string"
        ) {
          message = (parsed as Record<string, unknown>).message as string;
        }
      } catch {
        // Not JSON, use the raw text
      }

      return new Error(message || err.message);
    } catch {
      return new Error(err.message);
    }
  }

  if (err instanceof Error) {
    return err;
  }

  return new Error(fallbackMessage);
}

const duplicateAssessmentNamePattern =
  /assessment with name\s+(["'])(.*?)\1\s+already exists/i;

/**
 * Returns `true` when the error message indicates a name-related validation
 * failure from the backend (duplicate name or invalid characters).
 */
export const isNameError = (error: Error | null): boolean => {
  if (!error) return false;
  const msg = error.message || "";
  return (
    duplicateAssessmentNamePattern.test(msg) ||
    /provided name.+invalid/i.test(msg)
  );
};

/** Turns backend name errors into a message suitable for the assessment form. */
export const getAssessmentNameErrorMessage = (
  error: Error | null,
): string | null => {
  if (!error || !isNameError(error)) {
    return null;
  }

  const duplicateName = error.message.match(duplicateAssessmentNamePattern);
  if (duplicateName) {
    return `The assessment with name ${duplicateName[2]} already exists.`;
  }

  return error.message;
};
