# OCAPI Property Selection

Property selectors reduce the number of resource properties retrieved by the API, so you can get only those properties you care about, while reducing network bandwidth.

You can specify property selectors for all resource types; to do so, you set the `select` parameter on the request. The actual selector value must be enclosed within parentheses. The following table lists the different capabilities of property selectors for different `select` parameter values:

| Capability | Value of select parameter |
| --- | --- |
| Include properties of all levels, including complex properties. | (**) |
| Include properties of top level, except complex properties. | (*) |
| Include a single property. | (price) (+price) |
| Exclude a single property. | (-price) |
| Include the child document properties. | (variation_attributes.(**)) |
| Return only the first document in array. Index starts with 0. | (variation_attributes[0].(**)) |
| Return only the first 5 documents in array. Index starts with 0. | (variation_attributes[0:4].(**)) |
| Return only the second, fourth, and sixth document in array. Index starts with 0. | (variation_attributes[1,3,5].(**)) |
| Return only documents in array that match the filter. Filter expression syntax is ?(_boolean_expression_). Supported Operators: ==, !=, <=, >=, <, > | (variation_attributes[?(@.name=='color')].(**)) |
| Combine OR (\|\|) and AND (&&) in a filter. | (variation_attributes[?(@.name=='color' && @.id=='size')].(**)) |

You can specify a single property name or a comma-separated list of property names enclosed by parentheses. The following example shows how you can select the `name`, `id`, and `variation_attributes` properties of the product resource instance:

To select a child property, remember to accurately specify all of the result levels. The following example shows a filtered order search with a select that goes three levels deep to select and sort by fields on the retrieved order records.

There are two types of properties, where an extra selector element is required: *Localized\_ and \_SiteSpecific*.

Values of *Localized* properties depend on the locale, therefore a valid locale has to be included in the selector. An example of such a property is a product name. Whether a property is localized is typically noted in the property description.

For instance, this selector chooses all results with a certain name in the *default* locale.

*SiteSpecific* properties are attributes where a value of the property depends on the selected site. The site-specific value is to be accessed with *default@Site.* As an example, a product’s validity dates are a site-specific date-time property.

This is an example of a selector that queries for results with a site-specific property being equal to a value for the site *SiteGenesis*:

```txt
REQUEST:
GET /dw/shop/v24_5/products/123/variations?select=(name,id,variation_attributes.(**)) HTTP/1.1
Host: example.com
Accept: application/json

RESPONSE:
HTTP/1.1 200 OK
Content-Length: 29
Content-Type: application/json; charset=UTF-8

{
  "_v" : "24.5",
  "name":"foo",
  "id":"123",
  "variation_attributes":[{
    "id":"color",
    "name":"Color",
    "values":[{
       "value":"red",
       "name":"Red",
       "description":""
    },
    {
       "value":"blue",
       "name":"Blue",
       "description":""
    }]
  },
  {
    "id":"size",
    "name":"Size",
    "values":[{
       "value":"M",
       "name":"Medium",
       "description":""
    },
    {
       "value":"L",
       "name":"Large",
       "description":""
    }]
  }]
}
```

```txt
REQUEST:
POST /dw/shop/v24_5/order_search HTTP/1.1
Host: example.com
Accept: application/json
{
  "query" : {
    "filtered_query": {
      "filter": {
        "range_filter": {
          "field": "creation_date",
          "from": "2020-03-08T00:00:00.000Z",
          "to": "2020-03-10T00:00:00.000Z"
        }
      },
      "query" : {
        "match_all_query": {}
      }
    }
  },
  "select" : "(hits.(data.(creation_date,confirmation_status,total)))",
  "sorts" : [{"field":"creation_date", "sort_order":"asc"}]
}

RESPONSE:
HTTP/1.1 200 OK
Content-Length: 29
Content-Type: application/json; charset=UTF-8

{
  "_v":"24.5",
  "_type":"order_search_result",
  "hits": [
    {
      "_type":"order_search_hit",
      "data": {
        "_type":"order",
        "creation_date":"2020-03-08T04:15:00.000Z",
        "confirmation_status":"confirmed",
        "total":19.95
      }
    },
    {
      "_type":"order_search_hit",
      "data": {
        "_type":"order",
        "creation_date":"2020-03-08T07:30:00.000Z",
        "confirmation_status":"confirmed",
        "total":75.29
      }
    }
  ]
}
```

```text
(data[?(@.name.default=='Product+Name')].(**))
```

```text
(data[?(@.valid_from.default@SiteGenesis=='2016-02-21T04:00:00.000Z')].(**))
```
