# Register customer

Operation ID: Register customer

**POST** `https://{host}/s/{siteId}/dw/shop/v25\_6/customers`

Registers a customer.

You must specify the login credentials, last name, and email address. This method ignores all other data, which can only be set for an existing customer. To set other values, make calls after the customer is created.

When using OAuth, don't include the password in the request. In this case, including the password throws an `InvalidPasswordException` .

When using JWT, the password is required.

Also returns the hashedLoginId for Einstein use cases.

Note: If customers are created using OCAPI call then any updated to the customer records should be done through OCAPI calls as well. The customer records created with Script API call should not be updated with OCAPI calls as the email validation is handled differently in these calls and may result in InvalidEmailException.

This endpoint may return the following faults:

-   400 - CustomerAlreadyRegisteredException - Indicates that the resource is called with JWT representing a registered customer.

-   400 - InvalidLoginException - Indicates that login doesn't match acceptance criteria.

-   400 - InvalidPasswordException - Indicates that password doesn't match acceptance criteria.

-   400 - LoginAlreadyInUseException - Indicates that the given login is already used.

-   400 - MissingEmailException - Indicates that request document does not contain email.

-   400 - MissingLastNameException - Indicates that request document does not contain last\_name.

-   400 - MissingLoginException - Indicates that request document does not contain login.

-   400 - MissingPasswordException - Indicates that password was not provided in JWT scenario.

## Request

### Request Example

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/customers" \ -X POST \ -H "content-type: application/json" \ -d '{ "customer": { "email": "jsmith@test.com", "last_name": "Smith", "login": "jsmith" }, "password": "12345!aBcD" }'`

### Body

Media types: application/json, text/xml

### Example

Media types: application/json

```json
{
  "customer": {
    "email": "jsmith@test.com",
    "last_name": "Smith",
    "login": "jsmith"
  },
  "password": "12345!aBcD"
}
```

Media types: text/xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<customer_registration>
  <customer>
    <email>jsmith@test.com</email>
    <last_name>Smith</last_name>
    <login>jsmith</login>
  </customer>
  <password>12345!aBcD</password>
</customer_registration>
```

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| customer | object | Required | Document representing a customer. |  |
| customer.addresses | array |  | The customer's addresses. |  |
| customer.auth_type | string |  | The customer's authorization type (indicates if the customer is a guest or a registered customer). | Enum values: guestregistered |
| customer.birthday | date |  | The customer's birthday. |  |
| customer.company_name | string |  | The customer's company name. | Maximum characters: 256 |
| customer.customer_no | string |  | The customer's number (id). Only a registered customer has a customer number. | Maximum characters: 100 |
| customer.email | string |  | The customer's email address. | Maximum characters: 256 |
| customer.enabled | boolean |  | A flag indicating whether this customer is is enabled and can log in. |  |
| customer.fax | string |  | The customer's fax number. The length is restricted to 32 characters. | Maximum characters: 32 |
| customer.first_name | string |  | The customer's first name. | Maximum characters: 256 |
| customer.gender | integer |  | The customer's gender. | Enum values: 12 |
| customer.hashed_login | string |  | The customer's hashed LoginId which is used for activity tracking for logged in customers in conjunction with visitId. This field is READ-ONLY |  |
| customer.job_title | string |  | The customer's job title. | Maximum characters: 256 |
| customer.last_name | string |  | The customer's last name. | Maximum characters: 256 |
| customer.login | string |  | The customer's login. | Maximum characters: 256 |
| customer.note | string |  | The customer's note. |  |
| customer.payment_instruments | array |  | The customer's payment instruments. |  |
| customer.phone_business | string |  | The customer's business phone number. | Maximum characters: 32 |
| customer.phone_home | string |  | The customer's home phone number. | Maximum characters: 32 |
| customer.phone_mobile | string |  | The customer's mobile phone number. | Maximum characters: 32 |
| customer.previous_login_time | datetime |  | The time when the customer logged in previously. |  |
| customer.previous_visit_time | datetime |  | The time when the customer last visited the store. visit. |  |
| customer.salutation | string |  | The salutation to use for the customer. | Maximum characters: 256 |
| customer.second_name | string |  | The customer's second name. | Maximum characters: 256 |
| customer.suffix | string |  | The customer's suffix (for example, "Jr." or "Sr."). | Maximum characters: 256 |
| customer.title | string |  | The customer's title (for example, "Mrs" or "Mr"). | Maximum characters: 256 |
| customer.visit_id | string |  | The customer's visitId. This field is READ-ONLY |  |
| password | string |  | The password to authorize. | Maximum characters: 4096 |

## Security

## Basic Authentication

User authentication either for a registered or a guest customer (selectable in request body). Access via Base64 encoded customer:password string as 'Authorization: Basic' header.

### OAuth 2.0

Authentication flow with client ID and password with account manager.

#### Settings

## Api Key

Add client ID for application identification. Alternative as 'client\_id' query parameter.

## Responses

### 400

CustomerAlreadyRegisteredException - Indicates that the resource is called with JWT representing a registered customer. or InvalidLoginException - Indicates that login doesn't match acceptance criteria. or InvalidPasswordException - Indicates that password doesn't match acceptance criteria. or LoginAlreadyInUseException - Indicates that the given login is already used. or MissingEmailException - Indicates that request document does not contain email. or MissingLastNameException - Indicates that request document does not contain last_name. or MissingLoginException - Indicates that request document does not contain login. or MissingPasswordException - Indicates that password was not provided in JWT scenario.

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
  "adresses": [
    {
      "address1": "10 Presidential Way",
      "address_id": "me",
      "city": "Woburn",
      "country_code": "US",
      "first_name": "John",
      "full_name": "John M. Smith",
      "last_name": "Smith",
      "postal_code": "01827",
      "salutation": "Mr.",
      "state_code": "MA"
    }
  ],
  "auth_type": "registered",
  "creation_date": "2015-08-20T11:30:36.000Z",
  "customer_id": "abfTWMDZOgi3JPzkHjv9IhmziI",
  "customer_no": "999",
  "email": "jsmith@salesforce.com",
  "first_name": "John",
  "gender": 1,
  "last_name": "Smith",
  "payment_instruments": [
    {
      "payment_bank_account": {
        "_type": "payment_bank_account"
      },
      "payment_card": {
        "card_type": "Visa",
        "credit_card_expired": false,
        "expiration_month": 2,
        "expiration_year": 2022,
        "holder": "John Smith",
        "masked_number": "***********ber2",
        "number_last_digits": "ber2"
      },
      "payment_instrument_id": "beybQiWcyatEEaaadniwhKxxFl",
      "payment_method_id": "CREDIT_CARD",
      "uuid": "beybQiWcyatEEaaadniwhKxxFl"
    }
  ],
  "phone_business": "234560003",
  "phone_home": "123450003",
  "phone_mobile": "345670003",
  "c_origin": "webshop"
}
```

#### Body

Media types: application/json, text/xml

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| addresses | array |  | The customer's addresses. |  |
| addresses.address1 | string |  | The first address. | Maximum characters: 256 |
| addresses.address2 | string |  | The second address. | Maximum characters: 256 |
| addresses.address_id | string |  | The id of the address as specified by account owner. | Maximum characters: 256 |
| addresses.city | string |  | The city. | Maximum characters: 256 |
| addresses.company_name | string |  | The company name. | Maximum characters: 256 |
| addresses.country_code | string |  | The two-letter ISO 3166-1 (Alpha-2) country code. | Maximum characters: 2; Enum values: CADEUS |
| addresses.creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| addresses.first_name | string |  | The first name. | Maximum characters: 256 |
| addresses.full_name | string |  | The full name. | Maximum characters: 256 |
| addresses.job_title | string |  | The job title. | Maximum characters: 256 |
| addresses.last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| addresses.last_name | string |  | The last name. | Maximum characters: 256 |
| addresses.phone | string |  | The phone number. | Maximum characters: 32 |
| addresses.post_box | string |  | The post box. | Maximum characters: 256 |
| addresses.postal_code | string |  | The postal code. | Maximum characters: 256 |
| addresses.preferred | boolean |  | The preferred attribute. |  |
| addresses.salutation | string |  | The salutation. | Maximum characters: 256 |
| addresses.second_name | string |  | The second name. | Maximum characters: 256 |
| addresses.state_code | string |  | The state code. | Maximum characters: 256 |
| addresses.suffix | string |  | The suffix. | Maximum characters: 256 |
| addresses.suite | string |  | The suite. | Maximum characters: 32 |
| addresses.title | string |  | The title. | Maximum characters: 256 |
| auth_type | string |  | The customer's authorization type (indicates if the customer is a guest or a registered customer). | Enum values: guestregistered |
| birthday | date |  | The customer's birthday. |  |
| company_name | string |  | The customer's company name. | Maximum characters: 256 |
| creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| customer_id | string | Read-only | The customer's number (id). Both registered and guest customers have a customer id. | Maximum characters: 28 |
| customer_no | string |  | The customer's number (id). Only a registered customer has a customer number. | Maximum characters: 100 |
| email | string |  | The customer's email address. | Maximum characters: 256 |
| enabled | boolean |  | A flag indicating whether this customer is is enabled and can log in. |  |
| fax | string |  | The customer's fax number. The length is restricted to 32 characters. | Maximum characters: 32 |
| first_name | string |  | The customer's first name. | Maximum characters: 256 |
| gender | integer |  | The customer's gender. | Enum values: 12 |
| hashed_login | string |  | The customer's hashed LoginId which is used for activity tracking for logged in customers in conjunction with visitId. This field is READ-ONLY |  |
| job_title | string |  | The customer's job title. | Maximum characters: 256 |
| last_login_time | datetime | Read-only | The time when the customer last logged in. |  |
| last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| last_name | string |  | The customer's last name. | Maximum characters: 256 |
| last_visit_time | datetime | Read-only | The time when the customer last visited. |  |
| login | string |  | The customer's login. | Maximum characters: 256 |
| note | string |  | The customer's note. |  |
| payment_instruments | array |  | The customer's payment instruments. |  |
| phone_business | string |  | The customer's business phone number. | Maximum characters: 32 |
| phone_home | string |  | The customer's home phone number. | Maximum characters: 32 |
| phone_mobile | string |  | The customer's mobile phone number. | Maximum characters: 32 |
| preferred_locale | string | Read-only | The customer's preferred locale. |  |
| previous_login_time | datetime |  | The time when the customer logged in previously. |  |
| previous_visit_time | datetime |  | The time when the customer last visited the store. visit. |  |
| salutation | string |  | The salutation to use for the customer. | Maximum characters: 256 |
| second_name | string |  | The customer's second name. | Maximum characters: 256 |
| suffix | string |  | The customer's suffix (for example, "Jr." or "Sr."). | Maximum characters: 256 |
| title | string |  | The customer's title (for example, "Mrs" or "Mr"). | Maximum characters: 256 |
| visit_id | string |  | The customer's visitId. This field is READ-ONLY |  |
