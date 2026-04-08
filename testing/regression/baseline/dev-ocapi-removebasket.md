# Remove a basket

Operation ID: Remove a basket

**DELETE** `https://{host}/s/{siteId}/dw/shop/v25\_6/baskets/{basket\_id}`

Removes a basket.

This endpoint may return the following faults:

-   400 - InvalidCustomerException - Indicates that the customer assigned to the basket does not match the verified customer represented by the JWT, not relevant when using OAuth.

-   404 - BasketNotFoundException - Indicates that the basket with the given basket id is unknown.

## Request

### Request Example

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/baskets/{basket_id}" \ -X DELETE`

## Security

## Basic Authentication

User authentication either for a registered or a guest customer (selectable in request body). Access via Base64 encoded customer:password string as 'Authorization: Basic' header.

### OAuth 2.0

Authentication flow with client ID and password with account manager.

#### Settings

## Api Key

Add client ID for application identification. Alternative as 'client\_id' query parameter.

#### URI Parameters

| Name | Type | Required | Description | Constraints |
| --- | --- | --- | --- | --- |
| basket_id | string | Yes | the id of the basket to be retrieved | Minimum characters: 1 |

## Responses

### 204

### 400

InvalidCustomerException - Indicates that the customer assigned to the basket does not match the verified customer represented by the JWT, not relevant when using OAuth.

#### Example

```
{
  "arguments": {},
  "cause": {
    "cause": "",
    "message": "",
    "type": ""
  },
  "display_message_pattern": "",
  "message": "",
  "stack_trace": "",
  "type": ""
}
```

#### Body

Media types: application/json, text/xml

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| arguments | object |  | A map that provides fault arguments. Data can be used to provide error messages on the client side. |  |
| cause | object |  |  |  |
| display_message_pattern | string |  | The localized display message pattern, if the request parameter display_locale was given |  |
| message | string |  | The message text of the java exception. |  |
| stack_trace | string |  |  |  |
| type | string |  | The name of the java exception. |  |

### 404

BasketNotFoundException - Indicates that the basket with the given basket id is unknown.

#### Example

```
{
  "arguments": {},
  "cause": {
    "cause": "",
    "message": "",
    "type": ""
  },
  "display_message_pattern": "",
  "message": "",
  "stack_trace": "",
  "type": ""
}
```

#### Body

Media types: application/json, text/xml

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| arguments | object |  | A map that provides fault arguments. Data can be used to provide error messages on the client side. |  |
| cause | object |  |  |  |
| display_message_pattern | string |  | The localized display message pattern, if the request parameter display_locale was given |  |
| message | string |  | The message text of the java exception. |  |
| stack_trace | string |  |  |  |
| type | string |  | The name of the java exception. |  |
