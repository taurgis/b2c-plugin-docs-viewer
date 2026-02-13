# OCAPI Batch Requests

An OCAPI batch request is a multipart HTTP request that can contain up to 50 subrequests. Each subrequest (part) must operate on a single resource; subrequests that specify multiple ids (for example, `'/products/(p1,p2...)'`) are forbidden.

Batch requests reduce network overhead by reducing the overall amount of information transmitted and by reducing the number of calls you have to make. For example, to build an application screen, you can construct a single large multipart batch request instead of constructing numerous smaller individual OCAPI requests.

The HTTP method used for the batch request as a whole must be POST or OPTIONS. Each subrequest can specify a different HTTP method if necessary.

Each batch request has a main header section. In this section, you must include a `Content-Type` header that specifies a type (*multipart/mixed*) and a boundary separator that is used to delimit each subrequest. For example:

Every header included in the main header section of the batch request is implicitly inherited by each subrequest. The query parameters of the main batch request are also implicitly inherited by each subrequest.

Each subrequest, however, is conceptually a complete OCAPI request with its own resource path, header section, and request body. If needed, a subrequest can override its inherited headers and its inherited query parameters.

To specify the behavior of subrequests and to define the mapping between requests and responses, you must specify the following headers where appropriate:

| Header name | Location | Description |
| --- | --- | --- |
| x-dw-http-method | request, subrequest | Specifies the HTTP method used to access the resource. |
| x-dw-resource-path | request, subrequest | Specifies the base resource path. The value of this header is combined with value of the x-dw-resource-path-extension header to provide a complete resource path. |
| x-dw-resource-path-extension | request, subrequest | Specifies an extension for the value of the base path, as specified by the x-dw-resource-path header. This header is optional if the base resource path already represents a valid OCAPI resource. |
| x-dw-content-id | subrequest, subresponse | Specifies an ID of the subrequest. This header value is used to map a subrequest to a subresponse. |
| x-dw-status-code | subresponse | Specifies the status code of a single subresponse. |

Batch requests are supporting [CORS](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/cors.html). Allowed expose headers and origins are mentioned in OCAPI settings for each client ID. To access them, it’s mandatory to send a batch request for a specific client in a context, either of a specific site or global. There are several possibilities to pass a [client identification](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/clientapplicationidentification.html):

1.  Client ID as query parameter
2.  Client ID as *x-dw-client-id* header
3.  OAuth access token via *Authorization* header
4.  JWT via *Authorization* header

Subrequests in a batch request body adhering to the standard defined in [Multipart Media Type](https://tools.ietf.org/html/rfc2046#section-5.1). This approach means that the header section in a Multipart subrequest has to follow directly after the Multipart boundary. The header section and the Multipart body section have to be separated by two subsequent newline characters.

Example 1

Correct formatted subrequest.

Example 2

Wrong formatted subrequest. Only one newline after header section.

Example 3

Wrong formatted subrequest. Two newlines after boundary lead to an empty header section.

Example 1

This example shows how you can access multiple resources of the same type:

Example 2

This example shows how you can access resources of different types:

The site context for each request can be defined in `x-dw-resource-path` or `x-dw-resource-path-extension`. If no site context is given in these headers, the one from the main request is taken. This implies, that the site context from the main request can be overwritten by the resource path headers.

The size of the batch request body is limited to 5 MB. The maximum number of subrequests is 50.

| Exeption name | Status code | Description |
| --- | --- | --- |
| IllegalContentTypeException | 400 | Thrown if the request content type isn’t multipart/mixed or specifies no boundary. |
| IllegalQueryStringException | 400 | Thrown if the query string for the request or a subrequest is invalid. |
| InvalidAuthorizationHeaderException | 401 | Thrown if the authorizarion header has not the format Authorization: Bearer ... |
| InvalidHttpMethodException | 400 | Thrown if the HTTP method in the request header or subrequest header is invalid. |
| InvalidRequestBodyException | 400 | Thrown if the request body is invalid. |
| InvalidTokenException | 401 | The token sent via Authorization: Bearer header is invalid or expired. |
| MethodNotAllowedException | 405 | Thrown if the batch request was sent with an HTTP method other than POST or OPTIONS. |
| MissingClientIdException | 400 | Thrown if no client identification was sent with the main request (either as client ID or authorization token). |
| MissingHttpMethodException | 400 | Thrown if at least one subrequest has no HTTP method. |
| MissingResourcePathException | 400 | Thrown if at least one subrequest has no resource path. |
| QuotaExceededException | 400 | Thrown if the batch request contains more than 50 subrequests. |
| RequestEntityTooLargeException | 400 | Thrown if the batch request body is larger than 5 MB. |
| ResourcePathNotAllowedException | 400 | Thrown if at least one subrequest is a multiple-ID resource call. |
| UnauthorizedOriginException | 401 | Thrown if the given origin isn’t mentioned in the OCAPI settings for the accessing client. |
| UnknownClientIdException | 401 | Thrown if the given client identification isn’t known to the account manager. |
| UnknownSiteIdException | 400 | Thrown if the request was sent in the context of an unknown site name. |

```txt
Content-Type: multipart/mixed; boundary=23dh3f9f4
```

```txt
REQUEST:
    POST /batch HTTP 1.1
    Host: example.com
    Content-Type: multipart/mixed; boundary=23dh3f9f4
    Authorization: Bearer f9f34f43rfdf0isadjf93059j4
    x-dw-http-method: DELETE
    x-dw-resource-path: /s/-/dw/data/v24_5/libraries/SiteGenesis/content/
    --23dh3f9f4\n
    x-dw-content-id: realCount\n
    \n
    {"query":{"filtered_query":{"query":{"bool_query":{"must":[{"term_query":{"fields":["product_items.product_id"],"operator":"one_of","values":["S20273_100"]}},{"term_query":{"fields":["status"],"operator":"one_of","values":["new"]}}]}},"filter":{"range_filter":{"field":"creation_date","from":"2020-04-01"}}}},"select":"(total)"}\n
    --23dh3f9f4--
    ...
```

```txt
REQUEST:
    POST /batch HTTP 1.1
    Host: example.com
    Content-Type: multipart/mixed; boundary=23dh3f9f4
    Authorization: Bearer f9f34f43rfdf0isadjf93059j4
    x-dw-http-method: DELETE
    x-dw-resource-path: /s/-/dw/data/v24_5/libraries/SiteGenesis/content/
    -23dh3f9f4\n
    x-dw-content-id: realCount\n
    {"query":{"filtered_query":{"query":{"bool_query":{"must":[{"term_query":{"fields":["product_items.product_id"],"operator":"one_of","values":["S20273_100"]}},{"term_query":{"fields":["status"],"operator":"one_of","values":["new"]}}]}},"filter":{"range_filter":{"field":"creation_date","from":"2020-04-01"}}}},"select":"(total)"}\n
    --23dh3f9f4--
    ...
```

```txt
REQUEST:
    POST /batch HTTP 1.1
    Host: example.com
    Content-Type: multipart/mixed; boundary=23dh3f9f4
    Authorization: Bearer f9f34f43rfdf0isadjf93059j4
    x-dw-http-method: DELETE
    x-dw-resource-path: /s/-/dw/data/v24_5/libraries/SiteGenesis/content/
    --23dh3f9f4\n
    \n
    x-dw-content-id: realCount\n
    {"query":{"filtered_query":{"query":{"bool_query":{"must":[{"term_query":{"fields":["product_items.product_id"],"operator":"one_of","values":["S20273_100"]}},{"term_query":{"fields":["status"],"operator":"one_of","values":["new"]}}]}},"filter":{"range_filter":{"field":"creation_date","from":"2020-04-01"}}}},"select":"(total)"}\n
    --23dh3f9f4--
    ...
```

```txt
REQUEST:
    POST /batch HTTP 1.1
    Host: example.com
    Content-Type: multipart/mixed; boundary=23dh3f9f4
    Authorization: Bearer f9f34f43rfdf0isadjf93059j4
    x-dw-http-method: DELETE
    x-dw-resource-path: /s/-/dw/data/v24_5/libraries/SiteGenesis/content/

    --23dh3f9f4
    x-dw-content-id: req1
    x-dw-resource-path-extension: content_asset_1
    --23dh3f9f4
    ...
    x-dw-content-id: req50
    x-dw-resource-path-extension: content_asset_50
    --23dh3f9f4--

    RESPONSE:
    HTTP/1.1 200 OK
    Content-Type: multipart/mixed; boundary=23dh3f9f4

    --23dh3f9f4
    x-dw-content-id: req1
    x-dw-status-code: 204
    --23dh3f9f4
    ...
    x-dw-content-id: req50
    x-dw-status-code: 204
    --23dh3f9f4--
```

```txt
REQUEST:
    POST /batch HTTP 1.1
    Host: example.com
    Content-Type: multipart/mixed; boundary=23dh3f9f4
    x-dw-client-id: [your_own_client_id]
    x-dw-http-method: GET
    x-dw-resource-path: /s/SiteGenesis/dw/shop/v24_5/

    --23dh3f9f4
    x-dw-content-id: req_addr_create
    x-dw-http-method: PUT
    x-dw-resource-path-extension: account/this/addresses

    {
      "address1":"10 Somewhere St.",
      "city":"Boston",
      "last_name":"Lebowski",
      "country_code":"US",
      "postal_code":"98765",
      "state_code":"MA"
    }
    --23dh3f9f4
    x-dw-content-id: req_prod_get
    x-dw-resource-path-extension: products/creative-zen-v
    --23dh3f9f4--

    RESPONSE:
    HTTP/1.1 200 OK
    Content-Type: multipart/mixed; boundary=23dh3f9f4

    --23dh3f9f4
    x-dw-content-id: req_addr_create
    x-dw-status-code: 200

    {
      "_v" : "24.5",
      "_type":"customer_address",
      "address1":"10 Somewhere St.",
      "address_id":"84619.10625703718",
      "city":"Boston",
      "country_code":"US",
      "last_name":"Lebowski",
      "postal_code":"98765",
      "state_code":"MA"
    }
    --23dh3f9f4
    x-dw-content-id: req_prod_get
    x-dw-status-code: 404

    {
      "_v" : "24.5",
      "fault":{
        "type":"ProductNotFoundException",
        "message":"No product with id 'creative-zen-v' for site 'SiteGenesis' found."
      }
    }
    --23dh3f9f4--
```
