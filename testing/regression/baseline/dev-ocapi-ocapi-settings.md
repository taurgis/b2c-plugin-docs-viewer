# OCAPI Settings

OCAPI settings manage various features, for example, to control OCAPI client permissions, and to control [OCAPI caching](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/caching.html).

You configure OCAPI settings in Business Manager. To specify OCAPI settings, you edit one or more JSON documents that conform to the format described later in this topic.

To configure OCAPI settings, perform the following steps:

1.  In Business Manager: **Administration > Site Development > Open Commerce API Settings**.
2.  In the **Select type** field, select the API type for the configuration.
3.  In the **Select context** field, select the context for the configuration: Global for the configuration to affect all sites in the organization, or the name of a site for the configuration to affect only that site.
4.  In the text field, edit the JSON document.
5.  Click **Save**.

You can override global settings for specific sites. Your settings are cached for up to three minutes until they become effective.

Client settings and permissions can be defined for a single site (site-specific) or for all sites (global). You can override global settings for Client ID per site.

Most Data API resources are organization-specific, so they support only global client permissions.

To use OCAPI, you must first configure client permissions. These permissions control read and write access to specified resources. By default, no permission is granted. OCAPI declines any client application request that doesn’t have the appropriate permissions, returning an HTTP status of 401 (Unauthorized).

The following example shows the format of the JSON document:

The "\_v" property indicates the version of the configuration file structure. It’s independent of the OCAPI version, and thus allows the configuration of resources in any OCAPI version.

Use this document to configure Open Commerce API permissions for multiple client applications in the context of a single site.

| Property | Type | Constraints | Description |
| --- | --- | --- | --- |
| _v | String | N/A | Version number of the configuration file structure. New versions are created when JSON properties are added or the behavior of a property changes. Use the most recent version of the configuration file structure whenever possible. |
| clients | [Client] | N/A | Array of client-specific permission documents. |

Use this document to view the Open Commerce API permissions for a client application.

| Property | Type | Constraints | Description |
| --- | --- | --- | --- |
| allowed_origins | [String] | N/A | Array of allowed origins used in CORS requests. |
| client_id | String | mandatory=true, nullable=false | Client application id. |
| response_headers | Map<String,String> | N/A | Map of custom response header name/value pairs. Supported headers are 'P3P' and custom headers starting with 'X-'. Custom Commerce Cloud Digital headers starting with 'X-DW' aren’t allowed. |
| resources | [Resource] | N/A | Array of resource-specific permission documents. |

Use this document to configure resource-specific permissions and settings.

| Property | Type | Constraints | Description |
| --- | --- | --- | --- |
| cache_time | Integer | N/A | Time period in seconds before the response document becomes stale. The minimum cache time is 0 seconds; the maximum is 86,400 seconds (24 hours). If no value is specified, the default is 60 seconds. For more information, see caching. |
| config | Map<String,String> | N/A | Map that determines which values are returned for some special response document properties. You control this map by configuring reserved key/value pairs. For more information, see Customization. |
| methods | [String] | mandatory=true, nullable=false | Open Commerce API HTTP method filter. For example, the filter ["get","patch"] allows access to the GET and PATCH method for the specified resource path. You can specify methods that are supported for a resource. You can list all available resources and methods for the Shop API, version 24.5, with the following metadata call: http://{your-domain}/dw/meta/rest/shop/v24_5?client_id={your-client-id} |
| personalized_caching_enabled | Boolean | N/A | Flag that determines the personalized caching behavior of a cacheable Shop API resource. By default, the system caches personalized resources when a customer context (JWT) is given. You can use this property to explicitly disable personalized caching (for example, for performance improvements). Disable personalized caching only if responses are guaranteed to be the same for any customer and no further personalization logic (for example, in hooks) applies. |
| read_attributes | String | N/A | String that controls which properties are included in the response document. The configuration value must be specified using property selection syntax. |
| resource_id | String | mandatory=true, nullable=false | OCAPI resource identifier. For example: /products/*/images or /products/specific_id/images. This property supports Ant path style to describe resource IDs. You can specify wildcards or specific product IDs; you can also specify the pattern /products/** to access to all available subresources. You can list all resource identifiers for the Shop API, version 24.5, with the following metadata call: http://{your-domain}/dw/meta/rest/shop/v24_5?client_id={your-client-id} |
| version_range | [VersionRange] | N/A | Array of VersionRange documents granting permissions only to a subset of OCAPI versions. |
| write_attributes | String | N/A | String that controls which properties can be included in the request document. The configuration value must be specified using property selection syntax. |

Use this document to grant resource permissions only to a subset of Open Commerce API versions. You can use the properties `from` and `until` to define the range. At least one must be specified.

| Property | Type | Constraints | Description |
| --- | --- | --- | --- |
| from | String | N/A | From version (for example, 24.5). If you don't specify the from version, all versions earlier than the until version are accessible. |
| until | String | N/A | Until version (for example, 24.5). The until version isn’t included in the range. (For example, if the until version is 19.3, then 19.1 is the latest included version.) If you don't specify the until version, then all versions, including the most recent one, are accessible. |

Resources that support expansion technique are handled as any other resource. Therefore, if you want to restrict access to product image information, configure independent client permissions for each resource: the products base resource `/products/*`, and the images subresource `/products/*/images`.

The Open Commerce API enables you to customize how some data is returned. You can set properties for the following resources:

-   `/product_search/images` (Shop API)
-   `/products/*/availability` (Shop API)
-   `/products/*/prices` (Shop API)
-   `/search_suggestion` (Shop API)

`/product_search/images` (Shop API)

You can customize how image information is returned by configuring the image view types for certain image properties. There are three reserved key/value pairs for this resource:

-   "`search_result.hits.image:view_type":"detail"`
-   `"search_result.variation_attributes.values.image:view_type":"thumbnail"`
-   `"search_result.variation_attributes.values.image_swatch:view_type":"swatch"`

Those properties define the actual image view types. Based on the view type, the Shop API returns the desired image information. If the view\_type isn’t set or if the view\_type is unknown, the image properties aren’t part of the response. For example:

`/products/*/availability` (Shop API)

You can configure max thresholds (returned by the Shop API) to hide real ATS and stock levels. There are two reserved key/value pairs for this resource:

-   "`product.inventory.ats.max_threshold":"100"`
-   `"product.inventory.stock_level.max_threshold":"50"`

ATS and stock levels are sensitive information for merchants. If these properties aren’t set, the API response properties have the default value 999999.

`/products/*/prices` (Shop API)

You can configure which price book prices are exposed in the `product.prices` property. There’s one reserved key/value pair for this resource:

-   "`product.prices.price_book_ids":"usd-list-prices,usd-sale-prices"`

If no price book is defined, the property isn’t part of the response.

`/search_suggestion` (Shop API)

You can customize how image information is returned by configuring the image view types for certain image properties. There are three reserved key/value pairs for this resource:

-   "`suggestion.product.image:view_type":"small"`

Those properties define the actual image view types. Based on the view type, the Shop API returns the desired image information. If the view\_type isn’t set or if the view\_type is unknown, the image properties aren’t part of the response. For example:

```json
{
  "_v": "24.5",
  "clients": [
    {
      "allowed_origins": ["http://www.sitegenesis.com", "https://secure.sitegenesis.com"],
      "client_id": "[your_own_client_id]",
      "response_headers": {
        "x-foo": "bar",
        "P3P": "CP=\"NOI ADM DEV PSAi COM NAV OUR OTR STP IND DEM\""
      },
      "resources": [
        {
          "resource_id": "/product_search",
          "methods": ["get"],
          "read_attributes": "(**)",
          "write_attributes": "(**)",
          "cache_time": 900,
          "version_range": { "from": "24.5" }
        },
        {
          "resource_id": "/products/*/bundled_products",
          "methods": ["get"],
          "read_attributes": "(c_name,c_street)",
          "write_attributes": "(**)"
        },
        {
          "resource_id": "/baskets/*/items",
          "methods": ["post"],
          "read_attributes": "(**)",
          "write_attributes": "(product_id, quantity)"
        }
      ]
    }
  ]
}
```

```json
...
{
    "resource_id":"/product_search/images",
    "methods":["get"],
    "read_attributes":"(**)",
    "write_attributes":"(**)",
    "config":{
        "search_result.hits.image:view_type":"detail",    // use view type "detail" for property "image" in document "ProductSearchHit"
        "search_result.variation_attributes.values.image:view_type":"detail",
        "search_result.variation_attributes.values.image_swatch:view_type":"swatch"
    }
},
...
```

```json
...
{
    "resource_id":"/search_suggestion",
    "methods":["get"],
    "read_attributes":"(**)",
    "write_attributes":"(**)",
    "cache_time":900,
    "config":{
        "suggestion.product.image:view_type":"small"
    }
},
...
```
