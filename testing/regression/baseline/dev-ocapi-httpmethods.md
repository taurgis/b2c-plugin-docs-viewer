# OCAPI HTTP Methods

A key characteristic of a RESTful Web API is the explicit use of HTTP methods, as defined by RFC 2616. The Open Commerce API supports these methods, as described in the following sections.

The GET method retrieves resources on the server. The GET method is a *safe method,* which means that it should never change the state of the server or have side effects. Consequently, a GET request never initiates transactions on the server.

A typical GET request and its response look like this:

This sample shows a typical GET request retrieving a `Product` resource using the `Identifier` "123". The response has HTTP status code 200, which indicates the resource was found and is contained in response body. The response contains the "Content-Type" header, which is set to "application/json" plus the charset definition ("UTF-8").

The DELETE method removes one or more resources on the server. DELETE is an *idempotent* method, which means repeating a request always results in the same server state as making the request once. The server returns HTTP status code 204 (NO CONTENT) if the resource has been deleted or 404 (NOT FOUND) if the resource doesn’t exist (anymore).

The following example shows how to remove a resource that is addressed by an `Identifier` in the URL:

The request is similar to the previous GET request, except the HTTP method changed. The response status code is 204, which means the server successfully fulfilled the request but returned no content.

The PUT method is used to *create*, *update*, or *replace* a resource. It’s also an *idempotent* method. If a resource is created, the method returns a 201 status code with a *Location* header, pointing to the created resource. Otherwise, it returns a 200 status code.

For security reasons, the HTTP PUT method is blocked from making direct calls against production or staging instances. Instead, use the workaround described in [Override HTTP Method](#override-http-method) to perform a logical PUT call via the POST method. If you make PUT calls in your development or sandbox instance, you can’t use the same code in staging or production.

PUT allows you to create a resource with the identifier specified in the URL. POST, on the other hand, is used when the identifier is provided by the server.

If the resource exists, PUT "cleans" the resource and then applies all the properties specified in the request document. So, unlike PATCH, PUT also touches/cleans properties that aren’t part of the request document. The PUT replace logic touches only the resource itself, not its relations to other resources.

The example shows how to set a billing address on a basket using the PUT method:

The PATCH method allows partial resource modification by sending a delta document. The method is neither *safe* nor *idempotent.* A PATCH document contains information describing how to modify a server resource to produce a new version; in contrast, a PUT request completely replaces the existing document.

The Open Commerce API uses the PATCH method to provide partial updates. The following table compares PUT and PATCH regarding their create and update behavior:

| Method | Resource doesn’t exist | Resource exists |
| --- | --- | --- |
| PUT | Creates a resource. | Updates the resource by completely replacing it. UUIDs and relations aren’t touched. Properties that aren’t provided in the request are lost. |
| PATCH | Doesn’t create a resource. | Updates the resource partially. The server only updates properties that are provided in the request; other properties aren’t touched. |

The example shows how you can use a PATCH to partially update a baskets resource. The server updates only the properties in the delta document; other properties are untouched:

The POST method is neither *safe* (because requests can affect the server state) nor *idempotent* (because multiple requests potentially return different results).

The Open Commerce API uses POST only for three purposes:

-   Create a resource. Unlike PUT, the resource identifier is provided by the server.
-   Override an HTTP method; see [Override HTTP method.](#override-http-method)
-   Execute special actions that are hard to map to a RESTful request (for example, password reset requests).

The HEAD method is similar to the GET method, but returns headers only, not content (body). The headers are identical to those of the GET request. The HEAD method is a *safe method:* it doesn’t change the state of the server.

The OPTIONS method lists the supported HTTP methods for the specified URL in the `Allow` header. It isn’t cache-able and returns no content. The OPTIONS method is also a *safe* method, which means that it will never change the state of the server.

Some web frameworks (for example, AJAX frameworks) only support the HTTP methods GET and POST. The Open Commerce API works around this limitation by supporting POST requests that can override the HTTP method. The methods DELETE, HEAD, OPTIONS, PUT and PATCH are supported override methods.

You can do this by specifying the explicit request/form parameter **method** with the value of the overriding method in upper case. The following example shows how you can simulate a DELETE:

Another way you can override the HTTP method is to specify the Commerce Cloud Digital HTTP header `x-dw-http-method-override` with the value of the overriding method in upper case. The following example shows how you can simulate a DELETE:

The request parameter has precedence over the header parameter.

Some of the PATCH, POST, and PUT OCAPIs might not require a request body. Making these calls with empty request bodies can cause problems (i.e. HTTP 500 responses) with proxies in between. Please ensure that you provide the `Content-Length` request header with the value '0'.

```txt
REQUEST:
GET /dw/shop/v24_5/products/123 HTTP/1.1
Host: example.com
Accept: application/json

RESPONSE:
HTTP/1.1 200 OK
Content-Length: 67
Content-Type: application/json; charset=UTF-8

{"sku":"123","name":"foo","brand":"bar","online":true}
```

```txt
REQUEST:
DELETE /dw/shop/v24_5/baskets/12345abcdfe12345 HTTP/1.1
Host: example.com
Accept: application/json

RESPONSE:
HTTP/1.1 204 NO CONTENT
Content-Length: 0
```

```txt
REQUEST:
PUT /dw/shop/v24_5/baskets/cdTwMiWbOhGJgaaadkIKbj5op9/billing_address HTTP/1.1
Host: example.com
Authorization: Bearer af7f5c90-ffc1-4ea4-9613-f5b375b7dc19
Content-Type: application/json
{
  "_resource_state" : "ba4e84383e1790597e49eeee34b201633d80ed3f499992f5af11d639dd903a36"
  "first_name":"John",
  "last_name":"Smith",
  "city":"Boston",
  "country_code":"US",
  "c_strValue":"c25"
}

RESPONSE:
HTTP/1.1 200 OK
Content-Type: application/json;charset=UTF-8

{
   "_v" : "24.5",
   "_resource_state" : "t9ccde3040519cce439cd99e209f8a87c3ad0b7e2"
...
   "billing_address" :
   {
      "_type" : "order_address",
      "city" : "Boston",
      "country_code" : "US",
      "first_name" : "John",
      "full_name" : "John Smith",
      "last_name" : "Smith",
      "c_strValue" : "c25"
   },
...
}
```

```txt
REQUEST:
#
# Example: Update Option Value
#
REQUEST:
PATCH /dw/shop/v24_5/baskets/cd6HwiWbLaZuUaaadgtglhMTrG/items/cdheYiWbLasNkaaadgwMthMTrG HTTP/1.1
Host: example.com
Authorization: Bearer a5b6eb0dxxxxxx.423f234ff24fxxxxx.124f1f133fxxxxx

{
  "_resource_state" : "t9ccde3040519cce439cd99e209f8a87c3ad0b7e2"
  "product_id": "IPad2",
  "quantity": 1,
  "option_items": [
    {
      "option_id": "Warranty",
      "option_value_id": "oneYear"
    }
  ]
}

# Success Response:
RESPONSE:
HTTP/1.1 200 OK
Content-Type: application/json;charset=UTF-8
Cache-Control: max-age=0,no-cache,no-store,must-revalidate
{
   "_v" : "24.5",
   "_resource_state" : "125e1319918776a043fcef2b0e2fce7906abbdea7f5f2f19.10ff0ba0fc46de88"
...
   "basket_id" : "cd6HwiWbLaZuUaaadgtglhMTrG",
   "product_items" : [
      {
...
         "item_text" : "IPad 2",
         "option_items" : [
            {
               "item_text" : "Warranty One Year",
               "option_id" : "Warranty",
               "option_value_id" : "oneYear",
...
            }
         ],
         "product_id" : "IPad2",
         "item_id" : "cdheYiWbLasNkaaadgwMthMTrG"
      }
   ],
   ...
}
```

```txt
REQUEST:
HEAD /dw/shop/v24_5/products/123 HTTP/1.1
Host: example.com
Accept: application/json

RESPONSE:
HTTP/1.1 204 NO CONTENT
Content-Length: 67
Content-Type: application/json; charset=UTF-8
```

```txt
REQUEST:
OPTIONS /dw/shop/v24_5/products HTTP/1.1
Host: http://example.com

RESPONSE:
HTTP/1.1 204 NO CONTENT
Allow: GET, HEAD, POST
```

```txt
REQUEST:
POST /dw/shop/v24_5/products/123?method=DELETE HTTP/1.1
Host: example.com
Accept: application/json

RESPONSE:
HTTP/1.1 204 NO CONTENT
```

```txt
REQUEST:
POST /dw/shop/v24_5/products/123 HTTP/1.1
Host: example.com
Accept: application/json
x-dw-http-method-override: DELETE

RESPONSE:
HTTP/1.1 204 NO CONTENT
```

```txt
REQUEST:
POST /dw/shop/v24_5/sessions HTTP/1.1
Host: example.com
Content-Length: 0
```
