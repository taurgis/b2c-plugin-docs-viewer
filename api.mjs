import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const api = require("./dist/index.js");

export const createHelpDocsSession = api.createHelpDocsSession;
export const readHelpDoc = api.readHelpDoc;
export const resolveHelpDoc = api.resolveHelpDoc;
export const searchHelpDocs = api.searchHelpDocs;

export const ArticleNotFoundError = api.ArticleNotFoundError;
export const BrowserLaunchError = api.BrowserLaunchError;
export const ExtractedContentTooShortError = api.ExtractedContentTooShortError;
export const HelpDocReadFailedError = api.HelpDocReadFailedError;
export const HelpDocsApiError = api.HelpDocsApiError;
export const HELP_DOCS_ERROR_CODES = api.HELP_DOCS_ERROR_CODES;
export const InvalidUrlError = api.InvalidUrlError;
export const SearchFailedError = api.SearchFailedError;
export const UnsupportedHostError = api.UnsupportedHostError;
export const UnsupportedProtocolError = api.UnsupportedProtocolError;
export const getHelpDocsErrorCode = api.getHelpDocsErrorCode;

export default api;