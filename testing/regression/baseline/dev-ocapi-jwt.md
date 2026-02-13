# OCAPI JWT

JSON Web Token (JWT) is an authentication mechanism required by several Shop API resources. You don’t have to be familiar with JWT to use these resources; however, for more information about JWT, see the [JSON Web Token (JWT) IETF specification](http://tools.ietf.org/html/rfc7519).

Your client application is responsible for keeping customer credentials and authentication tokens (JWTs) secure. Your application must use these JWTs to interact with the Shop API on behalf of the purchasing customer (registered or guest).

If Commerce Cloud manages your customer credentials, your client application can obtain a JWT for a customer using the `/customers/auth` resource.

If your client application manages your customer credentials, it can obtain a JWT for a registered customer using the `/customers/auth/trustedsystem` resource. Because this API uses an OAuth token to identify the client application, we strongly recommend that you only use it in a system-to-system integration, where the client application keeps its own OAuth token secret.

Before you can use JWTs for authentication, you must register your client application using Account Manager. See Adding a client ID for the Open Commerce API.

Account Manager provides you with a client ID that is known to both B2C Commerce and your client application. The client ID is required when you request an authentication token. On sandboxes, for testing, you can use the demo client ID: \[your\_own\_client\_id\].

In addition to obtaining the authentication token, you must configure [Open Commerce API Settings](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/ocapisettings.html) to grant your client application access to the Open Commerce APIs.

To use JWTs for authentication, your client application must perform the following steps:

1.  Request a JWT using the `/customers/auth` resource.
    
2.  Include the JWT in subsequent Shop API requests.
    
3.  Refresh the JWT if needed.
    

When you request a JWT using the `/customers/auth` resource, you must specify your client ID as a URL or header parameter. You must also specify the type of customer:

1.  Specify `"type":"guest"` to request a JWT for a *guest* customer.
2.  Specify `"type":"credentials"` to request a JWT for a *registered* customer. (For a registered customer, you must also include the customer login and password in the HTTP Basic Authentication scheme.)
3.  Specify `"type":"session"` to request a JWT for a customer (*guest* or *registered*) associated with a session. (You have to provide valid *dwsid* and *dwsecuretoken* cookies.)

If the request succeeds, the response includes a JWT in the `Authentication:Bearer` response header. The response also includes a description of the customer in the response body. Your application must include the JWT in the `Authentication:Bearer` header of subsequent requests.

The JWT is signed. This means that the JWT's *header* and *payload* sections are JSON-formatted strings. Your client application can therefore easily read the various claims in the payload section, such as `exp` (the token expiration-time) and `iat` (the token issued-at-time).

A JWT has a lifetime of 30 minutes. Before the token expires, you must exchange it for a new token if you want to extend the total lifetime. You can use the `/customers/auth` resource to obtain a new token in exchange for an existing one. You must include the current token in the `Authentication:Bearer` request header, and you must specify the customer type as `"type":"refresh"`.

The `/customers/auth` request is based on an HTTP POST operation, which uses transport layer security; the request body must be URL encoded. For registered customers, the client Id must be passed in the initial request to obtain the authentication token, but isn’t needed in subsequent requests.

External client applications don't have to authenticate customers through B2C Commerce. A client application can authenticate customers itself or through an Identification Provider (IDP) such as Google or Facebook.

To authenticate a registered customer, don't request a JWT using `/customers/auth`. Instead, use `/customers/auth/trustedsystem` as follows:

1.  First, register the client application with Account Manager and obtain an OAuth token for it. When calling the `trustedsystem` API, include that token in the authorization header.
2.  Use HTTP POST to call `/customers/auth/trustedsystem`. In the request body, include the customer login ID and your application's client ID.

If the request succeeds, the JWT is included in the `Authentication:Bearer` response header. The response body includes a customer object.

If your external client application authenticates customers via an external IDP, each customer needs an external profile in order to retrieve cart information or order history. The first time your app authenticates each customer, create a customer record with an external profile as follows:

1.  Obtain a guest JWT using `/customers/auth` with type `guest`. If you use a registered customer JWT, the call throws an exception.
2.  Use HTTP POST to call `/customers/ext_profile` with the guest JWT. In the request body, include the authentication provider ID, the ID used to log in to the external IDP, and (if different from the login ID) the customer's email address.

If the request succeeds, the response includes a customer ID.

The JSON Web Token specification stipulates that a JWT contains three sections in the following order:

-   The *header* section specifies the token type and algorithm used.
-   The *payload* section contains customer information, the client id, and issue and expiration time.
-   The *signature* section records the token signature.

The system returns the JWT as a Base64-encoded string. In this string, the *header*, *payload*, and *signature* sections are delimited by periods(.).

B2C Commerce uses a subset of the claims defined in the JSON Web Token specification. You can decode the *payload* section to access the values of the `exp`, `iat`, `sub`, and `iss` claims. For example:

-   **exp:** Token expiration-time as seconds from 1970-01-01T00:00:00Z
-   **iat:** Token issued-at-time as seconds from 1970-01-01T00:00:00Z
-   **sub:** Token subject (see below)
-   **iss:** Token issuer (client ID)

The value of the `sub` claim is a JSON string. For example:

A typical storefront enables a user to create and use a basket as a guest customer, and then continue to use the "same" basket after logging in as a registered customer. The Open Commerce API enables you to achieve this effect by copying the guest basket and using the new copy for the registered customer.

How you do this is described below:

1.  Request a JWT using the `/shop/v24_5/customers/auth` resource.
    
    In the body of the request, specify "guest" as the value of the "type" property: `{ "type" : "guest" }`.
    
2.  Request a basket using the `/shop/v24_5/baskets` resource.
    
    In the request, include the JWT you obtained in the previous step.
    
3.  After performing additional OCAPI requests against the guest basket (for example, to create items, set a billing address, and so on) retain the last JSON response (a Basket document) in a variable.
    
4.  When the customer tries to log in as a registered customer, request a new JWT using the `/shop/v24_5/customers/auth` resource.
    
    In the request, specify "credentials" as the value of the "type" property: `{ "type" : "credentials" }`.
    
    Also, in the request's `Authorization` header, specify the registered customer's login credentials.
    
5.  Request a new basket using the `/shop/v24_5/baskets` resource.
    
    In the request, include the basket document retained in step 3; also include the JWT obtained in the step 4.
    
    The basket document must not be modified after it was last saved; it must be the same as it was after the last request, with the same order of properties.
    

The new basket for the registered customer can now be modified and submitted as needed.

When creating baskets with a JWT, there’s a limit of one *open* basket per registered customer. Exceeding this limit results in `a CustomerBasketsQuotaExceededException` fault response.

The following examples show sample requests and responses using JWTs for authentication (additional examples are provided within the resource documentation):

The first example request obtains a token for a registered customer. The credentials are `username:password` (Base64-encoded), passed via HTTP Basic Auth.

If the server finds a customer with the given credentials, it returns a newly created token (a JWT) in the Authorization response header. The value of the `auth_type` property is "registered" because the `type` property was set to "credentials" in the request.

All subsequent requests include the token in the `Authorization:Bearer` header. For example, the following request asks the server to create a basket for the registered customer. The client ID isn’t required.

The server returns information for the newly created basket.

```json
{
      "exp": 1300819380,
      "iat": 1300819000,
      "sub": ... ,
      "iss": "[your_own_client_id]"
}
```

```json
{
  "customer_id": "12a4567f9123",
  "guest": false
}
```

```txt
REQUEST:
POST /dw/shop/v24_5/customers/auth?client_id=[your_own_client_id]
Host: example.com
Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==
Content-Type: application/json
{
  "type" : "credentials"
}

RESPONSE:
HTTP/1.1 200 OK
Content-Length:124
Authorization:Bearer eyJfdiI6IjXXXXXX.eyJfdiI6IjEiLCJleHAXXXXXXX.-d5wQW4c4O4wt-Zkl7_fiEiALW1XXXX
Content-Type:application/json;charset=UTF-8
{
   "_v" : "24.5",
   "_type" : "customer",
   "auth_type" : "registered",
   "customer_id" : "abdtkZzH6sqInJGIHNR1yUw90A",
   "preferred_locale" : "default"
   ...
}
```

```txt
REQUEST:
POST /dw/shop/v24_5/baskets HTTP/1.1
Authorization:Bearer eyJfdiI6IjXXXXXX.eyJfdiI6IjEiLCJleHAXXXXXXX.-d5wQW4c4O4wt-Zkl7_fiEiALW1XXXX
Host: example.com
Content-Type: application/json

RESPONSE:
HTTP/1.1 200 OK
Content-Length:124
Content-Type:application/json;charset=UTF-8
{
   "_v" : "24.5",
   "_resource_state" : "ba4e84383e1790597e49eeee34b201633d80ed3f499992f5af11d639dd903a36"
   "_type" : "basket",
   "basket_id" : "bczFTaOjgEqUkaaadkvHwbgrP5",
   "currency" : "USD",
   ....
}
```
