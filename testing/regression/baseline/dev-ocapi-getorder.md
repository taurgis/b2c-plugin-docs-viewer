# Get order

Operation ID: Get order

**GET** `https://{host}/s/{siteId}/dw/shop/v25\_6/orders/{order\_no}`

Gets information for an order.

This endpoint may return the following faults:

-   404 - OrderNotFoundException - Indicates that the order with the given order number is unknown.

## Request

### Request Example

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/orders/{order_no}"`

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
| order_no | string | Yes | the order number | Minimum characters: 1 |

## Responses

### 404

OrderNotFoundException - Indicates that the order with the given order number is unknown.

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
  "adjusted_merchandize_total_tax": 0.05,
  "adjusted_shipping_total_tax": 0,
  "billing_address": {
    "city": "Boston",
    "country_code": "US",
    "first_name": "Jeff",
    "full_name": "Jeff Lebowski",
    "last_name": "Lebowski",
    "c_strValue": "cTest"
  },
  "creation_date": "2014-11-06T13:36Z",
  "currency": "USD",
  "customer_info": {
    "customer_no": "jlebowski",
    "email": "jeff@lebowski.com"
  },
  "merchandize_total_tax": 5,
  "order_no": "00000101",
  "order_token": "XizrH5hY1vB-Mxno-zfoCqTkegl3y7_OrRPGNZFlYG8",
  "order_total": 1.06,
  "payment_instruments": [
    {
      "amount": 1,
      "id": "cdKCIiWbNVndQaaadhlSa35gtp",
      "payment_bank_account": {
        "drivers_license_last_digits": "ense",
        "drivers_license_masked": "**************ense",
        "number_last_digits": "mber",
        "number_masked": "*************mber"
      },
      "payment_card": {
        "card_type": "testVisa",
        "credit_card_expired": false,
        "expiration_month": 4,
        "expiration_year": 21.2,
        "holder": "TestPerson",
        "number_last_digits": "mber",
        "number_masked": "**********mber"
      },
      "payment_method_id": "OCAPI_Payment_Simple"
    }
  ],
  "product_items": [
    {
      "adjusted_tax": 5,
      "base_price": 16.49,
      "bonus_product_line_item": false,
      "item_id": "cdHBEiWbNV9ZcaaadhrCk35gtp",
      "item_text": "Simple Product",
      "price": 16.49,
      "price_after_item_discount": 16.49,
      "price_after_order_discount": 1,
      "product_id": "SimpleProduct",
      "product_name": "Simple Product",
      "quantity": 1,
      "tax": 5,
      "tax_basis": 16.49,
      "tax_class_id": null,
      "tax_rate": 0.05,
      "c_strValue": "Test"
    }
  ],
  "product_sub_total": 16.49,
  "product_total": 1,
  "shipments": [
    {
      "id": "me",
      "shipping_address": {
        "city": "Boston",
        "country_code": "US",
        "first_name": "Jeff",
        "full_name": "Jeff Lebowski",
        "last_name": "Lebowski",
        "c_strValue": "cTest"
      },
      "shipping_method": {
        "description": {
          "default": "The base shipping method."
        },
        "id": "BaseShippingMethod",
        "name": {
          "default": "Base Shipping Method"
        },
        "price": 0.01,
        "c_somestring": "ShippingMethod String Value"
      }
    }
  ],
  "shipping_items": [
    {
      "adjusted_tax": 0,
      "base_price": 0.01,
      "item_id": "devgoiWbNVc92aaadhrSk35gtp",
      "item_text": "Shipping",
      "price": 0.01,
      "price_after_item_discount": 0.01,
      "shipment_id": "me",
      "tax": 0,
      "tax_basis": 0.01,
      "tax_class_id": "DefaultTaxClass",
      "tax_rate": 0.05
    }
  ],
  "shipping_total": 0.01,
  "shipping_total_tax": 0,
  "status": "created",
  "tax_total": 0.05,
  "c_strValue": "before submit basket",
  "c_textValue": "after submit basket"
}
```

#### Body

Media types: application/json, text/xml

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| adjusted_merchandize_total_tax | double |  | The products tax after discounts applying in purchase currency. Adjusted merchandize prices represent the sum of product prices before services such as shipping have been added, but after adjustment from promotions have been added. |  |
| adjusted_shipping_total_tax | double |  | The tax of all shipping line items of the line item container after shipping adjustments have been applied. |  |
| billing_address | object |  | Document representing an order address. |  |
| bonus_discount_line_items | array |  | The bonus discount line items of the line item container. |  |
| channel_type | string | Read-only | The sales channel for the order. | Enum values: storefrontcallcentermarketplacedssstorepinteresttwitterfacebookadssubscriptionsonlinereservationcustomerservicecenterinstagramcommercegoogletiktoksnapchatyoutubewhatsapp |
| confirmation_status | string |  | The confirmation status of the order. | Enum values: not_confirmedconfirmed |
| coupon_items | array |  | The sorted array of coupon items. This array can be empty. |  |
| created_by | string |  | The name of the user who created the order. |  |
| creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| currency | string |  | The ISO 4217 mnemonic code of the currency. |  |
| customer_info | object |  | Document representing information used to identify a customer. |  |
| customer_name | string |  | The name of the customer associated with this order. |  |
| export_status | string |  | The export status of the order. | Enum values: not_exportedexportedreadyfailed |
| external_order_status | string |  | The external status of the order. |  |
| gift_certificate_items | array |  | The sorted array of gift certificate line items. This array can be empty. |  |
| global_party_id | string |  | globalPartyId is managed by Customer 360. Its value can be changed. |  |
| grouped_tax_items | array |  | Tax values that are summed and grouped based on the tax rate. The tax totals of the line items with the same tax rate will be grouped together and summed up. This will not affect calculation in any way. |  |
| guest | boolean |  | The registration status of the customer. |  |
| last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| merchandize_total_tax | double |  | The products total tax in purchase currency. Merchandize total prices represent the sum of product prices before services such as shipping or adjustment from promotions have been added. |  |
| notes | object |  | Document representing a link to another resource. |  |
| order_no | string | Read-only | The order number of the order. |  |
| order_price_adjustments | array |  | The array of order level price adjustments. This array can be empty. |  |
| order_token | string |  | The order token used to secure the lookup of an order on base of the plain order number. The order token contains only URL safe characters. |  |
| order_total | double |  | The total price of the order, including products, shipping and tax. This property is part of basket checkout information only. |  |
| payment_instruments | array |  | The payment instruments list for the order. |  |
| payment_status | string |  | The payment status of the order. | Enum values: not_paidpart_paidpaid |
| product_items | array |  | The sorted array of product items (up to a maximum of 50 items by default). This array can be empty. |  |
| product_sub_total | double |  | The total price of all product items after all product discounts. Depending on taxation policy the returned price is net or gross. |  |
| product_total | double |  | The total price of all product items after all product and order discounts. Depending on taxation policy the returned price is net or gross. |  |
| shipments | array |  | The array of shipments. This property is part of basket checkout information only. |  |
| shipping_items | array |  | The sorted array of shipping items. This array can be empty. |  |
| shipping_status | string |  | The shipping status of the order. | Enum values: not_shippedpart_shippedshipped |
| shipping_total | double |  | The total shipping price of the order after all shipping discounts. Excludes tax if taxation policy is net. Includes tax if taxation policy is gross. This property is part of basket checkout information only. Includes tax if taxation policy is gross. |  |
| shipping_total_tax | double |  | The tax of all shipping line items of the line item container before shipping adjustments have been applied. |  |
| site_id | string |  | The site where the order resides. |  |
| source_code | string |  | Gets the source code assigned to this basket. |  |
| status | string |  | The status of the order. | Enum values: creatednewopencompletedcancelledreplacedfailed |
| tax_rounded_at_group | boolean |  | If the tax is rounded at group level then this is set to true, false if the tax is rounded at item or unit level |  |
| tax_total | double |  | The total tax amount of the order. This property is part of basket checkout information only. |  |
| taxation | string |  | The taxation the line item container is based on. | Enum values: grossnet |
