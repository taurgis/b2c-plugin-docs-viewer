# Create customer

Operation ID: Create customer

**POST** `https://{host}/s/-/dw/data/v25\_6/customer\_lists/{list\_id}/customers`

Action to create a new customer. The customer is created using the specified credentials and customer information.This action verifies the following:

-   Login acceptance criteria and uniqueness

-   Mandatory customer properties

If the action fails to create the customer, it returns a 400 fault with an appropriate message.

This endpoint may return the following faults:

-   400 - CredentialsMissingException - Indicates that the mandatory credentials are missing in the input document.

-   400 - InvalidLoginException - Indicates the login does not match the login acceptance criteria.

-   400 - LoginAlreadyInUseException - Indicates the login is already in use.

-   400 - LoginMissingException - Indicates that the mandatory login property is missing in the input document.

-   404 - CustomerListNotFoundException - Indicates that the customer list with the given customer list id is unknown.

## Request

### Request Example

`curl "https://{host}/s/-/dw/data/v25_6/customer_lists/{list_id}/customers" \ -X POST \ -H "content-type: application/json" \ -d '{ "birthday": "1970-01-31", "company_name": "Salesforce Commerce Cloud", "creation_date": "2013-09-17T09:20:31.000Z", "credentials": { "enabled": true, "locked": false, "login": "dude", "password_question": "Mother's maiden name" }, "customer_no": "0815", "email": "dude@salesforce.com", "fax": "001-444-4444", "first_name": "Dude", "job_title": "", "last_name": "Lebowski", "phone_business": "001-222-2222", "phone_home": "001-111-1111", "phone_mobile": "001-333-3333", "preferred_locale": "de_DE", "salutation": "Mr.", "second_name": "second", "suffix": "suffix", "title": "Dr." }'`

### Body

Media types: application/json, text/xml

### Example

Media types: application/json

```json
{
  "birthday": "1970-01-31",
  "company_name": "Salesforce Commerce Cloud",
  "creation_date": "2013-09-17T09:20:31.000Z",
  "credentials": {
    "enabled": true,
    "locked": false,
    "login": "dude",
    "password_question": "Mother's maiden name"
  },
  "customer_no": "0815",
  "email": "dude@salesforce.com",
  "fax": "001-444-4444",
  "first_name": "Dude",
  "job_title": "",
  "last_name": "Lebowski",
  "phone_business": "001-222-2222",
  "phone_home": "001-111-1111",
  "phone_mobile": "001-333-3333",
  "preferred_locale": "de_DE",
  "salutation": "Mr.",
  "second_name": "second",
  "suffix": "suffix",
  "title": "Dr."
}
```

Media types: text/xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<customer>
  <birthday>1970-01-31</birthday>
  <company_name>Salesforce Commerce Cloud</company_name>
  <creation_date>2013-09-17T09:20:31.000Z</creation_date>
  <credentials>
    <enabled>true</enabled>
    <locked>false</locked>
    <login>dude</login>
    <password_question>Mother's maiden name</password_question>
  </credentials>
  <customer_no>0815</customer_no>
  <email>dude@salesforce.com</email>
  <fax>001-444-4444</fax>
  <first_name>Dude</first_name>
  <job_title></job_title>
  <last_name>Lebowski</last_name>
  <phone_business>001-222-2222</phone_business>
  <phone_home>001-111-1111</phone_home>
  <phone_mobile>001-333-3333</phone_mobile>
  <preferred_locale>de_DE</preferred_locale>
  <salutation>Mr.</salutation>
  <second_name>second</second_name>
  <suffix>suffix</suffix>
  <title>Dr.</title>
</customer>
```

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| birthday | date |  | The customer's birthday. |  |
| company_name | string |  | The customer's company name. | Maximum characters: 256 |
| credentials | object |  | Document representing the credentials of a customer. |  |
| credentials.enabled | boolean |  | A flag indicating whether the customer is enabled and can log. |  |
| credentials.locked | boolean |  | A flag indicating whether the customer account is locked. |  |
| credentials.login | string | Required | The login of the customer. | Maximum characters: 256 |
| credentials.password_question | string |  | The password question. | Maximum characters: 256 |
| customer_id | string |  | The customer's id. Both registered and guest customers have a customer id. | Maximum characters: 28 |
| customer_no | string |  | The customer's number. | Maximum characters: 100 |
| email | string |  | The customer's email address. | Maximum characters: 256 |
| fax | string |  | The fax number to use for the customer. The length is restricted to 32 characters. | Maximum characters: 32 |
| first_name | string |  | The customer's first name. | Maximum characters: 256 |
| gender | integer |  | The customer's gender. | Enum values: 12 |
| global_party_id | string |  | The Global Party ID is set by Customer 360 and identifies a person across multiple systems. |  |
| job_title | string |  | The customer's job title. | Maximum characters: 256 |
| last_name | string |  | The customer's last name. | Maximum characters: 256 |
| phone_business | string |  | The customer's business phone number. | Maximum characters: 32 |
| phone_home | string |  | The customer's home phone number. | Maximum characters: 32 |
| phone_mobile | string |  | The customer's mobile phone number. | Maximum characters: 32 |
| previous_login_time | datetime |  | The time when the customer logged in previously. |  |
| previous_visit_time | datetime |  | The time when the customer previously visited the store. |  |
| primary_address | object |  | Document representing a customer address. |  |
| primary_address.address1 | string |  | The customer's first address. | Maximum characters: 256 |
| primary_address.address2 | string |  | The customer's second address value. | Maximum characters: 256 |
| primary_address.address_id | string | Required | The customer address id. | Maximum characters: 256 |
| primary_address.city | string |  | The customer's city. | Maximum characters: 256 |
| primary_address.company_name | string |  | The customer's company name. | Maximum characters: 256 |
| primary_address.country_code | string | Required | The customer's two-character country code per ISO 3166-1 alpha-2. | Maximum characters: 2; Enum values: CADEUS |
| primary_address.etag | string |  |  |  |
| primary_address.first_name | string |  | The customer's first name. | Maximum characters: 256 |
| primary_address.full_name | string |  | The concatenation of the customer's first, middle, and last names and its suffix. |  |
| primary_address.job_title | string |  | The customer's job title. | Maximum characters: 256 |
| primary_address.last_name | string | Required | The customer's last name. | Maximum characters: 256 |
| primary_address.phone | string |  | The customer's phone number. | Maximum characters: 32 |
| primary_address.post_box | string |  | The customer's post box. | Maximum characters: 256 |
| primary_address.postal_code | string |  | The customer's postal code. | Maximum characters: 256 |
| primary_address.salutation | string |  | The customer's salutation. | Maximum characters: 256 |
| primary_address.second_name | string |  | The customer's second name. | Maximum characters: 256 |
| primary_address.state_code | string |  | The customer's state. | Maximum characters: 256 |
| primary_address.suffix | string |  | The customer's suffix. | Maximum characters: 256 |
| primary_address.suite | string |  | The customer's suite. | Maximum characters: 32 |
| primary_address.title | string |  | The customer's title. | Maximum characters: 256 |
| salutation | string |  | The customer's salutation. | Maximum characters: 256 |
| second_name | string |  | The customer's second name. | Maximum characters: 256 |
| suffix | string |  | The customer's suffix (for example, "Jr." or "Sr."). | Maximum characters: 256 |
| title | string |  | The customer's title (for example, "Mrs" or "Mr"). | Maximum characters: 256 |

## Security

### OAuth 2.0

Authentication flow with client ID and password with account manager.

#### Settings

#### URI Parameters

| Name | Type | Required | Description | Constraints |
| --- | --- | --- | --- | --- |
| list_id | string | Yes | The customer list id | Minimum characters: 1 |

## Responses

### 400

CredentialsMissingException - Indicates that the mandatory credentials are missing in the input document. or InvalidLoginException - Indicates the login does not match the login acceptance criteria. or LoginAlreadyInUseException - Indicates the login is already in use. or LoginMissingException - Indicates that the mandatory login property is missing in the input document.

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

### 404

CustomerListNotFoundException - Indicates that the customer list with the given customer list id is unknown.

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
  "birthday": "1970-01-31",
  "company_name": "Salesforce Commerce Cloud",
  "creation_date": "2013-09-17T09:20:31.000Z",
  "credentials": {
    "enabled": true,
    "locked": false,
    "login": "dude",
    "password_question": "Mother's maiden name"
  },
  "customer_no": "0815",
  "email": "dude@salesforce.com",
  "fax": "001-444-4444",
  "first_name": "Dude",
  "job_title": "",
  "last_name": "Lebowski",
  "phone_business": "001-222-2222",
  "phone_home": "001-111-1111",
  "phone_mobile": "001-333-3333",
  "preferred_locale": "de_DE",
  "salutation": "Mr.",
  "second_name": "second",
  "suffix": "suffix",
  "title": "Dr."
}
```

#### Body

Media types: application/json, text/xml

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| birthday | date |  | The customer's birthday. |  |
| company_name | string |  | The customer's company name. | Maximum characters: 256 |
| creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| credentials | object |  | Document representing the credentials of a customer. |  |
| customer_id | string |  | The customer's id. Both registered and guest customers have a customer id. | Maximum characters: 28 |
| customer_no | string |  | The customer's number. | Maximum characters: 100 |
| email | string |  | The customer's email address. | Maximum characters: 256 |
| fax | string |  | The fax number to use for the customer. The length is restricted to 32 characters. | Maximum characters: 32 |
| first_name | string |  | The customer's first name. | Maximum characters: 256 |
| gender | integer |  | The customer's gender. | Enum values: 12 |
| global_party_id | string |  | The Global Party ID is set by Customer 360 and identifies a person across multiple systems. |  |
| job_title | string |  | The customer's job title. | Maximum characters: 256 |
| last_login_time | datetime | Read-only | The last login time of the customer. |  |
| last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| last_name | string |  | The customer's last name. | Maximum characters: 256 |
| last_visit_time | datetime | Read-only | The last visit time of the customer. |  |
| phone_business | string |  | The customer's business phone number. | Maximum characters: 32 |
| phone_home | string |  | The customer's home phone number. | Maximum characters: 32 |
| phone_mobile | string |  | The customer's mobile phone number. | Maximum characters: 32 |
| preferred_locale | string | Read-only | The customer's preferred locale, formatted with a hyphen. (For example: en-US) If the request uses an underscore, as with the Java locale format, the stored value is converted to a hyphen. (For example: en_US is stored as en-US) |  |
| previous_login_time | datetime |  | The time when the customer logged in previously. |  |
| previous_visit_time | datetime |  | The time when the customer previously visited the store. |  |
| primary_address | object |  | Document representing a customer address. |  |
| salutation | string |  | The customer's salutation. | Maximum characters: 256 |
| second_name | string |  | The customer's second name. | Maximum characters: 256 |
| suffix | string |  | The customer's suffix (for example, "Jr." or "Sr."). | Maximum characters: 256 |
| title | string |  | The customer's title (for example, "Mrs" or "Mr"). | Maximum characters: 256 |
