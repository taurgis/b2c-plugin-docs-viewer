# OCAPI Global Exceptions

The following table lists all OCAPI global exceptions:

| Status | Type | Arguments | Description |
| --- | --- | --- | --- |
| 400 | BodyDecodingException | body (String) | The request document (body) couldn’t be decoded. |
| 400 | EnumConstraintViolationException | document (String)<br>enumValue (String) | Invalid enum value provided. |
| 400 | FieldNotSortableException | field (String) | The specified field isn’t sortable. |
| 400 | HookStatusException | extensionPoint (String)<br>statusCode (String)<br>statusMsg (String)<br>statusDetails (Map) | An OCAPI server-side extension point returned a status of type error. The exception contains details like extension point name, status code, status message, and custom status details. |
| 400 | IllegalEnumerationValueException | value (String)<br>type (String) | Illegal enum value provided for field type. |
| 400 | IllegalHttpMethodOverrideException | method (String) | The HTTP method provided via x-dw-http-method-override header or method query parameter isn’t allowed. HTTP methods 'PUT', 'PATCH', 'DELETE', 'HEAD' and 'OPTIONS' are supported as override method. |
| 400 | InvalidClientIdException | clientId (String) | The provided client id isn’t the expected one for this token request. |
| 400 | InvalidCustomPropertyException |  | Can’t write custom property. Value is either invalid or type doesn't support modification. |
| 400 | InvalidExpandValueException | expandValue (String) | The specified expand value isn’t allowed. |
| 400 | InvalidHostHeaderException | host (String) | The host name is invalid. Not contained in the server allow list. |
| 400 | InvalidSearchFieldTypeException | field (String)<br>value (String)<br>type (String) | The type of the search value doesn’t match the expected field type. |
| 400 | InvalidVersionException |  | Version is missing or malformed in request URL. |
| 400 | MalformedLocaleException | locale (String) | The specified locale is malformed. |
| 400 | MalformedMediaTypeException | mediaType (String) | The media type in Content-Type header is malformed. |
| 400 | MalformedParameterException | parameter (String)<br>value (String) | A query, header, or path parameter value is malformed. |
| 400 | MalformedSelectorException | selector (String) | The syntax of the specified selector is malformed. |
| 400 | MissingClientIdException |  | No client id was provided, neither as query nor as header parameter. |
| 400 | NullConstraintViolationException | parameter (String) | The query or path parameter value is required, but value was null. |
| 400 | PropertyConstraintViolationException | document (String)<br>path (String) | The value constraint of a document property is violated. |
| 400 | PropertyNotPermittedException | property (String)<br>document (String) | A property in the given request document isn’t permitted to be modified. |
| 400 | QuerySearchTypesNomatchException | field1 (String)<br>field2 (String)<br>type1 (String)<br>type2 (String) | The fields in the specified query don't have the same type. |
| 400 | QuotaExceededException | msg (String) | A platform quota constraint is violated. |
| 400 | RangeFilterTypeException | field (String)<br>type (String) | The specified field type isn’t comparable in a range expression. |
| 400 | RangeFilterValueException | field (String)<br>value (String) | The specified value isn’t comparable in a range expression. |
| 400 | ResourcePathException | message (String) | The resource path was incorrect. |
| 400 | SearchOperatorNotApplicableException | operator (String)<br>field (String) | The specified search operator isn’t applicable for the search field. |
| 400 | StartAfterEndException | document (String)<br>resourceId (String)<br>startDate (DateTime)<br>endDate (DateTime) | The specified start date is greater than the end date. |
| 400 | StringConstraintViolationException | parameter (String)<br>expected (String) | The value constraint of a String query or path parameter is violated. |
| 400 | TermOperatorMismatchValuesException | field (String)<br>operator (String) | The search operator doesn't match the specified values. |
| 400 | TypeDecodingException | path (String)<br>expectedTypes (String)<br>actualType (String) | The type of a document property is invalid. |
| 400 | UnexpectedVersionException | version (String) | The version of the request document is invalid. It has to be the URL version. |
| 400 | UnknownLocaleException | locale (String) | The specified locale is unknown. |
| 400 | UnknownPropertyException | property (String)<br>document (String) | A property in the given request document is unknown. |
| 400 | UnknownSearchFieldException | field (String) | The search field is unknown. |
| 400 | UnknownSearchOperatorException | operator (String) | The specified search operator is unknown. |
| 400 | UnknownSiteIdException | siteId (String) | The site id provided for a site-specific property is unknown. |
| 400 | UnqueryableFieldException | field (String) | The specified search field in not queryable. |
| 400 | UnsupportedCurrencyException | currency (String) | The specified currency is invalid (must be ISO 4217) or not supported. |
| 400 | UnsupportedLocaleException | locale (String) | The specified locale isn’t supported/activated. |
| 400 | ValueConstraintViolationException | parameter (String)<br>expected (String) | The value constraint of a Non-String query or path parameter is violated. |
| 401 | AuthorizationHeaderMissingException |  | Authorization header is missing. |
| 401 | DemoClientIdException | clientId (String) | Demo client ids aren’t allowed to be used on development, staging, or production instances. Demo client ids are permitted on sandbox instances only. |
| 401 | InvalidAccessTokenException | accessToken (String) | The OAuth access token sent via Authorization: Bearer header is invalid. |
| 401 | InvalidAuthorizationHeaderException |  | Invalid Authorization header. Value should be something like 'Bearer {access_token}'. |
| 401 | InvalidSecureTokenException |  | The session secure token is invalid. Session may have been hijacked. |
| 401 | UnauthorizedOriginException | origin (String) | The request origin isn’t authorized to perform the request. |
| 401 | UnauthorizedReadAccessException | method (String)<br>path (String) | The client application has no READ privileges for the resource. |
| 401 | UnauthorizedWriteAccessException | method (String)<br>path (String) | The client application has no WRITE privileges for the resource. |
| 401 | UnknownClientIdException | clientId (String) | No client application found for specified client id. |
| 403 | AccessWithoutUserForbiddenException |  | To access the resource an authenticated user is required. |
| 403 | ClientAccessForbiddenException | method (String)<br>path (String) | The current client isn’t authorized to access the resource. |
| 403 | OrganizationAccessForbiddenException |  | Global access via "/s/-/" is forbidden. Expected site-specific access via "/s/{site-id}/". |
| 403 | SecureCommunicationRequiredException |  | The request requires a secure connection (HTTPS). |
| 403 | SiteAccessForbiddenException | siteId (String) | Site-specific access via "/s/{site-id}/" is forbidden. Expected global access via "/s/-/". |
| 403 | SiteOfflineException | siteId (String) | Access to the offline site is forbidden. |
| 403 | UserAccessForbiddenException | method (String)<br>path (String) | The current user isn’t authorized to access the resource. |
| 404 | CurrencyNotFoundException | currencyId (String) | No currency found for specified mnemonic. Expected ISO 4217 mnemonic code. |
| 404 | ResourcePathNotFoundException | path (String) | The resource couldn’t be found in specified API and version. |
| 404 | UnknownSiteException | siteId (String) | No site found for specified site id. |
| 404 | VersionNotFoundException | version (String) | Version specified in URL is either unknown. |
| 405 | MethodNotAllowedException | method (String) | The HTTP method isn’t allowed. |
| 406 | CharsetNotAcceptableException | charset (String) | Unsupported charset in Accept-Charset header. Only UTF-8 is allowed. |
| 409 | IfMatchRequiredException |  | If-Match header is required, but no one was provided. |
| 409 | ObjectInDeletionConflictException | objectId (String) | Object is already in (asynchronous) deletion. |
| 409 | ResourceStateConflictException | client (String)<br>server (String) | A state token was sent with the request and doesn’t match the object's state on server side. |
| 412 | InvalidIfMatchException | ifMatch (String) | The If-Match header entity tag is invalid or out-dated. |
| 413 | RequestEntityTooLargeException |  | Request body size limit of 5 MB has been exceeded. |
| 415 | UnsupportedContentTypeException | contentType (String) | Unsupported media type in Content-Type header. Only 'application/json', 'application/xml' and 'text/xml' are allowed. |
| 415 | UnsupportedFormatException | format (String) | Unsupported format in format query parameter. Only 'json' and 'xml' are allowed. |
