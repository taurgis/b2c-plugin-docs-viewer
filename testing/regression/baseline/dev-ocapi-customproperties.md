# OCAPI Custom Properties

The Open Commerce API allows you to set custom properties of business objects in input documents and to read custom properties in output documents. Whether a business object supports custom properties can be found in the [tables below](#document-types-supporting-custom-properties). Custom properties are always marked with the prefix `c_` and have therefore their own namespace.

The example below shows a document response including some custom properties in OCAPI:

The following value types are supported in OCAPI for input and output of custom properties.

-   Text
-   String
-   Enum of Strings
-   Set of Strings
-   Integer
-   Enum of Integers
-   Set of Integers
-   Double
-   Set of Doubles
-   Boolean
-   EMail
-   Password
-   Date
-   Date+Time

The value types **HTML** and **Image** are only supported as output, but not as input value type for custom properties in OCAPI.

The tables below lists the document types that support custom properties in OCAPI SHOP and DATA APIs. OCAPI `modify...` hooks that used the referenced document types can add custom properties using the `c_` prefix. See [Customization With Hooks](https://developer.salesforce.com/docs/commerce/commerce-api/guide/extensibility_via_hooks.html), [Hooks for SHOP API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/hooks-shop.html), and [Hooks for DATA API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/hooks-data.html) for more information.

The following shop API documents support custom properties.

| Document Type | Reference |
| --- | --- |
| ApproachingDiscount | approaching_discount |
| Basket | basket |
| BasketPaymentInstrumentRequest | basket_payment_instrument_request |
| BonusDiscountLineItem | bonus_discount_line_item |
| BundledProductItem | bundled_product_item |
| Category | category |
| Content | content |
| ContentFolder | content_folder |
| CouponItem | coupon_item |
| CustomObject | custom_object |
| Customer | customer |
| CustomerAddress | customer_address |
| CustomerInfo | customer_info |
| CustomerPaymentInstrument | customer_payment_instrument |
| CustomerPaymentInstrumentRequest | customer_payment_instrument_request |
| CustomerProductList | customer_product_list |
| CustomerProductListItem | customer_product_list_item |
| CustomerProductListItemPurchase | customer_product_list_item_purchase |
| GiftCertificate | gift_certificate |
| GiftCertificateItem | gift_certificate_item |
| OptionItem | option_item |
| Order | order |
| OrderAddress | order_address |
| OrderPaymentInstrument | order_payment_instrument |
| OrderPaymentInstrumentRequest | order_payment_instrument_request |
| PathRecord | path_record |
| PaymentCardSpec | payment_card_spec |
| PaymentMethod | payment_method |
| PriceAdjustment | price_adjustment |
| PriceAdjustmentRequest | price_adjustment_request |
| Product | product |
| ProductItem | product_item |
| ProductListItem | product_list_item |
| ProductListItemReference | product_list_item_reference |
| ProductListLink | product_list_link |
| ProductSearchHit | product_search_hit |
| Promotion | promotion |
| PublicProductList | public_product_list |
| PublicProductListItem | public_product_list_item |
| PublicProductListLink | public_product_list_link |
| Recommendation | recommendation |
| Shipment | shipment |
| ShippingItem | shipping_item |
| ShippingMethod | shipping_method |
| ShippingPromotion | shipping_promotion |
| Store | store |
| SuggestedCategory | suggested_category |
| SuggestedContent | suggested_content |
| SuggestedPhrase | suggested_phrase |
| SuggestedProduct | suggested_product |
| Suggestion | suggestion |

The following DATA API documents support custom properties.

| Document Type | Reference |
| --- | --- |
| Campaign | campaign |
| Catalog | catalog |
| Category | category |
| ContentAsset | content_asset |
| ContentFolder | content_folder |
| Coupon | coupon |
| CustomObject | custom_object |
| Customer | customer |
| CustomerAddress | customer_address |
| CustomerGroup | customer_group |
| GiftCertificate | gift_certificate |
| OrderUpdateRequest | order_update_request |
| OrganizationPreferences | organization_preferences |
| PathRecord | path_record |
| PaymentInstrumentUpdateRequest | payment_instrument_update_request |
| PaymentTransactionUpdateRequest | payment_transaction_update_request |
| Product | product |
| ProductInventoryRecord | product_inventory_record |
| Promotion | promotion |
| PromotionCampaignAssignment | promotion_campaign_assignment |
| RedemptionLimitPerPeriod | redemption_limit_per_period |
| RedemptionLimits | redemption_limits |
| ShippingAddressUpdateRequest | shipping_address_update_request |
| SitePreferences | site_preferences |
| SlotConfiguration | slot_configuration |
| SortingRule | sorting_rule |
| SortingRuleStep | sorting_rule_step |
| Store | store |

```txt
REQUEST: GET /dw/shop/v24_5/products/creative-zen-v HTTP/1.1
Host: example.com
Accept: application/json

RESPONSE: HTTP/1.1 200 OK
Content-Type:  application/json; charset=UTF-8
Cache-Control:  max-age=900,must-revalidate
{
   ...
   "c_mediaFormat" : [ "0010", "0020", "0030", "0040" ],
   "c_memorySize" : "1GB",
   "c_tabDescription" : "The ZEN V player was designed for people like you those who walk a step or two ahead of the pack."
}
```
