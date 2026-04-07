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

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| birthday | date |  | The customer's birthday. |  |
| company_name | string |  | The customer's company name. |  |
| credentials | object |  | Document representing the credentials of a customer. |  |
| credentials.enabled | boolean |  | A flag indicating whether the customer is enabled and can log. |  |
| credentials.locked | boolean |  | A flag indicating whether the customer account is locked. |  |
| credentials.login | string | Required | The login of the customer. |  |
| credentials.password_question | string |  | The password question. |  |
| customer_id | string |  | The customer's id. Both registered and guest customers have a customer id. |  |
| customer_no | string |  | The customer's number. |  |
| email | string |  | The customer's email address. |  |
| fax | string |  | The fax number to use for the customer. The length is restricted to 32 characters. |  |
| first_name | string |  | The customer's first name. |  |
| gender | integer |  | The customer's gender. |  |
| global_party_id | string |  | The Global Party ID is set by Customer 360 and identifies a person across multiple systems. |  |
| job_title | string |  | The customer's job title. |  |
| last_name | string |  | The customer's last name. |  |
| phone_business | string |  | The customer's business phone number. |  |
| phone_home | string |  | The customer's home phone number. |  |
| phone_mobile | string |  | The customer's mobile phone number. |  |
| previous_login_time | datetime |  | The time when the customer logged in previously. |  |
| previous_visit_time | datetime |  | The time when the customer previously visited the store. |  |
| primary_address | object |  | Document representing a customer address. |  |
| primary_address.address1 | string |  | The customer's first address. |  |
| primary_address.address2 | string |  | The customer's second address value. |  |
| primary_address.address_id | string | Required | The customer address id. |  |
| primary_address.city | string |  | The customer's city. |  |
| primary_address.company_name | string |  | The customer's company name. |  |
| primary_address.country_code | string | Required | The customer's two-character country code per ISO 3166-1 alpha-2. |  |
| primary_address.etag | string |  |  |  |
| primary_address.first_name | string |  | The customer's first name. |  |
| primary_address.full_name | string |  | The concatenation of the customer's first, middle, and last names and its suffix. |  |
| primary_address.job_title | string |  | The customer's job title. |  |
| primary_address.last_name | string | Required | The customer's last name. |  |
| primary_address.phone | string |  | The customer's phone number. |  |
| primary_address.post_box | string |  | The customer's post box. |  |
| primary_address.postal_code | string |  | The customer's postal code. |  |
| primary_address.salutation | string |  | The customer's salutation. |  |
| primary_address.second_name | string |  | The customer's second name. |  |
| primary_address.state_code | string |  | The customer's state. |  |
| primary_address.suffix | string |  | The customer's suffix. |  |
| primary_address.suite | string |  | The customer's suite. |  |
| primary_address.title | string |  | The customer's title. |  |
| salutation | string |  | The customer's salutation. |  |
| second_name | string |  | The customer's second name. |  |
| suffix | string |  | The customer's suffix (for example, "Jr." or "Sr."). |  |
| title | string |  | The customer's title (for example, "Mrs" or "Mr"). |  |

## Security

### OAuth 2.0

Authentication flow with client ID and password with account manager.

#### Settings

#### URI Parameters

| Name | Type | Required | Description | Constraints |
| --- | --- | --- | --- | --- |
| list_id | string | Yes | The customer list id | Minimum characters: 1 |

### Body

Media types: application/json, text/xml

### Example

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
  "email": "",
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

birthday

date

The customer's birthday.

company\_name

string

The customer's company name.

Maximum characters: 256

credentials

object

Document representing the credentials of a customer.

### Example

enabled

boolean

A flag indicating whether the customer is enabled and can log.

locked

boolean

A flag indicating whether the customer account is locked.

login

string

Required

The login of the customer.

Maximum characters: 256

password\_question

string

The password question.

Maximum characters: 256

customer\_id

string

The customer's id. Both registered and guest customers have a customer id.

Maximum characters: 28

customer\_no

string

The customer's number.

Maximum characters: 100

email

string

The customer's email address.

Maximum characters: 256

fax

string

The fax number to use for the customer. The length is restricted to 32 characters.

Maximum characters: 32

first\_name

string

The customer's first name.

Maximum characters: 256

gender

integer enum

The customer's gender.

enum-labels

Enum values:

-   1

-   2

global\_party\_id

string

The Global Party ID is set by Customer 360 and identifies a person across multiple systems.

job\_title

string

The customer's job title.

Maximum characters: 256

last\_name

string

The customer's last name.

Maximum characters: 256

phone\_business

string

The customer's business phone number.

Maximum characters: 32

phone\_home

string

The customer's home phone number.

Maximum characters: 32

phone\_mobile

string

The customer's mobile phone number.

Maximum characters: 32

previous\_login\_time

datetime

The time when the customer logged in previously.

previous\_visit\_time

datetime

The time when the customer previously visited the store.

primary\_address

object

Document representing a customer address.

### Example

address1

string

The customer's first address.

Maximum characters: 256

address2

string

The customer's second address value.

Maximum characters: 256

address\_id

string

Required

The customer address id.

Maximum characters: 256

city

string

The customer's city.

Maximum characters: 256

company\_name

string

The customer's company name.

Maximum characters: 256

country\_code

string enum

Required

The customer's two-character country code per ISO 3166-1 alpha-2.

enum-labels

Maximum characters: 2

Enum values:

-   CA

-   DE

-   US

etag

string

first\_name

string

The customer's first name.

Maximum characters: 256

full\_name

string

The concatenation of the customer's first, middle, and last names and its suffix.

job\_title

string

The customer's job title.

Maximum characters: 256

last\_name

string

Required

The customer's last name.

Maximum characters: 256

phone

string

The customer's phone number.

Maximum characters: 32

post\_box

string

The customer's post box.

Maximum characters: 256

postal\_code

string

The customer's postal code.

Maximum characters: 256

salutation

string

The customer's salutation.

Maximum characters: 256

second\_name

string

The customer's second name.

Maximum characters: 256

state\_code

string

The customer's state.

Maximum characters: 256

suffix

string

The customer's suffix.

Maximum characters: 256

suite

string

The customer's suite.

Maximum characters: 32

title

string

The customer's title.

Maximum characters: 256

salutation

string

The customer's salutation.

Maximum characters: 256

second\_name

string

The customer's second name.

Maximum characters: 256

suffix

string

The customer's suffix (for example, "Jr." or "Sr.").

Maximum characters: 256

title

string

The customer's title (for example, "Mrs" or "Mr").

Maximum characters: 256

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
| company_name | string |  | The customer's company name. |  |
| creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| credentials | object |  | Document representing the credentials of a customer. |  |
| customer_id | string |  | The customer's id. Both registered and guest customers have a customer id. |  |
| customer_no | string |  | The customer's number. |  |
| email | string |  | The customer's email address. |  |
| fax | string |  | The fax number to use for the customer. The length is restricted to 32 characters. |  |
| first_name | string |  | The customer's first name. |  |
| gender | integer |  | The customer's gender. |  |
| global_party_id | string |  | The Global Party ID is set by Customer 360 and identifies a person across multiple systems. |  |
| job_title | string |  | The customer's job title. |  |
| last_login_time | datetime | Read-only | The last login time of the customer. |  |
| last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| last_name | string |  | The customer's last name. |  |
| last_visit_time | datetime | Read-only | The last visit time of the customer. |  |
| phone_business | string |  | The customer's business phone number. |  |
| phone_home | string |  | The customer's home phone number. |  |
| phone_mobile | string |  | The customer's mobile phone number. |  |
| preferred_locale | string | Read-only | The customer's preferred locale, formatted with a hyphen. (For example: en-US) If the request uses an underscore, as with the Java locale format, the stored value is converted to a hyphen. (For example: en_US is stored as en-US) |  |
| previous_login_time | datetime |  | The time when the customer logged in previously. |  |
| previous_visit_time | datetime |  | The time when the customer previously visited the store. |  |
| primary_address | object |  | Document representing a customer address. |  |
| salutation | string |  | The customer's salutation. |  |
| second_name | string |  | The customer's second name. |  |
| suffix | string |  | The customer's suffix (for example, "Jr." or "Sr."). |  |
| title | string |  | The customer's title (for example, "Mrs" or "Mr"). |  |
