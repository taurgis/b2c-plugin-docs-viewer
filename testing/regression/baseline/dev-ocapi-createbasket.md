# Create basket

Operation ID: Create basket

**POST** `https://{host}/s/{siteId}/dw/shop/v25\_6/baskets`

Creates a new basket. The created basket is initialized with default values. Data provided in the body document will be populated into the created basket. Query parameter `temporary` can be set to `true` to create a temporary basket for the customer. The default value is `false` . Temporary baskets are separate from shopper storefront and agent baskets, and are intended for use to perform calculations or create an order without disturbing a shopper's open storefront basket. Temporary baskets are automatically deleted after a short time (15 minutes). A temporary basket can be identified with the property `temporary_basket` , which is `true` for temporary basket and `false` otherwise. Temporary baskets are available to all shoppers including guests (unlike agent baskets). All functionality that exists for a basket also applies to a temporary basket.

A basket can be updated with further Shop API calls. Considered values from the request body are:

-   customer information: PUT /baskets/{basket\_id}/customer

-   billing address: PUT /baskets/{basket\_id}/billing\_address

-   shipments including shipping address and shipping method: POST /baskets/{basket\_id}/shipments

-   product items: POST /baskets/{basket\_id}/items

-   coupon items: POST /baskets/{basket\_id}/coupons

-   Invalid coupons are silently ignored.

-   gift certificate items: POST /baskets/{basket\_id}/gift\_certificates

-   payment method and card type: POST /baskets/{basket\_id}/payment\_instruments

-   custom properties: PATCH /baskets/{basket\_id}

Related resource means with which resource you can specify the same data after the basket creation. Identify the basket using the `basket_id` property, which should be integrated into the path of an update request, for example a POST to `/baskets/{basket_id}/items` . The resource supports JWT or OAuth tokens for authentication:

-   A customer must provide a JWT which specifies exactly one customer (it may be a guest or a registered customer). In this case the resource creates a basket for this customer.

-   An agent must provide an OAuth token. The agent can use this resource to create a basket for a newly created guest customer, and can later update the customer if desired.

The number of baskets which can be created per customer is limited. When a basket is created it is said to be *open* . It remains *open* until either an order is created from it using a POST to resource `/orders` or it is *deleted* using a DELETE to resource `/baskets/{basket_id}` . The number of *open* baskets allowed depends on the authentication method used and the type of basket:

-   When using JWT each customer can have just 1 *open* basket. In addition, each customer can have up to 4 *open temporary* baskets (by default).

-   When using OAuth each customer can have up to 4 *open* baskets. These baskets can be temporary baskets or a mix of storefront and temporary baskets.

Custom properties in the form c\_ < CUSTOM\_NAME > are supported. A custom property must correspond to a custom attribute ( < CUSTOM\_NAME > ) defined for the Basket system object, and its value must be valid for that custom attribute. Other basket properties like the channel type or source code cannot be set with this resource.

This endpoint may return the following faults:

-   400 - CustomerBasketsQuotaExceededException - Thrown if a new basket cannot be created because the maximum number of baskets per customer would be exceeded.

-   400 - CustomerTemporaryBasketsQuotaExceededException - Thrown if a new temporary basket cannot be created because the maximum number of temporary baskets per customer would be exceeded.

-   400 - DuplicateShipmentIdException - Indicates that the same shipment id appeared twice in the body.

-   400 - InvalidCustomerException - Thrown if the customerId URL parameter does not match the verified customer represented by the JWT, not relevant when using OAuth.

-   400 - InvalidPaymentMethodIdException - Indicates that the provided payment method is invalid or not applicable.

-   400 - InvalidPriceAdjustmentLevelException - Indicates that a fixed price adjustment was added at order level which is disallowed.

-   400 - InvalidPromotionIdException - When attempting to add a price adjustment, indicates that a promotion id was used twice.

-   400 - MissingCouponCodeException - Thrown if the coupon number is not provided.

-   400 - SystemPromotionIdException - When attempting to add a price adjustment, indicates that a system promotion id was used as a manual promotion id.

-   400 - TooManyPromotionsException - Indicates that more than one hundred price adjustments would have been created.

-   404 - ShipmentNotFoundException - Thrown if the shipment with the given shipment id is unknown.

## Request

### Request Example

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/baskets" \ -X POST \ -H "content-type: application/json" \ -d '{ "basket_id": "bczFTaOjgEqUkaaadkvHwbgrP5", "currency": "USD", "customer_info": { "customer_id": "adNJrbxJovaT5DPxUSfOywk6Et", "email": "" }, "order_total": 0, "product_sub_total": 0, "product_total": 0, "shipments": [ { "id": "me", "shipment_id": "bc5OTaOjgEqUoaaadkvHwbgrP5" } ], "shipping_items": [ { "item_id": "bcwsbaOjgEqUsaaadkvHwbgrP5", "shipment_id": "me" } ], "shipping_total": 0, "shipping_total_tax": 0, "tax_total": 0, "taxation": "net" }'`

### Body

Media types: application/json, text/xml

### Example

Media types: application/json

```json
{
  "basket_id": "bczFTaOjgEqUkaaadkvHwbgrP5",
  "currency": "USD",
  "customer_info": {
    "customer_id": "adNJrbxJovaT5DPxUSfOywk6Et",
    "email": ""
  },
  "order_total": 0,
  "product_sub_total": 0,
  "product_total": 0,
  "shipments": [
    {
      "id": "me",
      "shipment_id": "bc5OTaOjgEqUoaaadkvHwbgrP5"
    }
  ],
  "shipping_items": [
    {
      "item_id": "bcwsbaOjgEqUsaaadkvHwbgrP5",
      "shipment_id": "me"
    }
  ],
  "shipping_total": 0,
  "shipping_total_tax": 0,
  "tax_total": 0,
  "taxation": "net"
}
```

Media types: text/xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<basket>
  <basket_id>bczFTaOjgEqUkaaadkvHwbgrP5</basket_id>
  <currency>USD</currency>
  <customer_info>
    <customer_id>adNJrbxJovaT5DPxUSfOywk6Et</customer_id>
    <email></email>
  </customer_info>
  <order_total>0</order_total>
  <product_sub_total>0</product_sub_total>
  <product_total>0</product_total>
  <shipments>
    <id>me</id>
    <shipment_id>bc5OTaOjgEqUoaaadkvHwbgrP5</shipment_id>
  </shipments>
  <shipping_items>
    <item_id>bcwsbaOjgEqUsaaadkvHwbgrP5</item_id>
    <shipment_id>me</shipment_id>
  </shipping_items>
  <shipping_total>0</shipping_total>
  <shipping_total_tax>0</shipping_total_tax>
  <tax_total>0</tax_total>
  <taxation>net</taxation>
</basket>
```

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| adjusted_merchandize_total_tax | double |  | The products tax after discounts applying in purchase currency. Adjusted merchandize prices represent the sum of product prices before services such as shipping have been added, but after adjustment from promotions have been added. |  |
| adjusted_shipping_total_tax | double |  | The tax of all shipping line items of the line item container after shipping adjustments have been applied. |  |
| agent_basket | boolean |  | Is the basket created by an agent? |  |
| basket_id | string |  | The unique identifier for the basket. |  |
| billing_address | object |  | Document representing an order address. |  |
| billing_address.address1 | string |  | The first address. |  |
| billing_address.address2 | string |  | The second address. |  |
| billing_address.city | string |  | The city. |  |
| billing_address.company_name | string |  | The company name. |  |
| billing_address.country_code | string |  | The two-letter ISO 3166-1 (Alpha-2) country code. | Enum values: CADEUS |
| billing_address.first_name | string |  | The first name. |  |
| billing_address.full_name | string |  | The full name. |  |
| billing_address.id | string |  | Id used to identify this address |  |
| billing_address.job_title | string |  | The job title. |  |
| billing_address.last_name | string |  | The last name. |  |
| billing_address.phone | string |  | The phone number. |  |
| billing_address.post_box | string |  | The post box. |  |
| billing_address.postal_code | string |  | The postal code. |  |
| billing_address.salutation | string |  | The salutation. |  |
| billing_address.second_name | string |  | The second name. |  |
| billing_address.state_code | string |  | The state code. |  |
| billing_address.suffix | string |  | The suffix. |  |
| billing_address.suite | string |  | The suite. |  |
| billing_address.title | string |  | The title. |  |
| bonus_discount_line_items | array |  | The bonus discount line items of the line item container. |  |
| bonus_discount_line_items.bonus_products | array |  | The list of links to the bonus products the customer can choose from. |  |
| bonus_discount_line_items.coupon_code | string |  | The coupon code that triggered the promotion, if applicable. |  |
| bonus_discount_line_items.id | string |  | The ID of the line item. |  |
| bonus_discount_line_items.max_bonus_items | integer |  | The maximum number of bonus items the user can select for this promotion. |  |
| bonus_discount_line_items.promotion_id | string |  | The ID of the promotion which triggered the creation of the line item. |  |
| coupon_items | array |  | The sorted array of coupon items. This array can be empty. |  |
| coupon_items.code | string | Required | The coupon code. | Maximum characters: 256 |
| coupon_items.coupon_item_id | string |  | The coupon item id. |  |
| coupon_items.status_code | string |  | The status of the coupon item. | Enum values: coupon_code_already_in_basketcoupon_code_already_redeemedcoupon_code_unknowncoupon_disabledredemption_limit_exceededcustomer_redemption_limit_exceededtimeframe_redemption_limit_exceededno_active_promotioncoupon_already_in_basketno_applicable_promotionappliedadhoc |
| coupon_items.valid | boolean |  | A flag indicating whether the coupon item is valid. A coupon line item is valid if the status code is 'applied' or 'no_applicable_promotion'. |  |
| currency | string |  | The ISO 4217 mnemonic code of the currency. |  |
| customer_info | object |  | Document representing information used to identify a customer. |  |
| customer_info.customer_id | string |  | The customer's number (id). | Maximum characters: 100 |
| customer_info.customer_name | string |  |  |  |
| customer_info.customer_no | string |  | The customer's number (id). | Maximum characters: 100 |
| customer_info.email | string | Required | The customer's email address. |  |
| gift_certificate_items | array |  | The sorted array of gift certificate line items. This array can be empty. |  |
| gift_certificate_items.amount | double | Required | The certificate item amount. |  |
| gift_certificate_items.gift_certificate_item_id | string |  | Id used to identify this item |  |
| gift_certificate_items.message | string |  | The certificate's message. | Maximum characters: 4000 |
| gift_certificate_items.recipient_email | string | Required | The recipient's email. | Minimum characters: 1 |
| gift_certificate_items.recipient_name | string |  | The recipient's name. |  |
| gift_certificate_items.sender_name | string |  | The sender's name. |  |
| gift_certificate_items.shipment_id | string |  | The shipment id. |  |
| grouped_tax_items | array |  | Tax values that are summed and grouped based on the tax rate. The tax totals of the line items with the same tax rate will be grouped together and summed up. This will not affect calculation in any way. |  |
| grouped_tax_items.tax_rate | double |  | The tax rate |  |
| grouped_tax_items.tax_value | double |  | The summed up tax total for the tax rate |  |
| inventory_reservation_expiry | datetime |  |  |  |
| merchandize_total_tax | double |  | The products total tax in purchase currency. Merchandize total prices represent the sum of product prices before services such as shipping or adjustment from promotions have been added. |  |
| notes | object |  | Document representing a link to another resource. |  |
| notes.link | string |  | The link to the resource. |  |
| order_price_adjustments | array |  | The array of order level price adjustments. This array can be empty. |  |
| order_price_adjustments.applied_discount | object |  | Document representing a discount that was either optionally applied when creating a custom price adjustment or applied by the promotion engine. The property type is mandatory; the properties amount and priceBookId are used only in association with specific types. Some examples: Type percentage with percentage 15.00 : a 15% discount was applied. Type amount with amount 5.99 : a discount was applied to reduce the (unit) price by 5.99. Type fixed_price with amount 49.99 : a discount was applied to reduce the price to 49.99. Type free : a discount was applied to reduce the price to zero. Type price_book_price with price_book_id MyPriceBook : a discount was applied to set the price to that defined in MyPriceBook. |  |
| order_price_adjustments.coupon_code | string |  | The coupon code that triggered the promotion, provided the price adjustment was created as the result of a promotion being triggered by a coupon. |  |
| order_price_adjustments.created_by | string |  | The user who created the price adjustment. |  |
| order_price_adjustments.creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| order_price_adjustments.custom | boolean |  | A flag indicating whether this price adjustment was created by custom logic. This flag is set to true unless the price adjustment was created by the promotion engine. |  |
| order_price_adjustments.item_text | string |  | The text describing the item in more detail. |  |
| order_price_adjustments.last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| order_price_adjustments.manual | boolean |  | A flag indicating whether this price adjustment was created in a manual process. For custom price adjustments created using the shop API, this always returns true. Using the scripting API, however, it is possible to set this to true or false, according to the use case. |  |
| order_price_adjustments.price | double |  | The adjustment price. |  |
| order_price_adjustments.price_adjustment_id | string |  | The price adjustment id (uuid). |  |
| order_price_adjustments.promotion_id | string |  | The id of the related promotion. Custom price adjustments can be assigned any promotion id so long it is not used by a price adjustment belonging to the same item and is not used by promotion defined in the promotion engine. If not specified, a promotion id is generated. |  |
| order_price_adjustments.promotion_link | string |  | The URL addressing the related promotion. |  |
| order_price_adjustments.reason_code | string |  | The reason why this price adjustment was made. | Enum values: BACKORDEREVEN_EXCHANGEPRICE_MATCH |
| order_total | double |  | The total price of the order, including products, shipping and tax. This property is part of basket checkout information only. |  |
| payment_instruments | array |  | The payment instruments list for the order. |  |
| payment_instruments.amount | double |  | The payment transaction amount. |  |
| payment_instruments.authorization_status | object |  | Document representing a status of an object. |  |
| payment_instruments.bank_routing_number | string |  | The bank routing number. | Maximum characters: 256 |
| payment_instruments.masked_gift_certificate_code | string |  | The masked gift certificate code. |  |
| payment_instruments.payment_bank_account | object |  | Document representing a payment bank account. |  |
| payment_instruments.payment_card | object |  | Document representing a payment card. |  |
| payment_instruments.payment_instrument_id | string |  | The payment instrument ID. |  |
| payment_instruments.payment_method_id | string |  | The payment method id. Optional if a customer payment instrument id is specified. | Maximum characters: 256 |
| product_items | array |  | The sorted array of product items (up to a maximum of 50 items by default). This array can be empty. |  |
| product_items.adjusted_tax | double |  | The tax of the product item after adjustments applying. |  |
| product_items.base_price | double |  | The base price for the line item, which is the price of the unit before applying adjustments, in the purchase currency. The base price may be net or gross of tax depending on the configured taxation policy. |  |
| product_items.bonus_discount_line_item_id | string |  | The id of the bonus discount line item this bonus product relates to. |  |
| product_items.bonus_product_line_item | boolean |  | A flag indicating whether the product item is a bonus. |  |
| product_items.bundled_product_items | array |  | The array of bundled product items. Can be empty. |  |
| product_items.gift | boolean |  | Returns true if the item is a gift. |  |
| product_items.gift_message | string |  | The gift message. |  |
| product_items.inventory_id | string |  | The inventory list id associated with this item. | Maximum characters: 256 |
| product_items.item_id | string |  | The item identifier. Use this to identify an item when updating the item quantity or creating a custom price adjustment for an item. |  |
| product_items.item_text | string |  | The text describing the item in more detail. |  |
| product_items.option_items | array |  | The array of option items. This array can be empty. |  |
| product_items.price | double |  | The price of the line item before applying any adjustments. If the line item is based on net pricing then the net price is returned. If the line item is based on gross pricing then the gross price is returned. |  |
| product_items.price_adjustments | array |  | Array of price adjustments. Can be empty. |  |
| product_items.price_after_item_discount | double |  | The price of the product line item after applying all product-level adjustments. For net pricing the adjusted net price is returned. For gross pricing, the adjusted gross price is returned. |  |
| product_items.price_after_order_discount | double |  | The price of this product line item after considering all dependent price adjustments and prorating all order-level price adjustments. For net pricing the net price is returned. For gross pricing, the gross price is returned. |  |
| product_items.product_id | string |  | The id (SKU) of the product. | Maximum characters: 100 |
| product_items.product_list_item | object |  |  |  |
| product_items.product_name | string |  | The name of the product. |  |
| product_items.quantity | double | Required | The quantity of the products represented by this item. | Min value: 0 |
| product_items.shipment_id | string |  | The id of the shipment which includes the product item. |  |
| product_items.shipping_item_id | string |  | The reference to the related shipping item if it exists. This is the case if for example when a surcharge is defined for individual products using a particular a shipping method. |  |
| product_items.tax | double |  | The tax of the product item before adjustments applying. |  |
| product_items.tax_basis | double |  | The price used to calculate the tax for this product item. null if tax has not been set for this product item yet |  |
| product_items.tax_class_id | string |  | The tax class ID for the product item or null if no tax class ID is associated with the product item. if no tax class ID is associated with the product item |  |
| product_items.tax_rate | double |  | The tax rate, which is the decimal tax rate to be applied to the product represented by this item. |  |
| product_sub_total | double |  | The total price of all product items after all product discounts. Depending on taxation policy the returned price is net or gross. |  |
| product_total | double |  | The total price of all product items after all product and order discounts. Depending on taxation policy the returned price is net or gross. |  |
| shipments | array |  | The array of shipments. This property is part of basket checkout information only. |  |
| shipments.adjusted_merchandize_total_tax | double |  | The products tax after discounts applying in purchase currency. Adjusted merchandize prices represent the sum of product prices before services such as shipping have been added, but after adjustment from promotions have been added. Note that order level adjustments are considered if Discount Taxation preference is set to "Tax Products and Shipping Only Based on Adjusted Price". |  |
| shipments.adjusted_shipping_total_tax | double |  | The tax of all shipping line items of the line item container after shipping adjustments have been applied. |  |
| shipments.gift | boolean |  | A flag indicating whether the shipment is a gift. |  |
| shipments.gift_message | string |  | The gift message. |  |
| shipments.merchandize_total_tax | double |  | The products total tax in purchase currency. Merchandize total prices represent the sum of product prices before services such as shipping or adjustment from promotions have been added. |  |
| shipments.product_sub_total | double |  | The total price of all product items after all product discounts. Depending on taxation policy the returned price is net or gross. |  |
| shipments.product_total | double |  | The total price of all product items after all product and order discounts. Depending on taxation policy the returned price is net or gross. |  |
| shipments.shipment_id | string |  | The order specific id to identify the shipment. |  |
| shipments.shipment_no | string |  | Returns the shipment number for this shipment. This number is automatically generated. |  |
| shipments.shipment_total | double |  | The total price of the shipment, including products, shipping and tax. Note that order level adjustments are not considered. |  |
| shipments.shipping_address | object |  | Document representing an order address. |  |
| shipments.shipping_method | object |  | Document representing a shipping method. |  |
| shipments.shipping_status | string |  | The shipping status of the shipment. | Enum values: not_shippedshipped |
| shipments.shipping_total | double |  | The total shipping price of the shipment after all shipping discounts. Excludes tax if taxation policy is net. Includes tax if taxation policy is gross. net. Includes tax if taxation policy is gross. |  |
| shipments.shipping_total_tax | double |  | The tax of all shipping line items of the line item container before shipping adjustments have been applied. |  |
| shipments.tax_total | double |  | The total tax amount of the shipment. Note that order level adjustments are considered if Discount Taxation preference is set to "Tax Products and Shipping Only Based on Adjusted Price". |  |
| shipments.tracking_number | string |  | The tracking number of the shipment. |  |
| shipping_items | array |  | The sorted array of shipping items. This array can be empty. |  |
| shipping_items.adjusted_tax | double |  | The tax of the product item after adjustments applying. |  |
| shipping_items.base_price | double |  | The base price for the line item, which is the price of the unit before applying adjustments, in the purchase currency. The base price may be net or gross of tax depending on the configured taxation policy. |  |
| shipping_items.item_id | string |  | The item identifier. Use this to identify an item when updating the item quantity or creating a custom price adjustment for an item. |  |
| shipping_items.item_text | string |  | The text describing the item in more detail. |  |
| shipping_items.price | double |  | The price of the line item before applying any adjustments. If the line item is based on net pricing then the net price is returned. If the line item is based on gross pricing then the gross price is returned. |  |
| shipping_items.price_adjustments | array |  | Array of price adjustments. Can be empty. |  |
| shipping_items.price_after_item_discount | double |  | The price of the product line item after applying all product-level adjustments. For net pricing the adjusted net price is returned. For gross pricing, the adjusted gross price is returned. |  |
| shipping_items.shipment_id | string |  | The identifier of the shipment to which this item belongs. |  |
| shipping_items.tax | double |  | The tax of the product item before adjustments applying. |  |
| shipping_items.tax_basis | double |  | The price used to calculate the tax for this product item. null if tax has not been set for this product item yet |  |
| shipping_items.tax_class_id | string |  | The tax class ID for the product item or null if no tax class ID is associated with the product item. if no tax class ID is associated with the product item |  |
| shipping_items.tax_rate | double |  | The tax rate, which is the decimal tax rate to be applied to the product represented by this item. |  |
| shipping_total | double |  | The total shipping price of the order after all shipping discounts. Excludes tax if taxation policy is net. Includes tax if taxation policy is gross. This property is part of basket checkout information only. Includes tax if taxation policy is gross. |  |
| shipping_total_tax | double |  | The tax of all shipping line items of the line item container before shipping adjustments have been applied. |  |
| source_code | string |  | Gets the source code assigned to this basket. |  |
| tax_rounded_at_group | boolean |  | If the tax is rounded at group level then this is set to true, false if the tax is rounded at item or unit level |  |
| tax_total | double |  | The total tax amount of the order. This property is part of basket checkout information only. |  |
| taxation | string |  | The taxation the line item container is based on. | Enum values: grossnet |
| temporary_basket | boolean |  | Is the basket created a temporary basket? |  |

## Security

## Basic Authentication

User authentication either for a registered or a guest customer (selectable in request body). Access via Base64 encoded customer:password string as 'Authorization: Basic' header.

### OAuth 2.0

Authentication flow with client ID and password with account manager.

#### Settings

## Api Key

Add client ID for application identification. Alternative as 'client\_id' query parameter.

#### Query Parameters

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| temporary | boolean |  | The boolean flag for creating the basket as temporary. |  |

## Responses

### 400

CustomerBasketsQuotaExceededException - Thrown if a new basket cannot be created because the maximum number of baskets per customer would be exceeded. or CustomerTemporaryBasketsQuotaExceededException - Thrown if a new temporary basket cannot be created because the maximum number of temporary baskets per customer would be exceeded. or DuplicateShipmentIdException - Indicates that the same shipment id appeared twice in the body. or InvalidCustomerException - Thrown if the customerId URL parameter does not match the verified customer represented by the JWT, not relevant when using OAuth. or InvalidPaymentMethodIdException - Indicates that the provided payment method is invalid or not applicable. or InvalidPriceAdjustmentLevelException - Indicates that a fixed price adjustment was added at order level which is disallowed. or InvalidPromotionIdException - When attempting to add a price adjustment, indicates that a promotion id was used twice. or MissingCouponCodeException - Thrown if the coupon number is not provided. or SystemPromotionIdException - When attempting to add a price adjustment, indicates that a system promotion id was used as a manual promotion id. or TooManyPromotionsException - Indicates that more than one hundred price adjustments would have been created.

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

ShipmentNotFoundException - Thrown if the shipment with the given shipment id is unknown.

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
  "basket_id": "bczFTaOjgEqUkaaadkvHwbgrP5",
  "currency": "USD",
  "customer_info": {
    "customer_id": "adNJrbxJovaT5DPxUSfOywk6Et",
    "email": ""
  },
  "order_total": 0,
  "product_sub_total": 0,
  "product_total": 0,
  "shipments": [
    {
      "id": "me",
      "shipment_id": "bc5OTaOjgEqUoaaadkvHwbgrP5"
    }
  ],
  "shipping_items": [
    {
      "item_id": "bcwsbaOjgEqUsaaadkvHwbgrP5",
      "shipment_id": "me"
    }
  ],
  "shipping_total": 0,
  "shipping_total_tax": 0,
  "tax_total": 0,
  "taxation": "net"
}
```

#### Body

Media types: application/json, text/xml

| Field | Type | Flags | Description | Constraints |
| --- | --- | --- | --- | --- |
| adjusted_merchandize_total_tax | double |  | The products tax after discounts applying in purchase currency. Adjusted merchandize prices represent the sum of product prices before services such as shipping have been added, but after adjustment from promotions have been added. |  |
| adjusted_shipping_total_tax | double |  | The tax of all shipping line items of the line item container after shipping adjustments have been applied. |  |
| agent_basket | boolean |  | Is the basket created by an agent? |  |
| basket_id | string |  | The unique identifier for the basket. |  |
| billing_address | object |  | Document representing an order address. |  |
| bonus_discount_line_items | array |  | The bonus discount line items of the line item container. |  |
| channel_type | string | Read-only | The sales channel for the order. This is a read-only attribute that can't be modified by an OCAPI call. For OCAPI, the sales channel is determined based on the client ID and token used for the OCAPI call. Usually, a customer-based authentication sets the channel to Storefront, and an agent-based authentication sets it to CallCenter. Using applications that use other client IDs for OCAPI calls, like Customer Service Center, will set different channel types. To modify the channel type in OCAPI, use a hook. * | Enum values: storefrontcallcentermarketplacedssstorepinteresttwitterfacebookadssubscriptionsonlinereservationcustomerservicecenterinstagramcommercegoogletiktoksnapchatyoutubewhatsapp |
| coupon_items | array |  | The sorted array of coupon items. This array can be empty. |  |
| creation_date | datetime | Read-only | Returns the value of attribute 'creationDate'. |  |
| currency | string |  | The ISO 4217 mnemonic code of the currency. |  |
| customer_info | object |  | Document representing information used to identify a customer. |  |
| gift_certificate_items | array |  | The sorted array of gift certificate line items. This array can be empty. |  |
| grouped_tax_items | array |  | Tax values that are summed and grouped based on the tax rate. The tax totals of the line items with the same tax rate will be grouped together and summed up. This will not affect calculation in any way. |  |
| inventory_reservation_expiry | datetime |  |  |  |
| last_modified | datetime | Read-only | Returns the value of attribute 'lastModified'. |  |
| merchandize_total_tax | double |  | The products total tax in purchase currency. Merchandize total prices represent the sum of product prices before services such as shipping or adjustment from promotions have been added. |  |
| notes | object |  | Document representing a link to another resource. |  |
| order_price_adjustments | array |  | The array of order level price adjustments. This array can be empty. |  |
| order_total | double |  | The total price of the order, including products, shipping and tax. This property is part of basket checkout information only. |  |
| payment_instruments | array |  | The payment instruments list for the order. |  |
| product_items | array |  | The sorted array of product items (up to a maximum of 50 items by default). This array can be empty. |  |
| product_sub_total | double |  | The total price of all product items after all product discounts. Depending on taxation policy the returned price is net or gross. |  |
| product_total | double |  | The total price of all product items after all product and order discounts. Depending on taxation policy the returned price is net or gross. |  |
| shipments | array |  | The array of shipments. This property is part of basket checkout information only. |  |
| shipping_items | array |  | The sorted array of shipping items. This array can be empty. |  |
| shipping_total | double |  | The total shipping price of the order after all shipping discounts. Excludes tax if taxation policy is net. Includes tax if taxation policy is gross. This property is part of basket checkout information only. Includes tax if taxation policy is gross. |  |
| shipping_total_tax | double |  | The tax of all shipping line items of the line item container before shipping adjustments have been applied. |  |
| source_code | string |  | Gets the source code assigned to this basket. |  |
| tax_rounded_at_group | boolean |  | If the tax is rounded at group level then this is set to true, false if the tax is rounded at item or unit level |  |
| tax_total | double |  | The total tax amount of the order. This property is part of basket checkout information only. |  |
| taxation | string |  | The taxation the line item container is based on. | Enum values: grossnet |
| temporary_basket | boolean |  | Is the basket created a temporary basket? |  |
