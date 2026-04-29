type HelpDocsApiErrorOptions = {
  cause?: unknown;
  details?: Record<string, unknown>;
};

export const HELP_DOCS_ERROR_CODES = {
  INVALID_URL: "INVALID_URL",
  UNSUPPORTED_PROTOCOL: "UNSUPPORTED_PROTOCOL",
  UNSUPPORTED_HOST: "UNSUPPORTED_HOST",
  ARTICLE_NOT_FOUND: "ARTICLE_NOT_FOUND",
  SEARCH_FAILED: "SEARCH_FAILED",
  HELP_DOC_READ_FAILED: "HELP_DOC_READ_FAILED",
  EXTRACTED_CONTENT_TOO_SHORT: "EXTRACTED_CONTENT_TOO_SHORT",
  BROWSER_LAUNCH_FAILED: "BROWSER_LAUNCH_FAILED",
} as const;

export type HelpDocsErrorCode =
  (typeof HELP_DOCS_ERROR_CODES)[keyof typeof HELP_DOCS_ERROR_CODES];

export class HelpDocsApiError extends Error {
  readonly code: HelpDocsErrorCode;
  readonly details?: Record<string, unknown>;
  declare readonly cause?: unknown;

  constructor(code: HelpDocsErrorCode, message: string, options?: HelpDocsApiErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = options?.details;
    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }
  }
}

export class InvalidUrlError extends HelpDocsApiError {
  constructor(
    message = "Invalid URL. Provide a valid Help or Developer docs URL.",
    options?: HelpDocsApiErrorOptions
  ) {
    super(HELP_DOCS_ERROR_CODES.INVALID_URL, message, options);
  }
}

export class UnsupportedProtocolError extends HelpDocsApiError {
  constructor(message = "Unsupported URL protocol. Use https URLs only.", options?: HelpDocsApiErrorOptions) {
    super(HELP_DOCS_ERROR_CODES.UNSUPPORTED_PROTOCOL, message, options);
  }
}

export class UnsupportedHostError extends HelpDocsApiError {
  constructor(
    message = "Unsupported host. Only help.salesforce.com and developer.salesforce.com are allowed.",
    options?: HelpDocsApiErrorOptions
  ) {
    super(HELP_DOCS_ERROR_CODES.UNSUPPORTED_HOST, message, options);
  }
}

export class ArticleNotFoundError extends HelpDocsApiError {
  constructor(
    message = "Article not found or unavailable at the provided URL.",
    options?: HelpDocsApiErrorOptions
  ) {
    super(HELP_DOCS_ERROR_CODES.ARTICLE_NOT_FOUND, message, options);
  }
}

export class SearchFailedError extends HelpDocsApiError {
  constructor(message = "Failed to search Salesforce documentation.", options?: HelpDocsApiErrorOptions) {
    super(HELP_DOCS_ERROR_CODES.SEARCH_FAILED, message, options);
  }
}

export class HelpDocReadFailedError extends HelpDocsApiError {
  constructor(message = "Failed to read Salesforce documentation.", options?: HelpDocsApiErrorOptions) {
    super(HELP_DOCS_ERROR_CODES.HELP_DOC_READ_FAILED, message, options);
  }
}

export class ExtractedContentTooShortError extends HelpDocsApiError {
  constructor(message = "Extracted content was too short.", options?: HelpDocsApiErrorOptions) {
    super(HELP_DOCS_ERROR_CODES.EXTRACTED_CONTENT_TOO_SHORT, message, options);
  }
}

export class BrowserLaunchError extends HelpDocsApiError {
  constructor(
    message = "Failed to launch the Playwright browser. Ensure the required browser binaries are installed.",
    options?: HelpDocsApiErrorOptions
  ) {
    super(HELP_DOCS_ERROR_CODES.BROWSER_LAUNCH_FAILED, message, options);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isArticleNotFoundMessage(message: string): boolean {
  return /error page detected/i.test(message) || /not found/i.test(message);
}

function isBrowserLaunchMessage(message: string): boolean {
  return /browsertype\.launch/i.test(message)
    || /failed to launch/i.test(message)
    || /executable doesn't exist/i.test(message)
    || /browser has been closed/i.test(message);
}

function mapKnownError(error: unknown): HelpDocsApiError | null {
  if (error instanceof HelpDocsApiError) {
    return error;
  }

  const message = describeError(error);

  if (/^Invalid URL\./i.test(message)) {
    return new InvalidUrlError(message, { cause: error });
  }

  if (/^Unsupported URL protocol\./i.test(message)) {
    return new UnsupportedProtocolError(message, { cause: error });
  }

  if (/^Unsupported host\./i.test(message)) {
    return new UnsupportedHostError(message, { cause: error });
  }

  if (/Extracted content was too short\./i.test(message)) {
    return new ExtractedContentTooShortError(message, { cause: error });
  }

  if (isArticleNotFoundMessage(message)) {
    return new ArticleNotFoundError(undefined, {
      cause: error,
      details: { originalMessage: message },
    });
  }

  if (isBrowserLaunchMessage(message)) {
    return new BrowserLaunchError(undefined, {
      cause: error,
      details: { originalMessage: message },
    });
  }

  return null;
}

export function getHelpDocsErrorCode(error: unknown): string | undefined {
  if (error instanceof HelpDocsApiError) {
    return error.code;
  }

  if (error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }

  return undefined;
}

export function toSearchHelpDocsError(error: unknown): HelpDocsApiError {
  return mapKnownError(error) || new SearchFailedError(undefined, {
    cause: error,
    details: { originalMessage: describeError(error) },
  });
}

export function toReadHelpDocError(error: unknown): HelpDocsApiError {
  return mapKnownError(error) || new HelpDocReadFailedError(undefined, {
    cause: error,
    details: { originalMessage: describeError(error) },
  });
}