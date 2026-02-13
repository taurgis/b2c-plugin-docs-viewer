# OCAPI Customization

You can customize Shop API resources that perform a modification on the server side, such as the `Customer` and `Basket` resources. These resources provide extension points, or hooks, that enable you to augment server-side logic with your own script code.

Each customizable resource provides `before`, `after`, and `modifyResponse` hooks. Use the `before` and `after` hooks to execute custom code before or after the server performs its processing. Use the `modifyResponse` hook to apply changes to the response document. In addition, convenience hooks allow you to perform actions like basket calculations or checkout steps. These convenience hooks let you place your basket-calculation code in a single place, instead of including duplicate code in multiple `after` hooks.

For information on hooks and supported resources, see [OCAPI Hooks for Data API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/hooks-data.html) and [OCAPI Hooks for Shop API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/hooks-shop.html).

The processing flow is as follows:

![API Customization Details](https://a.sfdcstatic.com/developer-website/sfdocs/commerce-cloud/media/b2c-commerce/api-hooks.png)

| Processing Step | Comment |
| --- | --- |
| Server receives a request to modify a resource | The server checks for registered before hooks. |
| Server calls registered before hook | The server passes the request document and a Script API object representing the resource that it will modify. Your custom code can manipulate both, but typically performs input validation on the request document. |
| Server modifies the resource | The server uses the request document processed by the before hook, applying it to the Script API object. |
| Server calls registered after hook | The server passes the request document, after any modifications by the before hook, and the Script API object. Your custom code can do some change tracking here, or you can modify the Script API object. For example, you can recalculate the basket. Don't modify the request document, because it isn't processed again. It's provided here for informational purposes. |
| Server applies system logic | For certain resources, the server performs additional system processing after the after hook. For example, with order creation, this includes database commits, inventory locking and booking, coupon locking and redemption, and other order-specific operations. The time spent in this step can vary depending on the resource and the complexity of the operations. |
| Server creates the response document | The server copies values from the Script API object, after any modifications by the after hook and system processing, into the response document. |
| Server calls registered modifyResponse hook | The server passes the previous response document, after any modifications by the after hook, and the Script API object. This hook type is meant to make final changes to the response document only. Don't modify a Script API object in this hook type, because it isn’t executed in a transactional context. It can cause an ORMTransactionException and an HTTP 500 fault. |
| Server sends the response to the caller | The server renders the response document, after any modifications by the after hook, into the requested format. Then the server returns the response to the caller. |

For state-changing HTTP methods like DELETE, PATCH, POST and PUT, the server executes any `before` and `after` hook logic, plus the system logic, in the context of one database transaction. The transaction ensures that everything (or nothing) is committed into the database.

Don’t modify a Script API object in an HTTP GET request or a `modifyResponse` hook, because they are not executed in a transaction.. It can cause an `ORMTransactionException` and an HTTP 500 fault response.

For each hook, your code **SHOULD** return a `Status` object to the server. If the status is `OK`, the server continues processing. If the status is `ERROR`, representing a handled exception, the server stops further processing, **rolls back the transaction and** responds with an HTTP 400 Bad Request fault. When an `ERROR` occurs, the server returns an OCAPI fault to the caller, containing information like the error code, message, and details from the `Status` object. Uncaught exceptions in your code including the errors you throw cause an HTTP 500 Internal Error fault; in this case, the server rolls back the transaction.

If your hook code does not return a `Status` object, **multiple registered hook scripts might be executed**, including the overridden base implementation. The `Status` object or value returned by these hooks will then be returned instead.

Starting in 18.3, modify Response customization hooks are provided for the Shop API. These hooks support POST, PUT, PATCH, and GET methods, and replace the previous afterGET hooks.

Modify response hooks have the following characteristics:

-   They support GET, POST, PUT, and PATCH methods to enrich the response document with custom information.
-   They enable your customization code to change and unset document attributes and add, delete, and change custom attributes in the return document.
-   They disallow database transactions within your customized script code, making it impossible for your code to change persistent data.
-   If there’s caching, they’re only executed if the cache is empty or stale. But they aren’t executed for every GET or HEAD call.

The following example shows customization script code for the Shop API category method:

1.  Place a `package.json` file in the top-level directory of your cartridge.
2.  In the `package.json` file, define the `hooks` property to the path of the `hooks.json` configuration file. This path is relative to the directory containing the `package.json` file:
    
3.  In the `hooks.json` file, configure an array with the mappings of hooks to their script files with paths relative to the `hooks.json` file:
    
4.  For site specific use, register the cartridge to each appropriate site in Business Manager. To customize organization-level resources across *all* sites, such as libraries, register the cartridge to the Business Manager site.

Hook scripts are loaded as CommonJS modules. Hook functions must be exported. The exported name must match the name of the hook, without the package qualification. For example, the `dw.ocapi.shop.basket.billing_address.beforePUT` hook is exported as `beforePUT`:

For each hook, your code **SHOULD** return a `Status` object to the server. If the status is `OK`, the server continues processing. If the status is `ERROR`, representing a handled exception, the server stops further processing, **rolls back the transaction and** responds with an HTTP 400 Bad Request fault. When an `ERROR` occurs, the server returns a fault to the caller, containing information like the error code, message, and details from the `Status` object. Uncaught exceptions in your code including the errors you throw cause an HTTP 500 Internal Error fault; in this case, the server rolls back the transaction.

When an `ERROR` occurs, the server returns an [RFC IETF rfc7807](https://datatracker.ietf.org/doc/html/rfc7807) **ErrorResponse** to the caller, containing information like the error code, message, and details from the `Status` object.

If your hook code does not return a `Status` object, **multiple registered hook scripts might be executed**, including the overridden base implementation. The `Status` object or value returned by these hooks will then be returned instead.

A single request can call multiple hooks. For example: adding a new [payment instrument to a basket](https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-baskets?meta=addPaymentInstrumentToBasket) calls:

-   `dw.ocapi.shop.basket.payment_instrument.beforePOST`
-   `dw.ocapi.shop.basket.payment_instrument.afterPOST`
-   `dw.ocapi.shop.basket.payment_instrument.modifyPOSTResponse`

To pass data between hooks, use [`request.custom`](https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/index.html?target=class_dw_system_Request.html). JavaScript objects added to the request are available in subsequent hooks.

For example, to call a 3rd party payment processor **inside the transaction** of adding a new payment instrument to the basket, you can make this call within the `dw.ocapi.shop.basket.payment_instrument.afterPOST` hook (to ensure any errors rollback the transaction). After calling the payment service provider to initialize the payment request, you can return the relevant data to the client in the `dw.ocapi.shop.basket.payment_instrument.modifyPOSTResponse` hook. To do this, add relevant data to the `request.custom` container to be handled by the `modifyPOSTResponse` hook.

The Hook Circuit Breaker protects the system from excessive hook execution failures. For more information, see [Hook Circuit Breaker](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/hookcircuitbreaker.html).

The Calculate hook, `dw.order.calculate`, enables you to implement customized basket calculation logic. It can be used as the single place for basket calculation and recalculation. This hook provides a default implementation, can be overridden. The default logic of the following hooks implicitly call this hook:

-   dw.ocapi.baskets.actions.afterMerge
-   dw.ocapi.baskets.actions.afterTransfer
-   dw.ocapi.shop.basket.afterPATCH
-   dw.ocapi.shop.basket.afterPOST
-   dw.ocapi.shop.basket.agent.afterPUT
-   dw.ocapi.shop.basket.billing\_address.afterPUT
-   dw.ocapi.shop.basket.coupon.afterDELETE
-   dw.ocapi.shop.basket.coupon.afterPOST
-   dw.ocapi.shop.basket.customer.afterPUT
-   dw.ocapi.shop.basket.gift\_certificate\_item.afterDELETE
-   dw.ocapi.shop.basket.gift\_certificate\_item.afterPATCH
-   dw.ocapi.shop.basket.gift\_certificate\_item.afterPOST
-   dw.ocapi.shop.basket.item.afterDELETE
-   dw.ocapi.shop.basket.item.afterPATCH
-   dw.ocapi.shop.basket.items.afterPOST
-   dw.ocapi.shop.basket.payment\_instrument.afterDELETE
-   dw.ocapi.shop.basket.payment\_instrument.afterPATCH
-   dw.ocapi.shop.basket.payment\_instrument.afterPOST
-   dw.ocapi.shop.basket.price\_adjustment.afterDELETE
-   dw.ocapi.shop.basket.price\_adjustment.afterPATCH
-   dw.ocapi.shop.basket.price\_adjustment.afterPOST
-   dw.ocapi.shop.basket.reference.afterPOST
-   dw.ocapi.shop.basket.shipment.afterDELETE
-   dw.ocapi.shop.basket.shipment.afterPATCH
-   dw.ocapi.shop.basket.shipment.afterPOST
-   dw.ocapi.shop.basket.shipment.shipping\_address.afterPUT
-   dw.ocapi.shop.basket.shipment.shipping\_method.afterPUT
-   dw.ocapi.shop.basket.storefront.afterPUT
-   dw.ocapi.shop.order.beforePOST
-   dw.ocapi.shop.order.beforePUT

The following code snippet shows a sample call:

In this sample call, the parameters are:

-   `"dw.order.calculate"` - the extension point to call
-   `"calculate"` - the script function to call
-   `basket` - the basket to be calculated

SiteGenesis uses the default implementation of the `dw.order.calculate` hook for basket calculation logic.

```js
const Status = require("dw/system/Status");

exports.modifyGETResponse = function (scriptCategory, categoryWO) {
  if (!scriptCategory.online) {
    categoryWO.c_modify_response_data = "modifyResponseData";
  }
  return new Status(Status.OK);
};
```

```json
{
  "hooks": "./cartridge/scripts/hooks.json"
}
```

```json
{
  "hooks": [
    {
      "name": "dw.ocapi.shop.basket.billing_address.beforePUT",
      "script": "./basket_hook_scripts.js"
    },
    {
      "name": "dw.ocapi.shop.basket.billing_address.afterPUT",
      "script": "./basket_hook_scripts.js"
    }
  ]
}
```

```javascript
//  basket_hook_scripts.js
var Status = require("dw/system/Status");
var HookManager = require("dw/system/HookMgr");

exports.beforePUT = function (basket, doc) {
  // Detect whether the address is valid.
  var isValidAddress = true;
  if (isValidAddress) {
    return new Status(Status.OK);
  }
  return new Status(Status.ERROR);
};

exports.afterPUT = function (basket, doc) {
  // Calculate the basket by calling the convenience hook, which returns a status object.
  var status = HookManager.callHook("dw.order.calculate", "calculate", basket);
  return status;
};

exports.calculate = function (basket) {
  return new Status(Status.OK);
};
```

```javascript
// dw.ocapi.shop.basket.payment_instrument.afterPOST
exports.afterPOST = function (order, paymentInstrumentRequest) {
   //...
   request.custom.paymentIntentID = callPaymentService();
};

// dw.ocapi.shop.basket.payment_instrument.modifyPOSTResponse
exports.modifyPOSTResponse = function (basket, basketResponse, paymentInstrumentRequest) {
   // retrieve payment instrument created in this hook execution
   var addedPayment = basketResponse.paymentInstruments.toArray().filter(function (instr) {
      return instr.paymentMethodId === paymentInstrumentRequest.paymentMethodId;
   })[0];

   addedPayment.c_paymentIntentID = request.custom.paymentIntentID;
};
```

```javascript
dw.system.HookMgr.callHook("dw.order.calculate", "calculate", basket);
```
