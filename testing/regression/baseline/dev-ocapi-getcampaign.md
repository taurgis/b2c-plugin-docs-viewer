# Get Campaign

Operation ID: Get Campaign

**GET** `https://{host}/s/-/dw/data/v25\_6/sites/{site\_id}/campaigns/{campaign\_id}`

Action to get campaign information.

This endpoint may return the following faults:

-   404 - CampaignNotFoundException - Thrown in case the campaign does not exist matching the given id

## Request

### Request Example

`curl "https://{host}/s/-/dw/data/v25_6/sites/{site_id}/campaigns/{campaign_id}"`

## Security

### OAuth 2.0

Authentication flow with client ID and password with account manager.

#### Settings

#### URI Parameters

| Name | Type | Required | Description | Constraints |
| --- | --- | --- | --- | --- |
| site_id | string | Yes | The site the requested campaign belongs to. | Minimum characters: 1 |
| campaign_id | string | Yes | The id of the requested campaign. | Minimum characters: 1 |

## Responses

### 404

CampaignNotFoundException - Thrown in case the campaign does not exist matching the given id

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
| cause.message | string |  |  |  |
| cause.type | string |  |  |  |
| display_message_pattern | string |  | The localized display message pattern, if the request parameter display_locale was given |  |
| message | string |  | The message text of the java exception. |  |
| stack_trace | string |  |  |  |
| type | string |  | The name of the java exception. |  |

### default

#### Example

```
{
  "coupons": [
    "testCoupon"
  ],
  "customer_groups": [
    "Registered"
  ],
  "description": "My Campaign",
  "enabled": true,
  "end_date": "2015-07-31T23:09:08.000Z",
  "link": "https://example.com/s/-/dw/data/{version}/sites/SiteGenesis/campaigns/my-campaign",
  "source_code_groups": [
    "WapiSourceCodeGroup1"
  ],
  "start_date": "2015-04-01T11:30:15.000Z"
}
```

#### Body

Media types: application/json, text/xml

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| campaign_id | string |  | The ID of the campaign. | Minimum characters: 1; Maximum characters: 256 |
| coupons | array of string |  | The array of assigned coupon IDs, not sorted |  |
| creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| customer_groups | array of string |  | The array of assigned customer groups, not sorted |  |
| description | string |  | The description of the campaign. | Maximum characters: 4000 |
| enabled | boolean |  | The enabled flag for campaign. |  |
| end_date | datetime |  | The date that the Scenario ends |  |
| last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| link | string |  | link for convenience |  |
| source_code_groups | array of string |  | The array of assigned source code groups, not sorted |  |
| start_date | datetime |  | The date that the Scenario begins |  |
